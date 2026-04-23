import type { PresentedError } from '../types/presented-error.js';

export type RepositoryEntity = 'task' | 'project' | 'dependency';

export type RepositoryLimit = 'search' | 'find_many' | 'txn_ops';

/**
 * Every expected failure at the repository boundary. `throw` is reserved
 * for assertion failures inside implementations; every other failure mode
 * shows up as one of these variants.
 *
 * `kind: 'transient'` is the only variant the caller may retry
 * automatically. All other kinds are either programmer error (wrap, don't
 * retry) or user error (surface).
 */
export type RepositoryError =
  | { readonly kind: 'not_found'; readonly entity: RepositoryEntity; readonly id: string }
  | {
      readonly kind: 'duplicate';
      readonly entity: RepositoryEntity;
      readonly key: string;
      readonly detail: string;
    }
  | {
      readonly kind: 'foreign_key';
      readonly parentEntity: string;
      readonly parentId: string;
      readonly detail: string;
    }
  | { readonly kind: 'invariant_violated'; readonly detail: string }
  | {
      readonly kind: 'limit_exceeded';
      readonly limit: RepositoryLimit;
      readonly max: number;
      readonly detail: string;
    }
  | {
      readonly kind: 'transient';
      readonly cause: 'lock' | 'io' | 'network';
      readonly retryable: true;
      readonly detail: string;
    }
  | {
      readonly kind: 'unavailable';
      readonly cause: 'schema_mismatch' | 'backend_down';
      readonly detail: string;
    };

function capitalize(s: string): string {
  const head = s.charAt(0);
  return head === '' ? s : head.toUpperCase() + s.slice(1);
}

/**
 * Exhaustive switch from `RepositoryError` to the CLI's `{code, message}`
 * output shape. Adding a new variant fails the compile here — and
 * therefore fails every service's `present<Service>Error` that forwards
 * repo-kind errors through.
 */
export function presentRepositoryError(e: RepositoryError): PresentedError {
  switch (e.kind) {
    case 'not_found':
      return { code: 'NOT_FOUND', message: `${capitalize(e.entity)} not found: ${e.id}` };
    case 'duplicate':
      return { code: 'DUPLICATE', message: e.detail };
    case 'foreign_key':
      return { code: 'NOT_FOUND', message: e.detail };
    case 'invariant_violated':
      return { code: 'VALIDATION', message: e.detail };
    case 'limit_exceeded':
      return { code: 'VALIDATION', message: e.detail };
    case 'transient':
      return { code: 'DB_ERROR', message: e.detail };
    case 'unavailable':
      return { code: 'DB_ERROR', message: e.detail };
  }
}
