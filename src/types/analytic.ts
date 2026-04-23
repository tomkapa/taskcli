import { z } from 'zod/v4';
import type { TaskStatus, TaskType } from './enums.js';

export const SummaryQuerySchema = z.object({
  period: z.enum(['day', 'week']),
});
export type SummaryQuery = z.infer<typeof SummaryQuerySchema>;

export const CompletedQuerySchema = z.object({
  since: z.string().min(1),
});
export type CompletedQuery = z.infer<typeof CompletedQuerySchema>;

export interface AnalyticSummary {
  period: 'day' | 'week';
  windowStart: string;
  windowEnd: string;
  completed: { total: number; byType: Record<TaskType, number> };
  created: { total: number; byType: Record<TaskType, number> };
  current: {
    total: number;
    byStatus: Record<TaskStatus, number>;
    byType: Record<TaskType, number>;
  };
  backlogDelta: number;
  throughputPerDay: number;
}
