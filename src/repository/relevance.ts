import assert from 'node:assert';
import type { Brand } from '../types/branded.js';

export type { Brand };

/**
 * Bounded relevance score for search hits. `0` means "no match", `1` the
 * best match. Normalizing at the boundary prevents backend-specific
 * ranking semantics (sqlite's BM25, Postgres' ts_rank, HTTP backend's
 * custom ranker) from leaking to callers.
 */
export type Relevance = Brand<number, 'Relevance'>;

export const Relevance = {
  of(raw: number): Relevance {
    // Programmer error: the sqlite impl must only emit normalized values.
    assert(
      Number.isFinite(raw) && raw >= 0 && raw <= 1,
      `Relevance out of range [0,1]: ${raw}`,
    );
    return raw as Relevance;
  },
  zero: 0 as Relevance,
  one: 1 as Relevance,
} as const;
