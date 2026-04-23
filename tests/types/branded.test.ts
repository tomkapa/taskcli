import { describe, it, expect } from 'vitest';
import {
  TaskId,
  ProjectId,
  DependencyId,
  isParseError,
} from '../../src/types/branded.js';

describe('TaskId', () => {
  it('accepts valid <KEY>-<N> formats', () => {
    const cases = ['AB-1', 'TAYTO-42', 'ABCDEFG-999999'];
    for (const raw of cases) {
      const parsed = TaskId.parse(raw);
      expect(isParseError(parsed)).toBe(false);
      if (isParseError(parsed)) continue;
      expect(String(parsed)).toBe(raw);
    }
  });

  it('rejects malformed ids at the boundary, not three layers deep', () => {
    const cases = [
      '', // empty
      'abc-1', // lowercase
      'A-1', // key too short
      'ABCDEFGH-1', // key too long
      'AB-', // missing number
      'AB-abc', // non-numeric
      'not-a-ulid',
    ];
    for (const raw of cases) {
      const parsed = TaskId.parse(raw);
      expect(isParseError(parsed)).toBe(true);
    }
  });

  it('rejects ids exceeding the length cap', () => {
    const big = 'ABCDEFG-' + '9'.repeat(100);
    const parsed = TaskId.parse(big);
    expect(isParseError(parsed)).toBe(true);
  });
});

describe('ProjectId', () => {
  it('accepts non-empty strings within the cap', () => {
    const parsed = ProjectId.parse('01KP11T8DRS9AQ8RG4WEF3NB98');
    expect(isParseError(parsed)).toBe(false);
  });

  it('rejects empty strings', () => {
    const parsed = ProjectId.parse('');
    expect(isParseError(parsed)).toBe(true);
  });
});

describe('DependencyId', () => {
  it('composes from two task ids', () => {
    const a = TaskId.unsafe('AB-1');
    const b = TaskId.unsafe('AB-2');
    const dep = DependencyId.of(a, b);
    expect(String(dep)).toBe('AB-1->AB-2');
  });
});

describe('nominal type discipline', () => {
  it('TaskId and ProjectId are distinct at the type level', () => {
    // This test documents the compile-time guarantee that motivated this
    // refactor. The `@ts-expect-error` lines below prove that the compiler
    // rejects cross-id-type assignments — if TypeScript ever allows them
    // again, this test fails to compile.
    const task = TaskId.unsafe('AB-1');
    const project = ProjectId.unsafe('01KP11T8DRS9AQ8RG4WEF3NB98');

    // A helper that demands a TaskId must reject a ProjectId:
    function needsTaskId(_id: typeof task): void {
      /* accept */
    }

    needsTaskId(task); // ok
    // @ts-expect-error — ProjectId is not assignable to TaskId.
    needsTaskId(project);

    // And vice-versa:
    function needsProjectId(_id: typeof project): void {
      /* accept */
    }
    needsProjectId(project); // ok
    // @ts-expect-error — TaskId is not assignable to ProjectId.
    needsProjectId(task);
  });
});
