import type Database from 'better-sqlite3';
import type { Result } from '../types/common.js';
import { ok, err } from '../types/common.js';
import type { Project, CreateProjectInput, UpdateProjectInput } from '../types/project.js';
import { AppError } from '../errors/app-error.js';
import { ulid } from 'ulid';
import { logger } from '../logging/logger.js';

interface ProjectRow {
  id: string;
  name: string;
  description: string;
  is_default: number;
  created_at: string;
  updated_at: string;
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ProjectRepository {
  insert(input: CreateProjectInput): Result<Project>;
  findById(id: string): Result<Project | null>;
  findByName(name: string): Result<Project | null>;
  findDefault(): Result<Project | null>;
  findAll(): Result<Project[]>;
  update(id: string, input: UpdateProjectInput): Result<Project>;
  delete(id: string): Result<void>;
}

export class SqliteProjectRepository implements ProjectRepository {
  constructor(private readonly db: Database.Database) {}

  insert(input: CreateProjectInput): Result<Project> {
    return logger.startSpan('ProjectRepository.insert', () => {
      try {
        const now = new Date().toISOString();
        const id = ulid();

        if (input.isDefault) {
          this.db.prepare('UPDATE projects SET is_default = 0 WHERE is_default = 1').run();
        }

        this.db
          .prepare(
            `INSERT INTO projects (id, name, description, is_default, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(id, input.name, input.description ?? '', input.isDefault ? 1 : 0, now, now);

        const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as
          | ProjectRow
          | undefined;
        if (!row) {
          return err(new AppError('DB_ERROR', 'Failed to retrieve inserted project'));
        }
        return ok(rowToProject(row));
      } catch (e) {
        if (e instanceof Error && e.message.includes('UNIQUE constraint')) {
          return err(new AppError('DUPLICATE', `Project name already exists: ${input.name}`, e));
        }
        return err(new AppError('DB_ERROR', 'Failed to insert project', e));
      }
    });
  }

  findById(id: string): Result<Project | null> {
    try {
      const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as
        | ProjectRow
        | undefined;
      return ok(row ? rowToProject(row) : null);
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to find project by id', e));
    }
  }

  findByName(name: string): Result<Project | null> {
    try {
      const row = this.db.prepare('SELECT * FROM projects WHERE name = ?').get(name) as
        | ProjectRow
        | undefined;
      return ok(row ? rowToProject(row) : null);
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to find project by name', e));
    }
  }

  findDefault(): Result<Project | null> {
    try {
      const row = this.db.prepare('SELECT * FROM projects WHERE is_default = 1').get() as
        | ProjectRow
        | undefined;
      return ok(row ? rowToProject(row) : null);
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to find default project', e));
    }
  }

  findAll(): Result<Project[]> {
    try {
      const rows = this.db
        .prepare('SELECT * FROM projects ORDER BY created_at DESC')
        .all() as ProjectRow[];
      return ok(rows.map(rowToProject));
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to list projects', e));
    }
  }

  update(id: string, input: UpdateProjectInput): Result<Project> {
    return logger.startSpan('ProjectRepository.update', () => {
      try {
        const existing = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as
          | ProjectRow
          | undefined;
        if (!existing) {
          return err(new AppError('NOT_FOUND', `Project not found: ${id}`));
        }

        const now = new Date().toISOString();

        if (input.isDefault) {
          this.db.prepare('UPDATE projects SET is_default = 0 WHERE is_default = 1').run();
        }

        this.db
          .prepare(
            `UPDATE projects SET
               name = ?, description = ?, is_default = ?, updated_at = ?
             WHERE id = ?`,
          )
          .run(
            input.name ?? existing.name,
            input.description ?? existing.description,
            input.isDefault !== undefined ? (input.isDefault ? 1 : 0) : existing.is_default,
            now,
            id,
          );

        const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as
          | ProjectRow
          | undefined;
        if (!row) {
          return err(new AppError('DB_ERROR', 'Failed to retrieve updated project'));
        }
        return ok(rowToProject(row));
      } catch (e) {
        if (e instanceof Error && e.message.includes('UNIQUE constraint')) {
          return err(new AppError('DUPLICATE', `Project name already exists`, e));
        }
        return err(new AppError('DB_ERROR', 'Failed to update project', e));
      }
    });
  }

  delete(id: string): Result<void> {
    return logger.startSpan('ProjectRepository.delete', () => {
      try {
        const existing = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as
          | ProjectRow
          | undefined;
        if (!existing) {
          return err(new AppError('NOT_FOUND', `Project not found: ${id}`));
        }
        this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
        return ok(undefined);
      } catch (e) {
        return err(new AppError('DB_ERROR', 'Failed to delete project', e));
      }
    });
  }
}
