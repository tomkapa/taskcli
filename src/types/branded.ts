declare const __brand: unique symbol;

/**
 * Phantom-branded nominal type. `Brand<T, B>` is structurally a `T` but
 * nominally distinct from any other `Brand<T, _>`. Zero runtime cost.
 */
export type Brand<T, B> = T & { readonly [__brand]: B };

/**
 * Parse failure for id constructors. Returned (not thrown) so the
 * caller's control flow stays explicit at the boundary.
 */
export interface ParseError {
  readonly kind: 'parse_error';
  readonly detail: string;
}

export function isParseError(v: unknown): v is ParseError {
  return (
    typeof v === 'object' &&
    v !== null &&
    'kind' in v &&
    (v as { kind: unknown }).kind === 'parse_error'
  );
}

/**
 * Task id: `<PROJECT_KEY>-<N>` where the key is 2-7 uppercase alphanumerics
 * and `N` is a positive integer. Matches the format produced by
 * `projectService.nextTaskId`.
 */
export type TaskId = Brand<string, 'TaskId'>;

const TASK_ID_MAX = 64;
const TASK_ID_RE = /^[A-Z0-9]{2,7}-\d+$/;

export const TaskId = {
  parse(raw: string): TaskId | ParseError {
    if (raw.length === 0) {
      return { kind: 'parse_error', detail: 'TaskId cannot be empty' };
    }
    if (raw.length > TASK_ID_MAX) {
      return {
        kind: 'parse_error',
        detail: `TaskId exceeds ${TASK_ID_MAX} characters`,
      };
    }
    if (!TASK_ID_RE.test(raw)) {
      return {
        kind: 'parse_error',
        detail: `Invalid TaskId format: ${raw} (expected e.g. ABC-123)`,
      };
    }
    return raw as TaskId;
  },
  /**
   * Escape hatch for trusted DB output inside row-mapper files (which
   * already assert the row shape) and for test fixtures. Never call from
   * service or CLI code.
   */
  unsafe(raw: string): TaskId {
    return raw as TaskId;
  },
} as const;

/**
 * Project id. Generated as a ULID at creation time (see `projectService`),
 * but the brand tolerates any non-empty string up to `PROJECT_ID_MAX` so
 * migration and import flows work too.
 */
export type ProjectId = Brand<string, 'ProjectId'>;

const PROJECT_ID_MAX = 64;

export const ProjectId = {
  parse(raw: string): ProjectId | ParseError {
    if (raw.length === 0) {
      return { kind: 'parse_error', detail: 'ProjectId cannot be empty' };
    }
    if (raw.length > PROJECT_ID_MAX) {
      return {
        kind: 'parse_error',
        detail: `ProjectId exceeds ${PROJECT_ID_MAX} characters`,
      };
    }
    return raw as ProjectId;
  },
  unsafe(raw: string): ProjectId {
    return raw as ProjectId;
  },
} as const;

/**
 * Dependency id is the composite `${taskId}->${dependsOnId}`. There is no
 * stored single-column id, but callers sometimes need a portable
 * representation (e.g. error messages, logs, export). The constructor
 * takes the already-branded parts.
 */
export type DependencyId = Brand<string, 'DependencyId'>;

export const DependencyId = {
  of(taskId: TaskId, dependsOnId: TaskId): DependencyId {
    return `${taskId}->${dependsOnId}` as DependencyId;
  },
  unsafe(raw: string): DependencyId {
    return raw as DependencyId;
  },
} as const;
