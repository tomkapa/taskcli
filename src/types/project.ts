import { z } from 'zod/v4';
import { GitRemote } from './git-remote.js';
import type { ProjectId } from './branded.js';

const gitRemoteField = z
  .string()
  .min(1, 'Git remote URL must not be empty')
  .transform((v) => GitRemote.parse(v))
  .nullable()
  .optional();

export const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(255),
  key: z
    .string()
    .min(2, 'Project key must be at least 2 characters')
    .max(7, 'Project key must be at most 7 characters')
    .regex(/^[A-Za-z0-9]+$/, 'Project key must contain only letters and digits')
    .transform((v) => v.toUpperCase())
    .optional(),
  description: z.string().max(5000).optional(),
  isDefault: z.boolean().optional(),
  gitRemote: gitRemoteField,
});
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).optional(),
  isDefault: z.boolean().optional(),
  gitRemote: gitRemoteField,
});
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export interface Project {
  id: ProjectId;
  key: string;
  name: string;
  description: string;
  isDefault: boolean;
  gitRemote: GitRemote | null;
  createdAt: string;
  updatedAt: string;
}
