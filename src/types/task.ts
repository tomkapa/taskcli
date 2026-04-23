import { z } from 'zod/v4';
import { TaskStatus, TaskType, DependencyType, UIDependencyType } from './enums.js';
import type { TaskId, ProjectId } from './branded.js';
import { taskIdField, projectIdField } from './id-fields.js';

const taskStatusValues = Object.values(TaskStatus) as [string, ...string[]];
const taskTypeValues = Object.values(TaskType) as [string, ...string[]];
const uiDepTypeValues = Object.values(UIDependencyType) as [string, ...string[]];

const DependencyEntrySchema = z.object({
  id: taskIdField,
  type: z.enum(uiDepTypeValues).default(DependencyType.Blocks),
});
export type DependencyEntry = z.infer<typeof DependencyEntrySchema>;

export const CreateTaskSchema = z.object({
  name: z.string().min(1, 'Task name is required').max(500),
  description: z.string().max(10000).optional(),
  type: z.enum(taskTypeValues).default(TaskType.Story),
  status: z.enum(taskStatusValues).default(TaskStatus.Backlog),
  projectId: projectIdField.optional(),
  parentId: taskIdField.optional(),
  technicalNotes: z.string().max(50000).optional(),
  additionalRequirements: z.string().max(50000).optional(),
  dependsOn: z.array(DependencyEntrySchema).optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(10000).optional(),
  type: z.enum(taskTypeValues).optional(),
  status: z.enum(taskStatusValues).optional(),
  parentId: taskIdField.nullable().optional(),
  technicalNotes: z.string().max(50000).optional(),
  additionalRequirements: z.string().max(50000).optional(),
  appendNotes: z.string().max(50000).optional(),
  appendRequirements: z.string().max(50000).optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

export const TaskFilterSchema = z.object({
  status: z.enum(taskStatusValues).optional(),
  type: z.enum(taskTypeValues).optional(),
  level: z.number().int().min(1).max(2).optional(),
  parentId: taskIdField.optional(),
  /** Multi-select filter: show tasks whose parentId is in this list. */
  parentIds: z.array(taskIdField).optional(),
  search: z.string().optional(),
});
export type TaskFilter = z.infer<typeof TaskFilterSchema> & { projectId?: ProjectId };

export const RerankTaskSchema = z.object({
  taskId: taskIdField,
  afterId: taskIdField.optional(),
  beforeId: taskIdField.optional(),
  position: z.number().int().min(1).optional(),
  /** Move to the top of active tasks (highest priority). */
  top: z.boolean().optional(),
  /** Move to the bottom of active tasks, kept above terminal (done/cancelled) tasks. */
  bottom: z.boolean().optional(),
});
export type RerankTaskInput = z.infer<typeof RerankTaskSchema>;

export interface Task {
  id: TaskId;
  projectId: ProjectId;
  parentId: TaskId | null;
  name: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  rank: number;
  technicalNotes: string;
  additionalRequirements: string;
  createdAt: string;
  updatedAt: string;
}
