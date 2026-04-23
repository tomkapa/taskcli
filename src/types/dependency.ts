import { z } from 'zod/v4';
import { DependencyType } from './enums.js';
import type { TaskId } from './branded.js';
import { taskIdField } from './id-fields.js';

// Only DB-persisted types; blocked-by is resolved to blocks at the service layer.
const dbDepTypeValues = [
  DependencyType.Blocks,
  DependencyType.RelatesTo,
  DependencyType.Duplicates,
] as const;

export const AddDependencySchema = z.object({
  taskId: taskIdField,
  dependsOnId: taskIdField,
  type: z.enum(dbDepTypeValues).default(DependencyType.Blocks),
});
export type AddDependencyInput = z.infer<typeof AddDependencySchema>;

export const RemoveDependencySchema = z.object({
  taskId: taskIdField,
  dependsOnId: taskIdField,
});
export type RemoveDependencyInput = z.infer<typeof RemoveDependencySchema>;

export interface TaskDependency {
  taskId: TaskId;
  dependsOnId: TaskId;
  type: DependencyType;
  createdAt: string;
}
