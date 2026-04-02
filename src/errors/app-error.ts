export type AppErrorCode = 'NOT_FOUND' | 'DUPLICATE' | 'VALIDATION' | 'DB_ERROR' | 'UNKNOWN';

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
