import type { Result } from '../types/common.js';
import { ok, err } from '../types/common.js';
import { AppError } from '../errors/app-error.js';
import type { Task } from '../types/task.js';
import type { Project } from '../types/project.js';
import { TaskStatus, TaskType } from '../types/enums.js';
import { SummaryQuerySchema, CompletedQuerySchema } from '../types/analytic.js';
import type { AnalyticSummary } from '../types/analytic.js';
import type { TaskRepository } from '../repository/task.repository.js';
import { parseDuration } from '../utils/duration.js';
import { logger } from '../logging/logger.js';

export interface AnalyticService {
  summary(input: unknown, project: Project): Result<AnalyticSummary>;
  listCompleted(input: unknown, project: Project): Result<Task[]>;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const PERIOD_MS: Record<'day' | 'week', number> = {
  day: DAY_MS,
  week: 7 * DAY_MS,
};

const ZERO_BY_TYPE = Object.fromEntries(
  Object.values(TaskType).map((t) => [t, 0]),
) as Record<TaskType, number>;

const ZERO_BY_STATUS = Object.fromEntries(
  Object.values(TaskStatus).map((s) => [s, 0]),
) as Record<TaskStatus, number>;

export class AnalyticServiceImpl implements AnalyticService {
  constructor(private readonly repo: TaskRepository) {}

  summary(input: unknown, project: Project): Result<AnalyticSummary> {
    return logger.startSpan('AnalyticService.summary', () => {
      const parsed = SummaryQuerySchema.safeParse(input);
      if (!parsed.success) {
        return err(new AppError('VALIDATION', parsed.error.message));
      }
      const { period } = parsed.data;
      const periodMs = PERIOD_MS[period];
      const now = Date.now();
      const windowStart = new Date(now - periodMs).toISOString();
      const windowEnd = new Date(now).toISOString();

      const completedResult = this.repo.countCompletedSince(project.id, windowStart);
      if (!completedResult.ok) return completedResult;

      const createdResult = this.repo.countCreatedSince(project.id, windowStart);
      if (!createdResult.ok) return createdResult;

      const currentResult = this.repo.countCurrent(project.id);
      if (!currentResult.ok) return currentResult;

      const completedTotal = completedResult.value.total;
      const createdTotal = createdResult.value.total;

      return ok({
        period,
        windowStart,
        windowEnd,
        completed: {
          total: completedTotal,
          byType: { ...ZERO_BY_TYPE, ...completedResult.value.byType },
        },
        created: {
          total: createdTotal,
          byType: { ...ZERO_BY_TYPE, ...createdResult.value.byType },
        },
        current: {
          total: currentResult.value.total,
          byStatus: { ...ZERO_BY_STATUS, ...currentResult.value.byStatus },
          byType: { ...ZERO_BY_TYPE, ...currentResult.value.byType },
        },
        backlogDelta: createdTotal - completedTotal,
        throughputPerDay: completedTotal / (periodMs / DAY_MS),
      });
    });
  }

  listCompleted(input: unknown, project: Project): Result<Task[]> {
    return logger.startSpan('AnalyticService.listCompleted', () => {
      const parsed = CompletedQuerySchema.safeParse(input);
      if (!parsed.success) {
        return err(new AppError('VALIDATION', parsed.error.message));
      }
      const durationResult = parseDuration(parsed.data.since);
      if (!durationResult.ok) return durationResult;

      const windowStart = new Date(Date.now() - durationResult.value).toISOString();
      return this.repo.findCompletedSince(project.id, windowStart);
    });
  }
}
