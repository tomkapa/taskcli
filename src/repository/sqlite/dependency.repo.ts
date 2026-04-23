import type { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert';
import type { Result } from '../../types/common.js';
import { ok, err } from '../../types/common.js';
import type { TaskDependency } from '../../types/dependency.js';
import type { Task } from '../../types/task.js';
import type { DependencyType } from '../../types/enums.js';
import type { TaskId } from '../../types/branded.js';
import type { DependencyRepository } from '../dependency.repository.js';
import type { RepositoryError } from '../errors.js';
import type { Clock } from '../clock.js';
import { type TaskRow, type DependencyRow, rowToTask, rowToDependency } from './row-mappers.js';
import { repoSpan } from './span.js';
import { type TxnState, bumpWrite } from './txn.js';

function transientFrom(e: unknown, op: string): RepositoryError {
  const detail = e instanceof Error ? e.message : String(e);
  return { kind: 'transient', cause: 'io', retryable: true, detail: `${op}: ${detail}` };
}

export class SqliteDependencyRepository implements DependencyRepository {
  constructor(
    private readonly db: DatabaseSync,
    private readonly clock: Clock,
    private readonly txn: TxnState,
  ) {}

  insert(
    taskId: TaskId,
    dependsOnId: TaskId,
    type: DependencyType,
  ): Result<TaskDependency, RepositoryError> {
    return repoSpan('dependency', 'insert', () => {
      assert(taskId.length > 0, 'taskId must be non-empty');
      assert(dependsOnId.length > 0, 'dependsOnId must be non-empty');

      const limit = bumpWrite(this.txn);
      if (limit) return err(limit);

      try {
        const now = this.clock.nowIso();
        this.db
          .prepare(
            `INSERT INTO task_dependencies (task_id, depends_on_id, type, created_at)
             VALUES (?, ?, ?, ?)`,
          )
          .run(taskId, dependsOnId, type, now);

        const row = this.db
          .prepare('SELECT * FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?')
          .get(taskId, dependsOnId) as DependencyRow | undefined;
        assert(row != null, 'inserted dependency row must be readable');
        return ok(rowToDependency(row));
      } catch (e) {
        if (e instanceof Error && e.message.includes('UNIQUE constraint')) {
          return err({
            kind: 'duplicate',
            entity: 'dependency',
            key: `${taskId}->${dependsOnId}`,
            detail: `Dependency already exists: ${taskId} -> ${dependsOnId}`,
          });
        }
        if (e instanceof Error && e.message.includes('FOREIGN KEY constraint')) {
          return err({
            kind: 'foreign_key',
            parentEntity: 'task',
            parentId: `${taskId},${dependsOnId}`,
            detail: 'One or both tasks do not exist',
          });
        }
        if (e instanceof Error && e.message.includes('CHECK constraint')) {
          return err({
            kind: 'invariant_violated',
            detail: 'A task cannot depend on itself',
          });
        }
        return err(transientFrom(e, 'dependency.insert'));
      }
    });
  }

  delete(taskId: TaskId, dependsOnId: TaskId): Result<void, RepositoryError> {
    return repoSpan('dependency', 'delete', () => {
      assert(taskId.length > 0, 'taskId must be non-empty');
      assert(dependsOnId.length > 0, 'dependsOnId must be non-empty');

      const limit = bumpWrite(this.txn);
      if (limit) return err(limit);

      try {
        const existing = this.db
          .prepare('SELECT * FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?')
          .get(taskId, dependsOnId) as DependencyRow | undefined;
        if (!existing) {
          return err({
            kind: 'not_found',
            entity: 'dependency',
            id: `${taskId}->${dependsOnId}`,
          });
        }
        this.db
          .prepare('DELETE FROM task_dependencies WHERE task_id = ? AND depends_on_id = ?')
          .run(taskId, dependsOnId);
        return ok(undefined);
      } catch (e) {
        return err(transientFrom(e, 'dependency.delete'));
      }
    });
  }

  findByTask(taskId: TaskId): Result<TaskDependency[], RepositoryError> {
    return repoSpan('dependency', 'find_by_task', () => {
      try {
        const rows = this.db
          .prepare('SELECT * FROM task_dependencies WHERE task_id = ? ORDER BY created_at ASC')
          .all(taskId) as DependencyRow[];
        return ok(rows.map(rowToDependency));
      } catch (e) {
        return err(transientFrom(e, 'dependency.find_by_task'));
      }
    });
  }

  findDependents(taskId: TaskId): Result<TaskDependency[], RepositoryError> {
    return repoSpan('dependency', 'find_dependents', () => {
      try {
        const rows = this.db
          .prepare(
            'SELECT * FROM task_dependencies WHERE depends_on_id = ? ORDER BY created_at ASC',
          )
          .all(taskId) as DependencyRow[];
        return ok(rows.map(rowToDependency));
      } catch (e) {
        return err(transientFrom(e, 'dependency.find_dependents'));
      }
    });
  }

  getBlockers(taskId: TaskId): Result<Task[], RepositoryError> {
    return repoSpan('dependency', 'get_blockers', () => {
      try {
        const rows = this.db
          .prepare(
            `SELECT t.* FROM tasks t
             JOIN task_dependencies td ON t.id = td.depends_on_id
             WHERE td.task_id = ? AND td.type = 'blocks' AND t.deleted_at IS NULL
             ORDER BY t.rank ASC`,
          )
          .all(taskId) as TaskRow[];
        return ok(rows.map(rowToTask));
      } catch (e) {
        return err(transientFrom(e, 'dependency.get_blockers'));
      }
    });
  }

  getDependents(taskId: TaskId): Result<Task[], RepositoryError> {
    return repoSpan('dependency', 'get_dependents', () => {
      try {
        const rows = this.db
          .prepare(
            `SELECT t.* FROM tasks t
             JOIN task_dependencies td ON t.id = td.task_id
             WHERE td.depends_on_id = ? AND td.type = 'blocks' AND t.deleted_at IS NULL
             ORDER BY t.rank ASC`,
          )
          .all(taskId) as TaskRow[];
        return ok(rows.map(rowToTask));
      } catch (e) {
        return err(transientFrom(e, 'dependency.get_dependents'));
      }
    });
  }

  getRelated(taskId: TaskId): Result<Task[], RepositoryError> {
    return repoSpan('dependency', 'get_related', () => {
      try {
        const rows = this.db
          .prepare(
            `SELECT DISTINCT t.* FROM tasks t
             JOIN task_dependencies td ON (
               (td.task_id = ? AND td.depends_on_id = t.id) OR
               (td.depends_on_id = ? AND td.task_id = t.id)
             )
             WHERE td.type = 'relates-to' AND t.deleted_at IS NULL
             ORDER BY t.rank ASC`,
          )
          .all(taskId, taskId) as TaskRow[];
        return ok(rows.map(rowToTask));
      } catch (e) {
        return err(transientFrom(e, 'dependency.get_related'));
      }
    });
  }

  getDuplicates(taskId: TaskId): Result<Task[], RepositoryError> {
    return repoSpan('dependency', 'get_duplicates', () => {
      try {
        const rows = this.db
          .prepare(
            `SELECT DISTINCT t.* FROM tasks t
             JOIN task_dependencies td ON (
               (td.task_id = ? AND td.depends_on_id = t.id) OR
               (td.depends_on_id = ? AND td.task_id = t.id)
             )
             WHERE td.type = 'duplicates' AND t.deleted_at IS NULL
             ORDER BY t.rank ASC`,
          )
          .all(taskId, taskId) as TaskRow[];
        return ok(rows.map(rowToTask));
      } catch (e) {
        return err(transientFrom(e, 'dependency.get_duplicates'));
      }
    });
  }

  getTransitiveClosure(taskId: TaskId): Result<Task[], RepositoryError> {
    return repoSpan('dependency', 'get_transitive_closure', () => {
      try {
        const rows = this.db
          .prepare(
            `WITH RECURSIVE transitive_deps(id) AS (
               SELECT depends_on_id FROM task_dependencies WHERE task_id = ?
               UNION
               SELECT td.depends_on_id FROM task_dependencies td
               JOIN transitive_deps d ON td.task_id = d.id
             )
             SELECT t.* FROM tasks t
             WHERE t.id IN (SELECT id FROM transitive_deps) AND t.deleted_at IS NULL
             ORDER BY t.rank ASC`,
          )
          .all(taskId) as TaskRow[];
        return ok(rows.map(rowToTask));
      } catch (e) {
        return err(transientFrom(e, 'dependency.get_transitive_closure'));
      }
    });
  }

  wouldCreateCycle(taskId: TaskId, dependsOnId: TaskId): Result<boolean, RepositoryError> {
    return repoSpan('dependency', 'would_create_cycle', () => {
      try {
        const row = this.db
          .prepare(
            `WITH RECURSIVE reachable(id) AS (
               SELECT depends_on_id FROM task_dependencies WHERE task_id = ?
               UNION
               SELECT td.depends_on_id FROM task_dependencies td
               JOIN reachable r ON td.task_id = r.id
             )
             SELECT 1 AS found FROM reachable WHERE id = ? LIMIT 1`,
          )
          .get(dependsOnId, taskId) as { found: number } | undefined;
        return ok(row !== undefined);
      } catch (e) {
        return err(transientFrom(e, 'dependency.would_create_cycle'));
      }
    });
  }
}
