import type { Result } from '../types/common.js';
import type { TaskDependency } from '../types/dependency.js';
import type { Task } from '../types/task.js';
import type { DependencyType } from '../types/enums.js';
import type { TaskId } from '../types/branded.js';
import type { RepositoryError } from './errors.js';

export interface DependencyRepository {
  insert(
    taskId: TaskId,
    dependsOnId: TaskId,
    type: DependencyType,
  ): Result<TaskDependency, RepositoryError>;
  delete(taskId: TaskId, dependsOnId: TaskId): Result<void, RepositoryError>;
  findByTask(taskId: TaskId): Result<TaskDependency[], RepositoryError>;
  findDependents(taskId: TaskId): Result<TaskDependency[], RepositoryError>;
  /** Tasks that block taskId (taskId depends on them via 'blocks' type). */
  getBlockers(taskId: TaskId): Result<Task[], RepositoryError>;
  /** Tasks that taskId blocks (they depend on taskId via 'blocks' type). */
  getDependents(taskId: TaskId): Result<Task[], RepositoryError>;
  /** Tasks related to taskId via 'relates-to' in either direction. */
  getRelated(taskId: TaskId): Result<Task[], RepositoryError>;
  /** Tasks connected to taskId via 'duplicates' in either direction. */
  getDuplicates(taskId: TaskId): Result<Task[], RepositoryError>;
  /** Returns all transitive blockers using recursive CTE */
  getTransitiveClosure(taskId: TaskId): Result<Task[], RepositoryError>;
  /** Checks if adding an edge would create a cycle */
  wouldCreateCycle(taskId: TaskId, dependsOnId: TaskId): Result<boolean, RepositoryError>;
}
