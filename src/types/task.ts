import { z } from 'zod/v4';
import { TaskStatus, TaskType } from './enums.js';

const taskStatusValues = Object.values(TaskStatus) as [string, ...string[]];
const taskTypeValues = Object.values(TaskType) as [string, ...string[]];

export const CreateTaskSchema = z.object({
  name: z.string().min(1, 'Task name is required').max(500),
  description: z.string().max(10000).optional(),
  type: z.enum(taskTypeValues).default(TaskType.Story),
  status: z.enum(taskStatusValues).default(TaskStatus.Backlog),
  priority: z.number().int().min(1).max(5).default(3),
  projectId: z.string().optional(),
  parentId: z.string().optional(),
  technicalNotes: z.string().max(50000).optional(),
  additionalRequirements: z.string().max(50000).optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  type: z.enum(taskTypeValues).optional(),
  status: z.enum(taskStatusValues).optional(),
  priority: z.number().int().min(1).max(5).optional(),
  parentId: z.string().nullable().optional(),
  technicalNotes: z.string().max(50000).optional(),
  additionalRequirements: z.string().max(50000).optional(),
  appendNotes: z.string().max(50000).optional(),
  appendRequirements: z.string().max(50000).optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

export const TaskFilterSchema = z.object({
  projectId: z.string().optional(),
  status: z.enum(taskStatusValues).optional(),
  type: z.enum(taskTypeValues).optional(),
  priority: z.number().int().min(1).max(5).optional(),
  parentId: z.string().optional(),
  search: z.string().optional(),
});
export type TaskFilter = z.infer<typeof TaskFilterSchema>;

export interface Task {
  id: string;
  projectId: string;
  parentId: string | null;
  name: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: number;
  technicalNotes: string;
  additionalRequirements: string;
  createdAt: string;
  updatedAt: string;
}
