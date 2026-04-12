export type AppErrorCode =
  | 'NOT_FOUND'
  | 'DUPLICATE'
  | 'VALIDATION'
  | 'DB_ERROR'
  | 'UPGRADE_CHECK'
  | 'UNKNOWN';

export class AppError extends Error {
  constructor(
    public readonly code: AppErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function toMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
