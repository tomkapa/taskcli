/**
 * Time source for repository writes. A fake clock in tests eliminates
 * flakiness from real time drift; in production the system clock is fine.
 */
export interface Clock {
  now(): Date;
  nowIso(): string;
}

export const systemClock: Clock = {
  now: () => new Date(),
  nowIso: () => new Date().toISOString(),
};
