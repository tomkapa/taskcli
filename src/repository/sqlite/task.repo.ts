import type { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert';
import type { Result } from '../../types/common.js';
import { ok, err } from '../../types/common.js';
import type { Task, CreateTaskInput, UpdateTaskInput, TaskFilter } from '../../types/task.js';
import type { TaskLevel } from '../../types/enums.js';
import {
  RANK_GAP,
  TERMINAL_STATUSES,
  getTaskLevel,
  midpoint,
  WORK_TYPES,
} from '../../types/enums.js';
import { parseSearchQuery } from '../../utils/search-parser.js';
import type { TaskId, ProjectId } from '../../types/branded.js';
import type {
  TaskRepository,
  SearchResult,
  TypeCounts,
  CurrentCounts,
} from '../task.repository.js';
import type { RepositoryError } from '../errors.js';
import { Relevance } from '../relevance.js';
import { MAX_FIND_MANY, MAX_SEARCH_RESULTS, SEARCH_QUERY_LEN } from '../limits.js';
import type { Clock } from '../clock.js';
import { NOT_DELETED, type TaskRow, rowToTask } from './row-mappers.js';
import { repoSpan } from './span.js';
import { type TxnState, bumpWrite } from './txn.js';

const TERMINAL_STATUS_ARRAY = [...TERMINAL_STATUSES];
const TERMINAL_PLACEHOLDERS = TERMINAL_STATUS_ARRAY.map(() => '?').join(', ');

function toTypeCounts(rows: Array<{ type: string; n: number }>): TypeCounts {
  const byType: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    byType[row.type] = row.n;
    total += row.n;
  }
  return { byType, total };
}

function isUniqueConstraint(e: unknown): e is Error {
  return e instanceof Error && e.message.includes('UNIQUE constraint');
}

function transientFrom(e: unknown, op: string): RepositoryError {
  const detail = e instanceof Error ? e.message : String(e);
  return {
    kind: 'transient',
    cause: 'io',
    retryable: true,
    detail: `${op}: ${detail}`,
  };
}

export class SqliteTaskRepository implements TaskRepository {
  constructor(
    private readonly db: DatabaseSync,
    private readonly clock: Clock,
    private readonly txn: TxnState,
  ) {}

