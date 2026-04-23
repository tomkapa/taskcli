import assert from 'node:assert';
import type { RepositoryError } from '../errors.js';
import { MAX_TXN_OPS } from '../limits.js';

/**
 * Per-transaction state shared by the three sqlite repositories inside a
 * `withTransaction` callback. Tracks write count so the boundary can fail
 * fast on over-sized batches instead of holding a long write lock.
 */
export interface TxnState {
  active: boolean;
  writes: number;
}

export function newTxnState(): TxnState {
  return { active: false, writes: 0 };
}

/**
 * Record a pending write. Returns a `limit_exceeded` error when the cap
 * would be crossed; callers must return the error rather than proceed.
 */
export function bumpWrite(state: TxnState): RepositoryError | null {
  if (!state.active) return null;
  assert(Number.isFinite(state.writes), 'TxnState.writes must be a finite number');
  assert(state.writes >= 0, 'TxnState.writes must be non-negative');
  if (state.writes >= MAX_TXN_OPS) {
    return {
      kind: 'limit_exceeded',
      limit: 'txn_ops',
      max: MAX_TXN_OPS,
      detail: `withTransaction wrote more than ${MAX_TXN_OPS} rows`,
    };
  }
  state.writes += 1;
  return null;
}
