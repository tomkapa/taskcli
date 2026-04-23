import { z } from 'zod/v4';
import { TaskId, ProjectId, isParseError } from './branded.js';

/**
 * Zod field that accepts a raw string at the boundary and transforms it
 * into a `TaskId`. Fails schema parsing with the parser's detail message
 * when the format is wrong — so the service layer never sees an invalid
 * id.
 */
export const taskIdField = z.string().transform((raw, ctx) => {
  const parsed = TaskId.parse(raw);
  if (isParseError(parsed)) {
    ctx.addIssue({ code: 'custom', message: parsed.detail });
    return z.NEVER;
  }
  return parsed;
});

export const projectIdField = z.string().transform((raw, ctx) => {
  const parsed = ProjectId.parse(raw);
  if (isParseError(parsed)) {
    ctx.addIssue({ code: 'custom', message: parsed.detail });
    return z.NEVER;
  }
  return parsed;
});