  insert(
    id: TaskId,
    input: CreateTaskInput & { projectId: ProjectId },
  ): Result<Task, RepositoryError> {
    return repoSpan('task', 'insert', () => {
      assert(id.length > 0, 'task id must be non-empty');
      assert(input.projectId.length > 0, 'projectId must be non-empty');
      assert(input.name.length > 0, 'task name must be non-empty');

      const limit = bumpWrite(this.txn);
      if (limit) return err(limit);

      try {
        const now = this.clock.nowIso();
        const level = getTaskLevel(input.type);

        const rankResult = this.computeInsertRank(input.projectId, level);
        if (!rankResult.ok) return rankResult;
        const rank = rankResult.value;
        assert(Number.isFinite(rank), 'computed rank must be finite');

        this.db
          .prepare(
            `INSERT INTO tasks (id, project_id, parent_id, name, description, type, status, rank, technical_notes, additional_requirements, created_at, updated_at)
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
            rank,
            input.technicalNotes ?? '',
            input.additionalRequirements ?? '',
            now,
            now,
          );

        const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
          | TaskRow
          | undefined;
        assert(row != null, 'inserted task row must be readable');
        return ok(rowToTask(row));
      } catch (e) {
        return err(transientFrom(e, 'task.insert'));
      }
    });
  }

  findById(id: TaskId): Result<Task | null, RepositoryError> {
    return repoSpan('task', 'find_by_id', () => {
      try {
        const row = this.db
          .prepare(`SELECT * FROM tasks WHERE id = ? AND ${NOT_DELETED}`)
          .get(id) as TaskRow | undefined;
        return ok(row ? rowToTask(row) : null);
      } catch (e) {
        return err(transientFrom(e, 'task.find_by_id'));
      }
    });
  }

  findMany(filter: TaskFilter): Result<Task[], RepositoryError> {
    return repoSpan('task', 'find_many', () => {
      try {
        const conditions: string[] = [NOT_DELETED];
        const params: string[] = [];

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
        if (filter.level !== undefined) {
          const typesForLevel = this.getTypesForLevel(filter.level as TaskLevel);
          const placeholders = typesForLevel.map(() => '?').join(', ');
          conditions.push(`type IN (${placeholders})`);
          params.push(...typesForLevel);
        }
        if (filter.parentId) {
          conditions.push('parent_id = ?');
          params.push(filter.parentId);
        }
        if (filter.parentIds && filter.parentIds.length > 0) {
          const placeholders = filter.parentIds.map(() => '?').join(', ');
          conditions.push(`parent_id IN (${placeholders})`);
          params.push(...filter.parentIds);
        }
        if (filter.search) {
          const parsed = parseSearchQuery(filter.search);
          if (parsed.kind === 'id') {
            conditions.push(`id LIKE ?`);
            params.push(`%${parsed.value}%`);
          } else {
            const ftsQuery = parsed.query
              .split(/\s+/)
              .map((term) => `"${term.replace(/"/g, '""')}"*`)
              .join(' ');
            conditions.push(`id IN (SELECT id FROM tasks_fts WHERE tasks_fts MATCH ?)`);
            params.push(ftsQuery);
          }
        }

        const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `SELECT * FROM tasks ${where} ORDER BY rank ASC LIMIT ?`;

        const rows = this.db.prepare(sql).all(...params, MAX_FIND_MANY + 1) as TaskRow[];
        if (rows.length > MAX_FIND_MANY) {
          return err({
            kind: 'limit_exceeded',
            limit: 'find_many',
            max: MAX_FIND_MANY,
            detail: `findMany returned more than ${MAX_FIND_MANY} rows; refine filter`,
          });
        }
        return ok(rows.map(rowToTask));
      } catch (e) {
        return err(transientFrom(e, 'task.find_many'));
      }
    });
  }

  update(id: TaskId, input: UpdateTaskInput): Result<Task, RepositoryError> {
    return repoSpan('task', 'update', () => {
      assert(id.length > 0, 'task id must be non-empty');

      const limit = bumpWrite(this.txn);
      if (limit) return err(limit);

      try {
        const existing = this.db
          .prepare(`SELECT * FROM tasks WHERE id = ? AND ${NOT_DELETED}`)
          .get(id) as TaskRow | undefined;
        if (!existing) {
          return err({ kind: 'not_found', entity: 'task', id });
        }

        const now = this.clock.nowIso();

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
               name = ?, description = ?, type = ?, status = ?,
               parent_id = ?, technical_notes = ?, additional_requirements = ?, updated_at = ?
             WHERE id = ?`,
          )
          .run(
            input.name ?? existing.name,
            input.description ?? existing.description,
            input.type ?? existing.type,
            input.status ?? existing.status,
            input.parentId !== undefined ? input.parentId : existing.parent_id,
            technicalNotes,
            additionalRequirements,
            now,
            id,
          );

        const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
          | TaskRow
          | undefined;
        assert(row != null, 'updated task row must be readable');
        return ok(rowToTask(row));
      } catch (e) {
        if (isUniqueConstraint(e)) {
          return err({
            kind: 'duplicate',
            entity: 'task',
            key: id,
            detail: `Task already exists: ${id}`,
          });
        }
        return err(transientFrom(e, 'task.update'));
      }
    });
  }

  delete(id: TaskId): Result<void, RepositoryError> {
    return repoSpan('task', 'delete', () => {
      assert(id.length > 0, 'task id must be non-empty');

      const limit = bumpWrite(this.txn);
      if (limit) return err(limit);

      try {
        const existing = this.db
          .prepare(`SELECT * FROM tasks WHERE id = ? AND ${NOT_DELETED}`)
          .get(id) as TaskRow | undefined;
        if (!existing) {
          return err({ kind: 'not_found', entity: 'task', id });
        }
        const now = this.clock.nowIso();
        this.db
          .prepare('UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ?')
          .run(now, now, id);
        return ok(undefined);
      } catch (e) {
        return err(transientFrom(e, 'task.delete'));
      }
    });
  }

  rerank(taskId: TaskId, newRank: number): Result<Task, RepositoryError> {
    return repoSpan('task', 'rerank', () => {
      assert(taskId.length > 0, 'taskId must be non-empty');
      assert(Number.isFinite(newRank), 'newRank must be finite');

      const limit = bumpWrite(this.txn);
      if (limit) return err(limit);

      try {
        const now = this.clock.nowIso();
        const existing = this.db
          .prepare(`SELECT * FROM tasks WHERE id = ? AND ${NOT_DELETED}`)
          .get(taskId) as TaskRow | undefined;
        if (!existing) {
          return err({ kind: 'not_found', entity: 'task', id: taskId });
        }
        this.db
          .prepare('UPDATE tasks SET rank = ?, updated_at = ? WHERE id = ?')
          .run(newRank, now, taskId);

        const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as
          | TaskRow
          | undefined;
        assert(row != null, 'reranked task row must be readable');
        return ok(rowToTask(row));
      } catch (e) {
        return err(transientFrom(e, 'task.rerank'));
      }
    });
  }

  getMaxRank(projectId: ProjectId): Result<number, RepositoryError> {
    return repoSpan('task', 'max_rank', () => {
      try {
        const row = this.db
          .prepare(
            `SELECT MAX(rank) as max_rank FROM tasks WHERE project_id = ? AND ${NOT_DELETED}`,
          )
          .get(projectId) as { max_rank: number | null } | undefined;
        return ok(row?.max_rank ?? 0);
      } catch (e) {
        return err(transientFrom(e, 'task.max_rank'));
      }
    });
  }

  getMaxActiveRank(projectId: ProjectId): Result<number, RepositoryError> {
    return repoSpan('task', 'max_active_rank', () => {
      try {
        const row = this.db
          .prepare(
            `SELECT MAX(rank) as max_rank FROM tasks WHERE project_id = ? AND ${NOT_DELETED} AND status NOT IN (${TERMINAL_PLACEHOLDERS})`,
          )
          .get(projectId, ...TERMINAL_STATUS_ARRAY) as { max_rank: number | null } | undefined;
        return ok(row?.max_rank ?? 0);
      } catch (e) {
        return err(transientFrom(e, 'task.max_active_rank'));
      }
    });
  }

  getMinTerminalRank(projectId: ProjectId): Result<number | null, RepositoryError> {
    return repoSpan('task', 'min_terminal_rank', () => {
      try {
        const row = this.db
          .prepare(
            `SELECT MIN(rank) as min_rank FROM tasks WHERE project_id = ? AND ${NOT_DELETED} AND status IN (${TERMINAL_PLACEHOLDERS})`,
          )
          .get(projectId, ...TERMINAL_STATUS_ARRAY) as { min_rank: number | null } | undefined;
        return ok(row?.min_rank ?? null);
      } catch (e) {
        return err(transientFrom(e, 'task.min_terminal_rank'));
      }
    });
  }

  getRankedTasks(projectId: ProjectId, status?: string): Result<Task[], RepositoryError> {
    return repoSpan('task', 'ranked_tasks', () => {
      try {
        let sql: string;
        let params: string[];
        if (status) {
          sql = `SELECT * FROM tasks WHERE project_id = ? AND ${NOT_DELETED} AND status = ? ORDER BY rank ASC LIMIT ?`;
          params = [projectId, status];
        } else {
          sql = `SELECT * FROM tasks WHERE project_id = ? AND ${NOT_DELETED} ORDER BY rank ASC LIMIT ?`;
          params = [projectId];
        }
        const rows = this.db.prepare(sql).all(...params, MAX_FIND_MANY + 1) as TaskRow[];
        if (rows.length > MAX_FIND_MANY) {
          return err({
            kind: 'limit_exceeded',
            limit: 'find_many',
            max: MAX_FIND_MANY,
            detail: `getRankedTasks exceeded ${MAX_FIND_MANY} rows`,
          });
        }
        return ok(rows.map(rowToTask));
      } catch (e) {
        return err(transientFrom(e, 'task.ranked_tasks'));
      }
    });
  }

  private getTypesForLevel(level: TaskLevel): string[] {
    if (level === 1) return ['release'];
    return [...WORK_TYPES];
  }

  getMaxRankByLevel(projectId: ProjectId, level: TaskLevel): Result<number, RepositoryError> {
    return repoSpan('task', 'max_rank_by_level', () => {
      try {
        const types = this.getTypesForLevel(level);
        const placeholders = types.map(() => '?').join(', ');
        const row = this.db
          .prepare(
            `SELECT MAX(rank) as max_rank FROM tasks WHERE project_id = ? AND ${NOT_DELETED} AND type IN (${placeholders})`,
          )
          .get(projectId, ...types) as { max_rank: number | null } | undefined;
        return ok(row?.max_rank ?? 0);
      } catch (e) {
        return err(transientFrom(e, 'task.max_rank_by_level'));
      }
    });
  }

  getMaxActiveRankByLevel(projectId: ProjectId, level: TaskLevel): Result<number, RepositoryError> {
    return repoSpan('task', 'max_active_rank_by_level', () => {
      try {
        const types = this.getTypesForLevel(level);
        const typePlaceholders = types.map(() => '?').join(', ');
        const row = this.db
          .prepare(
            `SELECT MAX(rank) as max_rank FROM tasks WHERE project_id = ? AND ${NOT_DELETED} AND type IN (${typePlaceholders}) AND status NOT IN (${TERMINAL_PLACEHOLDERS})`,
          )
          .get(projectId, ...types, ...TERMINAL_STATUS_ARRAY) as
          | { max_rank: number | null }
          | undefined;
        return ok(row?.max_rank ?? 0);
      } catch (e) {
        return err(transientFrom(e, 'task.max_active_rank_by_level'));
      }
    });
  }

  getMinTerminalRankByLevel(
    projectId: ProjectId,
    level: TaskLevel,
  ): Result<number | null, RepositoryError> {
    return repoSpan('task', 'min_terminal_rank_by_level', () => {
      try {
        const types = this.getTypesForLevel(level);
        const typePlaceholders = types.map(() => '?').join(', ');
        const row = this.db
          .prepare(
            `SELECT MIN(rank) as min_rank FROM tasks WHERE project_id = ? AND ${NOT_DELETED} AND type IN (${typePlaceholders}) AND status IN (${TERMINAL_PLACEHOLDERS})`,
          )
          .get(projectId, ...types, ...TERMINAL_STATUS_ARRAY) as
          | { min_rank: number | null }
          | undefined;
        return ok(row?.min_rank ?? null);
      } catch (e) {
        return err(transientFrom(e, 'task.min_terminal_rank_by_level'));
      }
    });
  }

  getRankedTasksByLevel(
    projectId: ProjectId,
    level: TaskLevel,
    status?: string,
  ): Result<Task[], RepositoryError> {
    return repoSpan('task', 'ranked_tasks_by_level', () => {
      try {
        const types = this.getTypesForLevel(level);
        const typePlaceholders = types.map(() => '?').join(', ');
        let sql: string;
        let params: string[];
        if (status) {
          sql = `SELECT * FROM tasks WHERE project_id = ? AND ${NOT_DELETED} AND type IN (${typePlaceholders}) AND status = ? ORDER BY rank ASC LIMIT ?`;
          params = [projectId, ...types, status];
        } else {
          sql = `SELECT * FROM tasks WHERE project_id = ? AND ${NOT_DELETED} AND type IN (${typePlaceholders}) ORDER BY rank ASC LIMIT ?`;
          params = [projectId, ...types];
        }
        const rows = this.db.prepare(sql).all(...params, MAX_FIND_MANY + 1) as TaskRow[];
        if (rows.length > MAX_FIND_MANY) {
          return err({
            kind: 'limit_exceeded',
            limit: 'find_many',
            max: MAX_FIND_MANY,
            detail: `getRankedTasksByLevel exceeded ${MAX_FIND_MANY} rows`,
          });
        }
        return ok(rows.map(rowToTask));
      } catch (e) {
        return err(transientFrom(e, 'task.ranked_tasks_by_level'));
      }
    });
  }

  getRankedNonTerminalTasksByLevel(
    projectId: ProjectId,
    level: TaskLevel,
  ): Result<Task[], RepositoryError> {
    return repoSpan('task', 'ranked_non_terminal_by_level', () => {
      try {
        const types = this.getTypesForLevel(level);
        const typePlaceholders = types.map(() => '?').join(', ');
        const sql = `SELECT * FROM tasks WHERE project_id = ? AND ${NOT_DELETED} AND type IN (${typePlaceholders}) AND status NOT IN (${TERMINAL_PLACEHOLDERS}) ORDER BY rank ASC LIMIT ?`;
        const rows = this.db
          .prepare(sql)
          .all(projectId, ...types, ...TERMINAL_STATUS_ARRAY, MAX_FIND_MANY + 1) as TaskRow[];
        if (rows.length > MAX_FIND_MANY) {
          return err({
            kind: 'limit_exceeded',
            limit: 'find_many',
            max: MAX_FIND_MANY,
            detail: `getRankedNonTerminalTasksByLevel exceeded ${MAX_FIND_MANY} rows`,
          });
        }
        return ok(rows.map(rowToTask));
      } catch (e) {
        return err(transientFrom(e, 'task.ranked_non_terminal_by_level'));
      }
    });
  }

  rebalanceByLevel(projectId: ProjectId, level: TaskLevel): Result<void, RepositoryError> {
    return repoSpan('task', 'rebalance_by_level', () => {
      try {
        const types = this.getTypesForLevel(level);
        const typePlaceholders = types.map(() => '?').join(', ');
        // Active tasks first (current rank order), then terminal tasks —
        // this both recovers from precision collapse and repairs any
        // pre-existing interleaved state. The caller decides whether to
        // wrap this in a transaction via withTransaction.
        const rows = this.db
          .prepare(
            `SELECT * FROM tasks
             WHERE project_id = ? AND ${NOT_DELETED} AND type IN (${typePlaceholders})
             ORDER BY
               CASE WHEN status IN (${TERMINAL_PLACEHOLDERS}) THEN 1 ELSE 0 END ASC,
               rank ASC,
               id ASC`,
          )
          .all(projectId, ...types, ...TERMINAL_STATUS_ARRAY) as TaskRow[];

        if (rows.length === 0) return ok(undefined);

        const now = this.clock.nowIso();
        const updateStmt = this.db.prepare(
          'UPDATE tasks SET rank = ?, updated_at = ? WHERE id = ?',
        );

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;
          const newRank = (i + 1) * RANK_GAP;
          if (row.rank === newRank) continue;
          const limit = bumpWrite(this.txn);
          if (limit) return err(limit);
          updateStmt.run(newRank, now, row.id);
        }

        return ok(undefined);
      } catch (e) {
        return err(transientFrom(e, 'task.rebalance_by_level'));
      }
    });
  }

  /**
   * Fetch `(maxActive, minTerminal)` for a level in a single SQL round-trip.
   */
  private getRankBoundsByLevel(
    projectId: ProjectId,
    level: TaskLevel,
  ): Result<{ maxActive: number; minTerminal: number | null }, RepositoryError> {
    try {
      const types = this.getTypesForLevel(level);
      const typePlaceholders = types.map(() => '?').join(', ');
      const row = this.db
        .prepare(
          `SELECT
             MAX(CASE WHEN status NOT IN (${TERMINAL_PLACEHOLDERS}) THEN rank END) AS max_active,
             MIN(CASE WHEN status IN (${TERMINAL_PLACEHOLDERS}) THEN rank END) AS min_terminal
           FROM tasks
           WHERE project_id = ? AND ${NOT_DELETED} AND type IN (${typePlaceholders})`,
        )
        .get(...TERMINAL_STATUS_ARRAY, ...TERMINAL_STATUS_ARRAY, projectId, ...types) as
        | { max_active: number | null; min_terminal: number | null }
        | undefined;
      return ok({
        maxActive: row?.max_active ?? 0,
        minTerminal: row?.min_terminal ?? null,
      });
    } catch (e) {
      return err(transientFrom(e, 'task.rank_bounds_by_level'));
    }
  }

  /**
   * Compute a fresh rank for a new active task at the given level.
   */
  private computeInsertRank(projectId: ProjectId, level: TaskLevel): Result<number, RepositoryError> {
    const attempt = (): Result<number | null, RepositoryError> => {
      const boundsResult = this.getRankBoundsByLevel(projectId, level);
      if (!boundsResult.ok) return boundsResult;
      const { maxActive, minTerminal } = boundsResult.value;

      if (minTerminal === null) {
        return ok(maxActive + RANK_GAP);
      }
      if (minTerminal <= maxActive) {
        return ok(null);
      }
      if (maxActive <= 0) {
        return ok(minTerminal - RANK_GAP);
      }
      return ok(midpoint(maxActive, minTerminal));
    };

    const first = attempt();
    if (!first.ok) return first;
    if (first.value !== null) return ok(first.value);

    const rebalanceResult = this.rebalanceByLevel(projectId, level);
    if (!rebalanceResult.ok) return rebalanceResult;

    const second = attempt();
    if (!second.ok) return second;
    if (second.value === null) {
      return err({
        kind: 'invariant_violated',
        detail: 'Rank computation did not converge after rebalance',
      });
    }
    return ok(second.value);
  }

  search(query: string, projectId?: ProjectId): Result<SearchResult[], RepositoryError> {
    return repoSpan('task', 'search', () => {
      if (query.length > SEARCH_QUERY_LEN) {
        return err({
          kind: 'limit_exceeded',
          limit: 'search',
          max: SEARCH_QUERY_LEN,
          detail: `search query exceeds ${SEARCH_QUERY_LEN} characters`,
        });
      }

      try {
        const parsed = parseSearchQuery(query);

        if (parsed.kind === 'id') {
          const conditions = ['t.id LIKE ?', 't.deleted_at IS NULL'];
          const params: string[] = [`%${parsed.value}%`];
          if (projectId) {
            conditions.push('t.project_id = ?');
            params.push(projectId);
          }
          const sql = `SELECT t.* FROM tasks t WHERE ${conditions.join(' AND ')} ORDER BY t.rank ASC LIMIT ?`;
          const rows = this.db.prepare(sql).all(...params, MAX_SEARCH_RESULTS) as TaskRow[];
          // Id-prefix search has no meaningful relevance; flag all as full match.
          return ok(rows.map((row) => ({ task: rowToTask(row), rank: Relevance.one })));
        }

        const ftsQuery = parsed.query
          .split(/\s+/)
          .map((term) => `"${term.replace(/"/g, '""')}"*`)
          .join(' ');

        let sql: string;
        let params: string[];

        if (projectId) {
          sql = `SELECT t.*, bm25(tasks_fts) AS fts_rank
                 FROM tasks_fts f
                 JOIN tasks t ON t.id = f.id AND t.deleted_at IS NULL
                 WHERE tasks_fts MATCH ? AND t.project_id = ?
                 ORDER BY fts_rank ASC
                 LIMIT ?`;
          params = [ftsQuery, projectId];
        } else {
          sql = `SELECT t.*, bm25(tasks_fts) AS fts_rank
                 FROM tasks_fts f
                 JOIN tasks t ON t.id = f.id AND t.deleted_at IS NULL
                 WHERE tasks_fts MATCH ?
                 ORDER BY fts_rank ASC
                 LIMIT ?`;
          params = [ftsQuery];
        }

        const rows = this.db.prepare(sql).all(...params, MAX_SEARCH_RESULTS) as (TaskRow & {
          fts_rank: number;
        })[];

        // BM25 rank from sqlite FTS5 is unbounded and only comparable
        // within a single result set. Normalize to `[0, 1]` (higher =
        // better) so the raw sqlite score never escapes this module.
        return ok(normalizeBm25(rows));
      } catch (e) {
        return err(transientFrom(e, 'task.search'));
      }
    });
  }

  countCompletedSince(projectId: ProjectId, sinceIso: string): Result<TypeCounts, RepositoryError> {
    return repoSpan('task', 'count_completed_since', () => {
      try {
        const rows = this.db
          .prepare(
            `SELECT type, COUNT(*) as n FROM tasks
             WHERE project_id = ? AND ${NOT_DELETED}
               AND status = 'done' AND updated_at >= ?
             GROUP BY type`,
          )
          .all(projectId, sinceIso) as Array<{ type: string; n: number }>;
        return ok(toTypeCounts(rows));
      } catch (e) {
        return err(transientFrom(e, 'task.count_completed_since'));
      }
    });
  }

  countCreatedSince(projectId: ProjectId, sinceIso: string): Result<TypeCounts, RepositoryError> {
    return repoSpan('task', 'count_created_since', () => {
      try {
        const rows = this.db
          .prepare(
            `SELECT type, COUNT(*) as n FROM tasks
             WHERE project_id = ? AND ${NOT_DELETED} AND created_at >= ?
             GROUP BY type`,
          )
          .all(projectId, sinceIso) as Array<{ type: string; n: number }>;
        return ok(toTypeCounts(rows));
      } catch (e) {
        return err(transientFrom(e, 'task.count_created_since'));
      }
    });
  }

  countCurrent(projectId: ProjectId): Result<CurrentCounts, RepositoryError> {
    return repoSpan('task', 'count_current', () => {
      try {
        const rows = this.db
          .prepare(
            `SELECT status, type, COUNT(*) as n FROM tasks
             WHERE project_id = ? AND ${NOT_DELETED}
             GROUP BY status, type`,
          )
          .all(projectId) as Array<{ status: string; type: string; n: number }>;
        const byType: Record<string, number> = {};
        const byStatus: Record<string, number> = {};
        let total = 0;
        for (const row of rows) {
          byType[row.type] = (byType[row.type] ?? 0) + row.n;
          byStatus[row.status] = (byStatus[row.status] ?? 0) + row.n;
          total += row.n;
        }
        return ok({ byType, byStatus, total });
      } catch (e) {
        return err(transientFrom(e, 'task.count_current'));
      }
    });
  }

  findCompletedSince(projectId: ProjectId, sinceIso: string): Result<Task[], RepositoryError> {
    return repoSpan('task', 'find_completed_since', () => {
      try {
        const rows = this.db
          .prepare(
            `SELECT * FROM tasks
             WHERE project_id = ? AND ${NOT_DELETED}
               AND status = 'done' AND updated_at >= ?
             ORDER BY updated_at DESC
             LIMIT ?`,
          )
          .all(projectId, sinceIso, MAX_FIND_MANY + 1) as TaskRow[];
        if (rows.length > MAX_FIND_MANY) {
          return err({
            kind: 'limit_exceeded',
            limit: 'find_many',
            max: MAX_FIND_MANY,
            detail: `findCompletedSince exceeded ${MAX_FIND_MANY} rows`,
          });
        }
        return ok(rows.map(rowToTask));
      } catch (e) {
        return err(transientFrom(e, 'task.find_completed_since'));
      }
    });
  }
}

/**
 * Convert a set of BM25-ranked rows into normalized `SearchResult[]`.
 * BM25 is negative-is-better and unbounded; we map it to `[0, 1]` where
 * `1` is the best match in this result set. Single-row results get `1`.
 */
function normalizeBm25(rows: Array<TaskRow & { fts_rank: number }>): SearchResult[] {
  if (rows.length === 0) return [];
  const first = rows[0];
  if (rows.length === 1 && first !== undefined) {
    return [{ task: rowToTask(first), rank: Relevance.one }];
  }
  let min = Infinity;
  let max = -Infinity;
  for (const row of rows) {
    if (row.fts_rank < min) min = row.fts_rank;
    if (row.fts_rank > max) max = row.fts_rank;
  }
  const span = Math.max(1e-9, max - min);
  return rows.map((row) => {
    // BM25: lower is better. Flip so 1 = best match in this set.
    const raw = 1 - (row.fts_rank - min) / span;
    const clamped = raw < 0 ? 0 : raw > 1 ? 1 : raw;
    return { task: rowToTask(row), rank: Relevance.of(clamped) };
  });
}
