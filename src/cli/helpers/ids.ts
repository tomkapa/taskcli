import type { Result } from '../../types/common.js';
import { ok, err } from '../../types/common.js';
import type { TaskId, ProjectId } from '../../types/branded.js';
import {
  TaskId as TaskIdCtor,
  ProjectId as ProjectIdCtor,
  isParseError,
} from '../../types/branded.js';
import type { CliError } from '../../service/errors.js';
import { CliErr } from '../../service/errors.js';

/**
 * Parse a raw CLI-provided task id into the branded type. Returns a
 * `CliError` with `kind: 'validation'` if the format is wrong — CLI
 * commands surface this to stderr via the normal error pipeline.
 */
export function parseTaskIdArg(raw: string): Result<TaskId, CliError> {
  const parsed = TaskIdCtor.parse(raw);
  if (isParseError(parsed)) {
    return err(CliErr.validation(parsed.detail));
  }
  return ok(parsed);
}

export function parseProjectIdArg(raw: string): Result<ProjectId, CliError> {
  const parsed = ProjectIdCtor.parse(raw);
  if (isParseError(parsed)) {
    return err(CliErr.validation(parsed.detail));
  }
  return ok(parsed);
}
