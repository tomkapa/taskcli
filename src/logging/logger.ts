import { appendFileSync, readdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { trace, type Span, SpanStatusCode } from '@opentelemetry/api';

const tracer = trace.getTracer('task');
const LOG_RETENTION_DAYS = 7;

export interface LogAttributes {
  [key: string]: string | number | boolean;
}

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

function formatTimestamp(): string {
  return new Date().toISOString();
}

function formatAttrs(attrs?: LogAttributes): string {
  if (!attrs || Object.keys(attrs).length === 0) return '';
  return ' ' + JSON.stringify(attrs);
}

class Logger {
  private logFilePath: string | null = null;

  init(logDir: string): void {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    this.logFilePath = join(logDir, `task-${date}.log`);
    this.pruneOldLogs(logDir);
  }

  info(message: string, attrs?: LogAttributes): void {
    this.write('INFO', message, attrs);
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(message, attrs);
    }
  }

  warn(message: string, attrs?: LogAttributes): void {
    this.write('WARN', message, attrs);
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(`WARN: ${message}`, attrs);
    }
  }

  error(message: string, error?: unknown, attrs?: LogAttributes): void {
    const errorDetail = error instanceof Error ? ` | ${error.stack ?? error.message}` : '';
    this.write('ERROR', `${message}${errorDetail}`, attrs);
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(`ERROR: ${message}`, attrs);
      if (error instanceof Error) {
        span.recordException(error);
      }
      span.setStatus({ code: SpanStatusCode.ERROR, message });
    }
  }

  startSpan<T>(name: string, fn: (span: Span) => T): T {
    return tracer.startActiveSpan(name, (span) => {
      try {
        const result = fn(span);
        span.end();
        return result;
      } catch (e) {
        if (e instanceof Error) {
          span.recordException(e);
        }
        span.setStatus({ code: SpanStatusCode.ERROR });
        span.end();
        throw e;
      }
    });
  }

  private write(level: LogLevel, message: string, attrs?: LogAttributes): void {
    if (!this.logFilePath) return;
    const line = `${formatTimestamp()} [${level}] ${message}${formatAttrs(attrs)}\n`;
    try {
      appendFileSync(this.logFilePath, line);
    } catch {
      // Swallowing here is intentional: logging must never crash the app.
      // If the log file is unwritable, the OTel span still captures the event.
    }
  }

  private pruneOldLogs(logDir: string): void {
    try {
      const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000;
      const files = readdirSync(logDir).filter((f) => f.startsWith('task-') && f.endsWith('.log'));
      for (const file of files) {
        const dateStr = file.slice('task-'.length, -'.log'.length);
        const fileDate = new Date(dateStr).getTime();
        if (!isNaN(fileDate) && fileDate < cutoff) {
          unlinkSync(join(logDir, file));
        }
      }
    } catch {
      // Best-effort cleanup — don't crash if pruning fails
    }
  }
}

export const logger = new Logger();
