import type { Result } from '../types/common.js';
import type { PresentedError } from '../types/presented-error.js';

export function printSuccess(data: unknown): void {
  process.stdout.write(JSON.stringify({ ok: true, data }, null, 2) + '\n');
}

export function printError(error: PresentedError): never {
  process.stderr.write(
    JSON.stringify({ ok: false, error: { code: error.code, message: error.message } }, null, 2) +
      '\n',
  );
  process.exit(1);
}

/**
 * Generic helper that prints a successful result or delegates to a
 * service-specific presenter to format the error. The presenter is the
 * exhaustive switch; `handleResult` stays agnostic.
 */
export function handleResult<T, E>(
  result: Result<T, E>,
  presenter: (e: E) => PresentedError,
): void {
  if (result.ok) {
    printSuccess(result.value);
  } else {
    printError(presenter(result.error));
  }
}
