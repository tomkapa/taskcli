import type { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert';
import type { Result } from '../../types/common.js';
import { ok, err } from '../../types/common.js';
import type { Project, CreateProjectInput, UpdateProjectInput } from '../../types/project.js';
import type { GitRemote } from '../../types/git-remote.js';
import { ulid } from 'ulid';
import type { ProjectId } from '../../types/branded.js';
import type { ProjectRepository } from '../project.repository.js';
import type { RepositoryError } from '../errors.js';
import type { Clock } from '../clock.js';
import { NOT_DELETED, type ProjectRow, rowToProject } from './row-mappers.js';
import { repoSpan } from './span.js';
import { type TxnState, bumpWrite } from './txn.js';

function isUniqueConstraint(e: unknown): e is Error {
  return e instanceof Error && e.message.includes('UNIQUE constraint');
}

function transientFrom(e: unknown, op: string): RepositoryError {
  const detail = e instanceof Error ? e.message : String(e);
  return { kind: 'transient', cause: 'io', retryable: true, detail: `${op}: ${detail}` };
}

export class SqliteProjectRepository implements ProjectRepository {
  constructor(
    private readonly db: DatabaseSync,
    private readonly clock: Clock,
    private readonly txn: TxnState,
  ) {}

  insert(input: CreateProjectInput & { key: string }): Result<Project, RepositoryError> {
    return repoSpan('project', 'insert', () => {
      assert(input.key.length > 0, 'project key must be non-empty');
      assert(input.name.length > 0, 'project name must be non-empty');

      const limit = bumpWrite(this.txn);
      if (limit) return err(limit);

      try {
        const now = this.clock.nowIso();
        const id = ulid();

        if (input.isDefault) {
          this.db.prepare('UPDATE projects SET is_default = 0 WHERE is_default = 1').run();
        }

        this.db
          .prepare(
            `INSERT INTO projects (id, key, name, description, is_default, git_remote, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            id,
            input.key,
            input.name,
            input.description ?? '',
            input.isDefault ? 1 : 0,
            input.gitRemote?.value ?? null,
            now,
            now,
          );

        const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as
          | ProjectRow
          | undefined;
        assert(row != null, 'inserted project row must be readable');
        return ok(rowToProject(row));
      } catch (e) {
        if (isUniqueConstraint(e)) {
          if (e.message.includes('git_remote')) {
            return err({
              kind: 'duplicate',
              entity: 'project',
              key: input.gitRemote?.value ?? '',
              detail: `Git remote already linked to another project: ${input.gitRemote?.value ?? ''}`,
            });
          }
          return err({
            kind: 'duplicate',
            entity: 'project',
            key: input.name,
            detail: `Project name already exists: ${input.name}`,
          });
        }
        return err(transientFrom(e, 'project.insert'));
      }
    });
  }

  findById(id: ProjectId): Result<Project | null, RepositoryError> {
    return repoSpan('project', 'find_by_id', () => {
      try {
        const row = this.db
          .prepare(`SELECT * FROM projects WHERE id = ? AND ${NOT_DELETED}`)
          .get(id) as ProjectRow | undefined;
        return ok(row ? rowToProject(row) : null);
      } catch (e) {
        return err(transientFrom(e, 'project.find_by_id'));
      }
    });
  }

  findByKey(key: string): Result<Project | null, RepositoryError> {
    return repoSpan('project', 'find_by_key', () => {
      try {
        const row = this.db
          .prepare(`SELECT * FROM projects WHERE key = ? AND ${NOT_DELETED}`)
          .get(key) as ProjectRow | undefined;
        return ok(row ? rowToProject(row) : null);
      } catch (e) {
        return err(transientFrom(e, 'project.find_by_key'));
      }
    });
  }

  findByName(name: string): Result<Project | null, RepositoryError> {
    return repoSpan('project', 'find_by_name', () => {
      try {
        const row = this.db
          .prepare(`SELECT * FROM projects WHERE name = ? AND ${NOT_DELETED}`)
          .get(name) as ProjectRow | undefined;
        return ok(row ? rowToProject(row) : null);
      } catch (e) {
        return err(transientFrom(e, 'project.find_by_name'));
      }
    });
  }

  findByGitRemote(remote: GitRemote): Result<Project | null, RepositoryError> {
    return repoSpan('project', 'find_by_git_remote', () => {
      try {
        const row = this.db
          .prepare(`SELECT * FROM projects WHERE git_remote = ? AND ${NOT_DELETED}`)
          .get(remote.value) as ProjectRow | undefined;
        return ok(row ? rowToProject(row) : null);
      } catch (e) {
        return err(transientFrom(e, 'project.find_by_git_remote'));
      }
    });
  }

  findDefault(): Result<Project | null, RepositoryError> {
    return repoSpan('project', 'find_default', () => {
      try {
        const row = this.db
          .prepare(`SELECT * FROM projects WHERE is_default = 1 AND ${NOT_DELETED}`)
          .get() as ProjectRow | undefined;
        return ok(row ? rowToProject(row) : null);
      } catch (e) {
        return err(transientFrom(e, 'project.find_default'));
      }
    });
  }

  findAll(): Result<Project[], RepositoryError> {
    return repoSpan('project', 'find_all', () => {
      try {
        const rows = this.db
          .prepare(`SELECT * FROM projects WHERE ${NOT_DELETED} ORDER BY created_at DESC`)
          .all() as ProjectRow[];
        return ok(rows.map(rowToProject));
      } catch (e) {
        return err(transientFrom(e, 'project.find_all'));
      }
    });
  }

  update(id: ProjectId, input: UpdateProjectInput): Result<Project, RepositoryError> {
    return repoSpan('project', 'update', () => {
      assert(id.length > 0, 'project id must be non-empty');

      const limit = bumpWrite(this.txn);
      if (limit) return err(limit);

      try {
        const existing = this.db
          .prepare(`SELECT * FROM projects WHERE id = ? AND ${NOT_DELETED}`)
          .get(id) as ProjectRow | undefined;
        if (!existing) {
          return err({ kind: 'not_found', entity: 'project', id });
        }

        const now = this.clock.nowIso();

        if (input.isDefault) {
          this.db.prepare('UPDATE projects SET is_default = 0 WHERE is_default = 1').run();
        }

        this.db
          .prepare(
            `UPDATE projects SET
               name = ?, description = ?, is_default = ?, git_remote = ?, updated_at = ?
             WHERE id = ?`,
          )
          .run(
            input.name ?? existing.name,
            input.description ?? existing.description,
            input.isDefault !== undefined ? (input.isDefault ? 1 : 0) : existing.is_default,
            input.gitRemote !== undefined ? (input.gitRemote?.value ?? null) : existing.git_remote,
            now,
            id,
          );

        const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as
          | ProjectRow
          | undefined;
        assert(row != null, 'updated project row must be readable');
        return ok(rowToProject(row));
      } catch (e) {
        if (isUniqueConstraint(e)) {
          if (e.message.includes('git_remote')) {
            return err({
              kind: 'duplicate',
              entity: 'project',
              key: 'git_remote',
              detail: 'Git remote already linked to another project',
            });
          }
          return err({
            kind: 'duplicate',
            entity: 'project',
            key: 'name',
            detail: 'Project name already exists',
          });
        }
        return err(transientFrom(e, 'project.update'));
      }
    });
  }

  delete(id: ProjectId): Result<void, RepositoryError> {
    return repoSpan('project', 'delete', () => {
      assert(id.length > 0, 'project id must be non-empty');

      const limit = bumpWrite(this.txn);
      if (limit) return err(limit);

      try {
        const existing = this.db
          .prepare(`SELECT * FROM projects WHERE id = ? AND ${NOT_DELETED}`)
          .get(id) as ProjectRow | undefined;
        if (!existing) {
          return err({ kind: 'not_found', entity: 'project', id });
        }
        const now = this.clock.nowIso();
        this.db
          .prepare('UPDATE projects SET deleted_at = ?, updated_at = ? WHERE id = ?')
          .run(now, now, id);
        // Soft-delete all tasks in this project
        this.db
          .prepare(
            'UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE project_id = ? AND deleted_at IS NULL',
          )
          .run(now, now, id);
        return ok(undefined);
      } catch (e) {
        return err(transientFrom(e, 'project.delete'));
      }
    });
  }

  incrementTaskCounter(id: ProjectId): Result<number, RepositoryError> {
    return repoSpan('project', 'increment_task_counter', () => {
      assert(id.length > 0, 'project id must be non-empty');

      const limit = bumpWrite(this.txn);
      if (limit) return err(limit);

      try {
        this.db
          .prepare(
            `UPDATE projects SET task_counter = task_counter + 1 WHERE id = ? AND ${NOT_DELETED}`,
          )
          .run(id);
        const row = this.db
          .prepare(`SELECT task_counter FROM projects WHERE id = ? AND ${NOT_DELETED}`)
          .get(id) as { task_counter: number } | undefined;
        if (!row) {
          return err({ kind: 'not_found', entity: 'project', id });
        }
        return ok(row.task_counter);
      } catch (e) {
        return err(transientFrom(e, 'project.increment_task_counter'));
      }
    });
  }
}
