import { describe, it, expect } from 'vitest';
import {
  TaskErr,
  ProjectErr,
  DepErr,
  AnalyticErr,
  PortabilityErr,
  UpdateErr,
  CliErr,
  presentTaskServiceError,
  presentProjectServiceError,
  presentDependencyServiceError,
  presentAnalyticServiceError,
  presentPortabilityServiceError,
  presentUpdateServiceError,
  presentCliError,
  type TaskServiceError,
  type ProjectServiceError,
  type DependencyServiceError,
  type AnalyticServiceError,
  type PortabilityServiceError,
  type UpdateServiceError,
  type CliError,
} from '../../src/service/errors.js';
import { TaskId } from '../../src/types/branded.js';

describe('service error unions', () => {
  it('every TaskServiceError kind presents with a non-empty message', () => {
    const taskId = TaskId.unsafe('TST-1');
    const samples: TaskServiceError[] = [
      TaskErr.notFound(taskId),
      TaskErr.validation('bad'),
      TaskErr.depFailed(DepErr.validation('v')),
      TaskErr.repo({ kind: 'not_found', entity: 'task', id: 'TST-1' }),
    ];
    for (const e of samples) {
      const p = presentTaskServiceError(e);
      expect(p.message.length).toBeGreaterThan(0);
      expect(p.code).toBeTruthy();
    }
  });

  it('every ProjectServiceError kind presents', () => {
    const samples: ProjectServiceError[] = [
      ProjectErr.notFound('X'),
      ProjectErr.duplicate('K'),
      ProjectErr.validation('v'),
      ProjectErr.gitRemoteMissing('no remote'),
      ProjectErr.repo({ kind: 'not_found', entity: 'project', id: 'X' }),
    ];
    for (const e of samples) {
      const p = presentProjectServiceError(e);
      expect(p.message.length).toBeGreaterThan(0);
    }
  });

  it('every DependencyServiceError kind presents', () => {
    const taskId = TaskId.unsafe('TST-1');
    const otherId = TaskId.unsafe('TST-2');
    const samples: DependencyServiceError[] = [
      DepErr.taskNotFound(taskId),
      DepErr.validation('v'),
      DepErr.cycle(taskId, otherId),
      DepErr.notFound('missing'),
      DepErr.duplicate('dup'),
      DepErr.repo({
        kind: 'transient',
        cause: 'io',
        retryable: true,
        detail: 'io',
      }),
    ];
    for (const e of samples) {
      const p = presentDependencyServiceError(e);
      expect(p.message.length).toBeGreaterThan(0);
    }
  });

  it('every AnalyticServiceError kind presents', () => {
    const samples: AnalyticServiceError[] = [
      AnalyticErr.validation('v'),
      AnalyticErr.repo({ kind: 'not_found', entity: 'task', id: 'X' }),
    ];
    for (const e of samples) {
      const p = presentAnalyticServiceError(e);
      expect(p.message.length).toBeGreaterThan(0);
    }
  });

  it('every PortabilityServiceError kind presents', () => {
    const samples: PortabilityServiceError[] = [
      PortabilityErr.validation('v'),
      PortabilityErr.taskService(TaskErr.validation('t')),
      PortabilityErr.depService(DepErr.validation('d')),
    ];
    for (const e of samples) {
      const p = presentPortabilityServiceError(e);
      expect(p.message.length).toBeGreaterThan(0);
    }
  });

  it('every UpdateServiceError kind presents', () => {
    const samples: UpdateServiceError[] = [
      UpdateErr.network('n'),
      UpdateErr.parseFailure('p'),
      UpdateErr.upgradeFailed('u'),
    ];
    for (const e of samples) {
      const p = presentUpdateServiceError(e);
      expect(p.message.length).toBeGreaterThan(0);
      expect(p.code).toBe('UPGRADE_CHECK');
    }
  });

  it('every CliError kind presents', () => {
    const samples: CliError[] = [CliErr.validation('v'), CliErr.io('i')];
    for (const e of samples) {
      const p = presentCliError(e);
      expect(p.message.length).toBeGreaterThan(0);
    }
  });
});

/**
 * Compile-time regression: the presenters' exhaustive switches must force
 * every new variant to be handled. If someone adds `kind: 'new_variant'`
 * to a union without updating the presenter, TypeScript fails to compile
 * the presenter because the `never` default assignment catches the
 * residual unhandled kind.
 *
 * The helpers below mimic the presenter pattern — if they compile, the
 * switch is total over the union at build time.
 */
describe('exhaustive-switch compile guard', () => {
  it('TaskServiceError switch covers every variant', () => {
    // Explicit exhaustive switch — parallels presentTaskServiceError.
    const roundTrip = (e: TaskServiceError): string => {
      switch (e.kind) {
        case 'not_found':
        case 'validation':
        case 'dep_failed':
        case 'repo':
          return e.kind;
        default: {
          const _: never = e;
          return _;
        }
      }
    };
    expect(roundTrip(TaskErr.validation('x'))).toBe('validation');
  });

  it('ProjectServiceError switch covers every variant', () => {
    const roundTrip = (e: ProjectServiceError): string => {
      switch (e.kind) {
        case 'not_found':
        case 'duplicate':
        case 'validation':
        case 'git_remote_missing':
        case 'repo':
          return e.kind;
        default: {
          const _: never = e;
          return _;
        }
      }
    };
    expect(roundTrip(ProjectErr.validation('x'))).toBe('validation');
  });
});
