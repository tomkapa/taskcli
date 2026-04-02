import type Database from 'better-sqlite3';
import type { Result } from '../types/common.js';
import { ok, err } from '../types/common.js';
import type { Task, CreateTaskInput, UpdateTaskInput, TaskFilter } from '../types/task.js';
import type { TaskStatus, TaskType } from '../types/enums.js';
import { AppError } from '../errors/app-error.js';
import { ulid } from 'ulid';
import { logger } from '../logging/logger.js';

interface TaskRow {
  id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  description: string;
  type: string;
  status: string;
  priority: number;
  technical_notes: string;
  additional_requirements: string;
  created_at: string;
  updated_at: string;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    parentId: row.parent_id,
    name: row.name,
    description: row.description,
    type: row.type as TaskType,
    status: row.status as TaskStatus,
    priority: row.priority,
    technicalNotes: row.technical_notes,
    additionalRequirements: row.additional_requirements,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface TaskRepository {
  insert(input: CreateTaskInput & { projectId: string }): Result<Task>;
  findById(id: string): Result<Task | null>;
  findMany(filter: TaskFilter): Result<Task[]>;
  update(id: string, input: UpdateTaskInput): Result<Task>;
  delete(id: string): Result<void>;
}

export class SqliteTaskRepository implements TaskRepository {
  constructor(private readonly db: Database.Database) {}

  insert(input: CreateTaskInput & { projectId: string }): Result<Task> {
    return logger.startSpan('TaskRepository.insert', () => {
      try {
        const now = new Date().toISOString();
        const id = ulid();

        this.db
          .prepare(
            `INSERT INTO tasks (id, project_id, parent_id, name, description, type, status, priority, technical_notes, additional_requirements, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            id,
            input.projectId,
            input.parentId ?? null,
            input.name,
            input.description ?? '',
            input.type,
            input.status,
            input.priority,
            input.technicalNotes ?? '',
            input.additionalRequirements ?? '',
            now,
            now,
          );

        const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
          | TaskRow
          | undefined;
        if (!row) {
          return err(new AppError('DB_ERROR', 'Failed to retrieve inserted task'));
        }
        return ok(rowToTask(row));
      } catch (e) {
        return err(new AppError('DB_ERROR', 'Failed to insert task', e));
      }
    });
  }

  findById(id: string): Result<Task | null> {
    try {
      const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
        | TaskRow
        | undefined;
      return ok(row ? rowToTask(row) : null);
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to find task by id', e));
    }
  }

  findMany(filter: TaskFilter): Result<Task[]> {
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (filter.projectId) {
        conditions.push('project_id = ?');
        params.push(filter.projectId);
      }
      if (filter.status) {
        conditions.push('status = ?');
        params.push(filter.status);
      }
      if (filter.type) {
        conditions.push('type = ?');
        params.push(filter.type);
      }
      if (filter.priority) {
        conditions.push('priority = ?');
        params.push(filter.priority);
      }
      if (filter.parentId) {
        conditions.push('parent_id = ?');
        params.push(filter.parentId);
      }
      if (filter.search) {
        conditions.push('(name LIKE ? OR description LIKE ? OR technical_notes LIKE ?)');
        const searchTerm = `%${filter.search}%`;
        params.push(searchTerm, searchTerm, searchTerm);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `SELECT * FROM tasks ${where} ORDER BY priority ASC, created_at DESC`;

      const rows = this.db.prepare(sql).all(...params) as TaskRow[];
      return ok(rows.map(rowToTask));
    } catch (e) {
      return err(new AppError('DB_ERROR', 'Failed to list tasks', e));
    }
  }

  update(id: string, input: UpdateTaskInput): Result<Task> {
    return logger.startSpan('TaskRepository.update', () => {
      try {
        const existing = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
          | TaskRow
          | undefined;
        if (!existing) {
          return err(new AppError('NOT_FOUND', `Task not found: ${id}`));
        }

        const now = new Date().toISOString();

        let technicalNotes = input.technicalNotes ?? existing.technical_notes;
        if (input.appendNotes) {
          technicalNotes =
            existing.technical_notes +
            (existing.technical_notes ? `\n\n---\n_${now}_\n\n` : '') +
            input.appendNotes;
        }

        let additionalRequirements =
          input.additionalRequirements ?? existing.additional_requirements;
        if (input.appendRequirements) {
          additionalRequirements =
            existing.additional_requirements +
            (existing.additional_requirements ? `\n\n---\n_${now}_\n\n` : '') +
            input.appendRequirements;
        }

        this.db
          .prepare(
            `UPDATE tasks SET
               name = ?, description = ?, type = ?, status = ?, priority = ?,
               parent_id = ?, technical_notes = ?, additional_requirements = ?, updated_at = ?
             WHERE id = ?`,
          )
          .run(
            input.name ?? existing.name,
            input.description ?? existing.description,
            input.type ?? existing.type,
            input.status ?? existing.status,
            input.priority ?? existing.priority,
            input.parentId !== undefined ? input.parentId : existing.parent_id,
            technicalNotes,
            additionalRequirements,
            now,
            id,
          );

        const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
          | TaskRow
          | undefined;
        if (!row) {
          return err(new AppError('DB_ERROR', 'Failed to retrieve updated task'));
        }
        return ok(rowToTask(row));
      } catch (e) {
        return err(new AppError('DB_ERROR', 'Failed to update task', e));
      }
    });
  }

  delete(id: string): Result<void> {
    return logger.startSpan('TaskRepository.delete', () => {
      try {
        const existing = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
          | TaskRow
          | undefined;
        if (!existing) {
          return err(new AppError('NOT_FOUND', `Task not found: ${id}`));
        }
        this.db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
        return ok(undefined);
      } catch (e) {
        return err(new AppError('DB_ERROR', 'Failed to delete task', e));
      }
    });
  }
}
