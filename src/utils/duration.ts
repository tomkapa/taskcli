import type { Result } from '../types/common.js';
import { ok, err } from '../types/common.js';

export type Milliseconds = number;

/**
 * Narrow tagged error returned by `parseDuration`. Callers translate this
 * into their module's error union.
 */
export interface DurationParseError {
  readonly kind: 'validation';
  readonly detail: string;
  readonly message: string;
}

type DurationUnit = 'm' | 'h' | 'd' | 'w';

const UNIT_MS: Record<DurationUnit, number> = {
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

const MAX_MS = 365 * 24 * 60 * 60 * 1000;

function validation(detail: string): DurationParseError {
  return { kind: 'validation', detail, message: detail };
}

export function parseDuration(input: string): Result<Milliseconds, DurationParseError> {
  const match = /^(\d+)([mhdw])$/.exec(input);
  if (!match) {
    return err(
      validation(
        `Invalid duration: "${input}". Format: <positive integer><unit> where unit ∈ m|h|d|w`,
      ),
    );
  }
  const value = parseInt(match[1] as string, 10);
  if (value === 0) {
    return err(validation(`Duration must be positive: "${input}"`));
  }
  const ms = value * UNIT_MS[match[2] as DurationUnit];
  if (ms > MAX_MS) {
    return err(validation(`Duration "${input}" exceeds the maximum of 365 days`));
  }
  return ok(ms);
}
