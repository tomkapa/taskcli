import { SpanStatusCode, type Span } from '@opentelemetry/api';
import { logger } from '../../logging/logger.js';
import type { Result } from '../../types/common.js';
import type { RepositoryEntity, RepositoryError } from '../errors.js';

/**
 * Wrap a repository call with a stable, low-cardinality span. Names are
 * `repo.<entity>.<op>`; dynamic values (ids, filters) go on `tayto.repo.*`
 * attributes. On a failed `Result`, the kind is attached and the span is
 * marked ERROR — both setStatus and (if present) recordException.
 */
export function repoSpan<T>(
  entity: RepositoryEntity,
  op: string,
  fn: (span: Span) => Result<T, RepositoryError>,
): Result<T, RepositoryError> {
  return logger.startSpan(`repo.${entity}.${op}`, (span) => {
    span.setAttribute('tayto.repo.backend', 'sqlite');
    span.setAttribute('tayto.repo.entity', entity);
    span.setAttribute('tayto.repo.op', op);
    const result = fn(span);
    if (result.ok) {
      span.setAttribute('tayto.result.kind', 'ok');
    } else {
      span.setAttribute('tayto.result.kind', result.error.kind);
      span.setStatus({ code: SpanStatusCode.ERROR });
    }
    return result;
  });
}
