import { z } from 'zod/v4';
import { DependencyType } from './enums.js';

// Only DB-persisted types; blocked-by is resolved to blocks at the service layer.
const dbDepTypeValues = [
  DependencyType.Blocks,
  DependencyType.RelatesTo,
  DependencyType.Duplicates,
] as const;

export const AddDependencySchema = z.object({
  taskId: z.string().min(1, 'Task id is required'),
  dependsOnId: z.string().min(1, 'Depends-on task id is required'),
  type: z.enum(dbDepTypeValues).default(DependencyType.Blocks),
});
export type AddDependencyInput = z.infer<typeof AddDependencySchema>;

export const RemoveDependencySchema = z.object({
  taskId: z.string().min(1, 'Task id is required'),
  dependsOnId: z.string().min(1, 'Depends-on task id is required'),
});
export type RemoveDependencyInput = z.infer<typeof RemoveDependencySchema>;

export interface TaskDependency {
  taskId: string;
  dependsOnId: string;
  type: DependencyType;
  createdAt: string;
}
