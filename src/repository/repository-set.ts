import type { Result } from '../types/common.js';
import type { TaskRepository } from './task.repository.js';
import type { ProjectRepository } from './project.repository.js';
import type { DependencyRepository } from './dependency.repository.js';
import type { RepositoryError } from './errors.js';

/**
 * Unit-of-work. The three repositories always move together: a
 * `RepositorySet` is how the service layer gets at them.
 *
 * `withTransaction` is the single entry point for multi-repository
 * atomicity. The callback receives a fresh `RepositorySet` whose
 * repositories are bound to the transaction; callers must use the passed
 * set inside the callback, not the outer one.
 *
 * The interface does not mandate cross-row ACID — only that writes are
 * either all visible to subsequent reads, or none are. The sqlite impl
 * uses BEGIN/COMMIT; an HTTP impl may use a staging endpoint, a batch
 * POST, or degrade to single-statement atomicity.
 */
export interface RepositorySet {
  readonly tasks: TaskRepository;
  readonly projects: ProjectRepository;
  readonly dependencies: DependencyRepository;

  withTransaction<T, E>(fn: (set: RepositorySet) => Result<T, E>): Result<T, E | RepositoryError>;

  close(): void;
}
