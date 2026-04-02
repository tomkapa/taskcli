import type { AppError } from '../errors/app-error.js';

export function printSuccess(data: unknown): void {
  process.stdout.write(JSON.stringify({ ok: true, data }, null, 2) + '\n');
}

export function printError(error: AppError): never {
  process.stderr.write(
    JSON.stringify({ ok: false, error: { code: error.code, message: error.message } }, null, 2) +
      '\n',
  );
  process.exit(1);
}

export function handleResult(
  result: { ok: true; value: unknown } | { ok: false; error: AppError },
): void {
  if (result.ok) {
    printSuccess(result.value);
  } else {
    printError(result.error);
  }
}
