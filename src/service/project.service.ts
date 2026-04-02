import type { Result } from '../types/common.js';
import { err } from '../types/common.js';
import type { Project } from '../types/project.js';
import { CreateProjectSchema, UpdateProjectSchema } from '../types/project.js';
import type { ProjectRepository } from '../repository/project.repository.js';
import { AppError } from '../errors/app-error.js';
import { logger } from '../logging/logger.js';

export interface ProjectService {
  createProject(input: unknown): Result<Project>;
  listProjects(): Result<Project[]>;
  getProject(id: string): Result<Project>;
  updateProject(id: string, input: unknown): Result<Project>;
  deleteProject(id: string): Result<void>;
  resolveProject(idOrName?: string): Result<Project>;
}

export class ProjectServiceImpl implements ProjectService {
  constructor(private readonly repo: ProjectRepository) {}

  createProject(input: unknown): Result<Project> {
    return logger.startSpan('ProjectService.createProject', () => {
      const parsed = CreateProjectSchema.safeParse(input);
      if (!parsed.success) {
        return err(new AppError('VALIDATION', parsed.error.message));
      }
      return this.repo.insert(parsed.data);
    });
  }

  listProjects(): Result<Project[]> {
    return this.repo.findAll();
  }

  getProject(id: string): Result<Project> {
    return logger.startSpan('ProjectService.getProject', () => {
      const result = this.repo.findById(id);
      if (!result.ok) return result;
      if (!result.value) {
        return err(new AppError('NOT_FOUND', `Project not found: ${id}`));
      }
      return { ok: true, value: result.value };
    });
  }

  updateProject(id: string, input: unknown): Result<Project> {
    return logger.startSpan('ProjectService.updateProject', () => {
      const parsed = UpdateProjectSchema.safeParse(input);
      if (!parsed.success) {
        return err(new AppError('VALIDATION', parsed.error.message));
      }
      return this.repo.update(id, parsed.data);
    });
  }

  deleteProject(id: string): Result<void> {
    return this.repo.delete(id);
  }

  resolveProject(idOrName?: string): Result<Project> {
    return logger.startSpan('ProjectService.resolveProject', () => {
      if (idOrName) {
        const byId = this.repo.findById(idOrName);
        if (!byId.ok) return byId;
        if (byId.value) return { ok: true, value: byId.value };

        const byName = this.repo.findByName(idOrName);
        if (!byName.ok) return byName;
        if (byName.value) return { ok: true, value: byName.value };

        return err(new AppError('NOT_FOUND', `Project not found: ${idOrName}`));
      }

      const defaultProject = this.repo.findDefault();
      if (!defaultProject.ok) return defaultProject;
      if (defaultProject.value) return { ok: true, value: defaultProject.value };

      return err(
        new AppError(
          'NOT_FOUND',
          'No project specified and no default project set. Create a project first.',
        ),
      );
    });
  }
}
