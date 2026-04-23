import type { Result } from '../types/common.js';
import { ok, err } from '../types/common.js';
import { AppError } from '../errors/app-error.js';

export type Milliseconds = number;

type DurationUnit = 'm' | 'h' | 'd' | 'w';

const UNIT_MS: Record<DurationUnit, number> = {
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
};

const MAX_MS = 365 * 24 * 60 * 60 * 1000;

export function parseDuration(input: string): Result<Milliseconds> {
  const match = /^(\d+)([mhdw])$/.exec(input);
  if (!match) {
    return err(new AppError('VALIDATION', `Invalid duration: "${input}". Format: <positive integer><unit> where unit ∈ m|h|d|w`));
  }
  const value = parseInt(match[1] as string, 10);
  if (value === 0) {
    return err(new AppError('VALIDATION', `Duration must be positive: "${input}"`));
  }
  const ms = value * UNIT_MS[match[2] as DurationUnit];
  if (ms > MAX_MS) {
    return err(new AppError('VALIDATION', `Duration "${input}" exceeds the maximum of 365 days`));
  }
  return ok(ms);
}
