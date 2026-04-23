import type { Result } from '../types/common.js';
import type { Task, CreateTaskInput, UpdateTaskInput, TaskFilter } from '../types/task.js';
import type { TaskLevel } from '../types/enums.js';
import type { TaskId, ProjectId } from '../types/branded.js';
import type { RepositoryError } from './errors.js';
import type { Relevance } from './relevance.js';

export interface SearchResult {
  task: Task;
  /** Normalized relevance score in `[0, 1]`; higher is better. */
  rank: Relevance;
}

export interface TypeCounts {
  byType: Record<string, number>;
  total: number;
}

export interface CurrentCounts {
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  total: number;
}

export interface TaskRepository {
  insert(
    id: TaskId,
    input: CreateTaskInput & { projectId: ProjectId },
  ): Result<Task, RepositoryError>;
  findById(id: TaskId): Result<Task | null, RepositoryError>;
  findMany(filter: TaskFilter): Result<Task[], RepositoryError>;
  update(id: TaskId, input: UpdateTaskInput): Result<Task, RepositoryError>;
  delete(id: TaskId): Result<void, RepositoryError>;
  rerank(taskId: TaskId, newRank: number): Result<Task, RepositoryError>;
  getMaxRank(projectId: ProjectId): Result<number, RepositoryError>;
  /** Max rank among non-terminal (not done/cancelled) tasks. Returns 0 if none. */
  getMaxActiveRank(projectId: ProjectId): Result<number, RepositoryError>;
  /** Min rank among terminal (done/cancelled) tasks. Returns null if none. */
  getMinTerminalRank(projectId: ProjectId): Result<number | null, RepositoryError>;
  getRankedTasks(projectId: ProjectId, status?: string): Result<Task[], RepositoryError>;
  /** Level-aware max rank (scoped to types matching the given level). */
  getMaxRankByLevel(
    projectId: ProjectId,
    level: TaskLevel,
  ): Result<number, RepositoryError>;
  /** Level-aware max active rank. */
  getMaxActiveRankByLevel(
    projectId: ProjectId,
    level: TaskLevel,
  ): Result<number, RepositoryError>;
  /** Level-aware min terminal rank. */
  getMinTerminalRankByLevel(
    projectId: ProjectId,
    level: TaskLevel,
  ): Result<number | null, RepositoryError>;
  /** Ranked tasks filtered to the same level. */
  getRankedTasksByLevel(
    projectId: ProjectId,
    level: TaskLevel,
    status?: string,
  ): Result<Task[], RepositoryError>;
  /** Ranked non-terminal tasks filtered to the same level. */
  getRankedNonTerminalTasksByLevel(
    projectId: ProjectId,
    level: TaskLevel,
  ): Result<Task[], RepositoryError>;
  /**
   * Redistribute ranks at the given level so every active task sits
   * strictly below every terminal task, separated by clean `RANK_GAP`
   * intervals. Does NOT open a transaction internally; callers wrap with
   * `withTransaction` when they need atomicity.
   */
  rebalanceByLevel(
    projectId: ProjectId,
    level: TaskLevel,
  ): Result<void, RepositoryError>;
  /**
   * FTS5 ranked search across all text fields. Results are sorted
   * best-first and every entry carries a bounded `Relevance` score
   * (higher is better).
   */
  search(query: string, projectId?: ProjectId): Result<SearchResult[], RepositoryError>;
  countCompletedSince(
    projectId: ProjectId,
    sinceIso: string,
  ): Result<TypeCounts, RepositoryError>;
  countCreatedSince(
    projectId: ProjectId,
    sinceIso: string,
  ): Result<TypeCounts, RepositoryError>;
  countCurrent(projectId: ProjectId): Result<CurrentCounts, RepositoryError>;
  findCompletedSince(
    projectId: ProjectId,
    sinceIso: string,
  ): Result<Task[], RepositoryError>;
}
