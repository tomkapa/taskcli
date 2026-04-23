import type { Result } from '../types/common.js';
import type { PresentedError } from '../types/presented-error.js';
import type { RepositoryError } from '../repository/errors.js';
import { presentRepositoryError } from '../repository/errors.js';
import type { TaskId } from '../types/branded.js';

// ── TaskService ───────────────────────────────────────────────────────

export type TaskServiceError =
  | { readonly kind: 'not_found'; readonly id: TaskId; readonly message: string }
  | { readonly kind: 'validation'; readonly detail: string; readonly message: string }
  | { readonly kind: 'dep_failed'; readonly cause: DependencyServiceError; readonly message: string }
  | { readonly kind: 'repo'; readonly cause: RepositoryError; readonly message: string };

export const TaskErr = {
  notFound(id: TaskId): TaskServiceError {
    return { kind: 'not_found', id, message: `Task not found: ${id}` };
  },
  validation(detail: string): TaskServiceError {
    return { kind: 'validation', detail, message: detail };
  },
  depFailed(cause: DependencyServiceError): TaskServiceError {
    return {
      kind: 'dep_failed',
      cause,
      message: presentDependencyServiceError(cause).message,
    };
  },
  repo(cause: RepositoryError): TaskServiceError {
    return { kind: 'repo', cause, message: presentRepositoryError(cause).message };
  },
} as const;

export function presentTaskServiceError(e: TaskServiceError): PresentedError {
  switch (e.kind) {
    case 'not_found':
      return { code: 'NOT_FOUND', message: e.message };
    case 'validation':
      return { code: 'VALIDATION', message: e.message };
    case 'dep_failed':
      return presentDependencyServiceError(e.cause);
    case 'repo':
      return presentRepositoryError(e.cause);
  }
}

export function mapTaskRepo<T>(
  r: Result<T, RepositoryError>,
): Result<T, TaskServiceError> {
  return r.ok ? r : { ok: false, error: TaskErr.repo(r.error) };
}

// ── ProjectService ────────────────────────────────────────────────────

export type ProjectServiceError =
  | { readonly kind: 'not_found'; readonly idOrName: string; readonly message: string }
  | { readonly kind: 'duplicate'; readonly key: string; readonly message: string }
  | { readonly kind: 'validation'; readonly detail: string; readonly message: string }
  | { readonly kind: 'git_remote_missing'; readonly message: string }
  | { readonly kind: 'repo'; readonly cause: RepositoryError; readonly message: string };

export const ProjectErr = {
  notFound(idOrName: string, message?: string): ProjectServiceError {
    return {
      kind: 'not_found',
      idOrName,
      message: message ?? `Project not found: ${idOrName}`,
    };
  },
  duplicate(key: string, message?: string): ProjectServiceError {
    return {
      kind: 'duplicate',
      key,
      message: message ?? `Project key already exists: ${key}`,
    };
  },
  validation(detail: string): ProjectServiceError {
    return { kind: 'validation', detail, message: detail };
  },
  gitRemoteMissing(message: string): ProjectServiceError {
    return { kind: 'git_remote_missing', message };
  },
  repo(cause: RepositoryError): ProjectServiceError {
    return { kind: 'repo', cause, message: presentRepositoryError(cause).message };
  },
} as const;

export function presentProjectServiceError(e: ProjectServiceError): PresentedError {
  switch (e.kind) {
    case 'not_found':
      return { code: 'NOT_FOUND', message: e.message };
    case 'duplicate':
      return { code: 'DUPLICATE', message: e.message };
    case 'validation':
      return { code: 'VALIDATION', message: e.message };
    case 'git_remote_missing':
      return { code: 'NOT_FOUND', message: e.message };
    case 'repo':
      return presentRepositoryError(e.cause);
  }
}

export function mapProjectRepo<T>(
  r: Result<T, RepositoryError>,
): Result<T, ProjectServiceError> {
  return r.ok ? r : { ok: false, error: ProjectErr.repo(r.error) };
}

// ── DependencyService ─────────────────────────────────────────────────

export type DependencyServiceError =
  | { readonly kind: 'task_not_found'; readonly taskId: TaskId; readonly message: string }
  | { readonly kind: 'validation'; readonly detail: string; readonly message: string }
  | { readonly kind: 'cycle'; readonly taskId: TaskId; readonly dependsOnId: TaskId; readonly message: string }
  | { readonly kind: 'not_found'; readonly detail: string; readonly message: string }
  | { readonly kind: 'duplicate'; readonly detail: string; readonly message: string }
  | { readonly kind: 'repo'; readonly cause: RepositoryError; readonly message: string };

export const DepErr = {
  taskNotFound(taskId: TaskId): DependencyServiceError {
    return { kind: 'task_not_found', taskId, message: `Task not found: ${taskId}` };
  },
  validation(detail: string): DependencyServiceError {
    return { kind: 'validation', detail, message: detail };
  },
  cycle(taskId: TaskId, dependsOnId: TaskId): DependencyServiceError {
    return {
      kind: 'cycle',
      taskId,
      dependsOnId,
      message: `Adding this dependency would create a cycle: ${taskId} -> ${dependsOnId}`,
    };
  },
  notFound(detail: string): DependencyServiceError {
    return { kind: 'not_found', detail, message: detail };
  },
  duplicate(detail: string): DependencyServiceError {
    return { kind: 'duplicate', detail, message: detail };
  },
  repo(cause: RepositoryError): DependencyServiceError {
    // Repo-level not_found / duplicate bubble up as the corresponding
    // service-level variants so the CLI code field stays stable.
    if (cause.kind === 'not_found') {
      return { kind: 'not_found', detail: presentRepositoryError(cause).message, message: presentRepositoryError(cause).message };
    }
    if (cause.kind === 'duplicate') {
      return { kind: 'duplicate', detail: cause.detail, message: cause.detail };
    }
    if (cause.kind === 'foreign_key') {
      return { kind: 'not_found', detail: cause.detail, message: cause.detail };
    }
    if (cause.kind === 'invariant_violated') {
      return { kind: 'validation', detail: cause.detail, message: cause.detail };
    }
    return { kind: 'repo', cause, message: presentRepositoryError(cause).message };
  },
} as const;

