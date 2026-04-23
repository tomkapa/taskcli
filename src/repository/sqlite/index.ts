import type { DatabaseSync } from 'node:sqlite';
import assert from 'node:assert';
import type { Result } from '../../types/common.js';
import type { RepositorySet } from '../repository-set.js';
import type { RepositoryError } from '../errors.js';
import { type Clock, systemClock } from '../clock.js';
import { SqliteTaskRepository } from './task.repo.js';
import { SqliteProjectRepository } from './project.repo.js';
import { SqliteDependencyRepository } from './dependency.repo.js';
import { type TxnState, newTxnState } from './txn.js';

export interface SqliteRepositorySetOptions {
  clock?: Clock;
}

/**
 * Construct the sqlite-backed `RepositorySet`. The resulting set exposes
 * the three repositories and the single `withTransaction` entry point.
 *
 * `clock` defaults to the system clock; tests pass a fake clock.
 *
 * The caller owns the `DatabaseSync` lifecycle — migrations must have
 * been applied before the set is used. `close()` on the set closes the
 * underlying database.
 */
export function createSqliteRepositorySet(
  db: DatabaseSync,
  options: SqliteRepositorySetOptions = {},
): RepositorySet {
  const clock = options.clock ?? systemClock;
  const rootTxn: TxnState = newTxnState();
  return new SqliteRepositorySet(db, clock, rootTxn);
}

class SqliteRepositorySet implements RepositorySet {
  readonly tasks: SqliteTaskRepository;
  readonly projects: SqliteProjectRepository;
  readonly dependencies: SqliteDependencyRepository;

  constructor(
    private readonly db: DatabaseSync,
    private readonly clock: Clock,
    private readonly txn: TxnState,
  ) {
    this.tasks = new SqliteTaskRepository(db, clock, txn);
    this.projects = new SqliteProjectRepository(db, clock, txn);
    this.dependencies = new SqliteDependencyRepository(db, clock, txn);
  }

  withTransaction<T, E>(fn: (set: RepositorySet) => Result<T, E>): Result<T, E | RepositoryError> {
    assert(!this.txn.active, 'withTransaction: nested transactions are not supported');

    const childTxn: TxnState = { active: true, writes: 0 };
    const child = new SqliteRepositorySet(this.db, this.clock, childTxn);

    this.db.exec('BEGIN');
    let result: Result<T, E | RepositoryError>;
    try {
      result = fn(child);
    } catch (e) {
      // Assertions and unexpected throws must leave the DB in a clean
      // state. Roll back, then re-throw — the supervisor (CLI entry or
      // future daemon) restarts the process.
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // Already rolled back; swallow so the original cause surfaces.
      }
      throw e;
    }

    if (result.ok) {
      this.db.exec('COMMIT');
    } else {
      this.db.exec('ROLLBACK');
    }
    return result;
  }

  close(): void {
    this.db.close();
  }
}