export function presentDependencyServiceError(e: DependencyServiceError): PresentedError {
  switch (e.kind) {
    case 'task_not_found':
      return { code: 'NOT_FOUND', message: e.message };
    case 'validation':
      return { code: 'VALIDATION', message: e.message };
    case 'cycle':
      return { code: 'VALIDATION', message: e.message };
    case 'not_found':
      return { code: 'NOT_FOUND', message: e.message };
    case 'duplicate':
      return { code: 'DUPLICATE', message: e.message };
    case 'repo':
      return presentRepositoryError(e.cause);
  }
}

export function mapDepRepo<T>(
  r: Result<T, RepositoryError>,
): Result<T, DependencyServiceError> {
  return r.ok ? r : { ok: false, error: DepErr.repo(r.error) };
}

// ── AnalyticService ───────────────────────────────────────────────────

export type AnalyticServiceError =
  | { readonly kind: 'validation'; readonly detail: string; readonly message: string }
  | { readonly kind: 'repo'; readonly cause: RepositoryError; readonly message: string };

export const AnalyticErr = {
  validation(detail: string): AnalyticServiceError {
    return { kind: 'validation', detail, message: detail };
  },
  repo(cause: RepositoryError): AnalyticServiceError {
    return { kind: 'repo', cause, message: presentRepositoryError(cause).message };
  },
} as const;

export function presentAnalyticServiceError(e: AnalyticServiceError): PresentedError {
  switch (e.kind) {
    case 'validation':
      return { code: 'VALIDATION', message: e.message };
    case 'repo':
      return presentRepositoryError(e.cause);
  }
}

export function mapAnalyticRepo<T>(
  r: Result<T, RepositoryError>,
): Result<T, AnalyticServiceError> {
  return r.ok ? r : { ok: false, error: AnalyticErr.repo(r.error) };
}

// ── PortabilityService ────────────────────────────────────────────────

export type PortabilityServiceError =
  | { readonly kind: 'validation'; readonly detail: string; readonly message: string }
  | { readonly kind: 'task_service'; readonly cause: TaskServiceError; readonly message: string }
  | {
      readonly kind: 'dep_service';
      readonly cause: DependencyServiceError;
      readonly message: string;
    };

export const PortabilityErr = {
  validation(detail: string): PortabilityServiceError {
    return { kind: 'validation', detail, message: detail };
  },
  taskService(cause: TaskServiceError): PortabilityServiceError {
    return {
      kind: 'task_service',
      cause,
      message: presentTaskServiceError(cause).message,
    };
  },
  depService(cause: DependencyServiceError): PortabilityServiceError {
    return {
      kind: 'dep_service',
      cause,
      message: presentDependencyServiceError(cause).message,
    };
  },
} as const;

export function presentPortabilityServiceError(e: PortabilityServiceError): PresentedError {
  switch (e.kind) {
    case 'validation':
      return { code: 'VALIDATION', message: e.message };
    case 'task_service':
      return presentTaskServiceError(e.cause);
    case 'dep_service':
      return presentDependencyServiceError(e.cause);
  }
}

// ── UpdateService ─────────────────────────────────────────────────────

export type UpdateServiceError =
  | { readonly kind: 'network'; readonly detail: string; readonly message: string }
  | { readonly kind: 'parse_failure'; readonly detail: string; readonly message: string }
  | { readonly kind: 'upgrade_failed'; readonly detail: string; readonly message: string };

export const UpdateErr = {
  network(detail: string): UpdateServiceError {
    return { kind: 'network', detail, message: detail };
  },
  parseFailure(detail: string): UpdateServiceError {
    return { kind: 'parse_failure', detail, message: detail };
  },
  upgradeFailed(detail: string): UpdateServiceError {
    return { kind: 'upgrade_failed', detail, message: detail };
  },
} as const;

export function presentUpdateServiceError(e: UpdateServiceError): PresentedError {
  switch (e.kind) {
    case 'network':
    case 'parse_failure':
    case 'upgrade_failed':
      return { code: 'UPGRADE_CHECK', message: e.message };
  }
}

// ── CLI-layer errors ──────────────────────────────────────────────────

/** Errors produced before a service is invoked (arg parsing, file reads). */
export type CliError =
  | { readonly kind: 'validation'; readonly detail: string; readonly message: string }
  | { readonly kind: 'io'; readonly detail: string; readonly message: string };

export const CliErr = {
  validation(detail: string): CliError {
    return { kind: 'validation', detail, message: detail };
  },
  io(detail: string): CliError {
    return { kind: 'io', detail, message: detail };
  },
} as const;

export function presentCliError(e: CliError): PresentedError {
  switch (e.kind) {
    case 'validation':
      return { code: 'VALIDATION', message: e.message };
    case 'io':
      return { code: 'UNKNOWN', message: e.message };
  }
}
