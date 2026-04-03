import type { Result } from '../types/common.js';
import { ok, err } from '../types/common.js';
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
  nextTaskId(project: Project): Result<string>;
}

export class ProjectServiceImpl implements ProjectService {
  constructor(private readonly repo: ProjectRepository) {}

  createProject(input: unknown): Result<Project> {
    return logger.startSpan('ProjectService.createProject', () => {
      const parsed = CreateProjectSchema.safeParse(input);
      if (!parsed.success) {
        return err(new AppError('VALIDATION', parsed.error.message));
      }

      const key = parsed.data.key ?? this.generateKey(parsed.data.name);
      const keyError = this.validateKey(key);
      if (keyError) {
        return err(new AppError('VALIDATION', keyError));
      }

      const existingResult = this.repo.findByKey(key);
      if (!existingResult.ok) return existingResult;
      if (existingResult.value) {
        return err(new AppError('DUPLICATE', `Project key already exists: ${key}`));
      }

      return this.repo.insert({ ...parsed.data, key });
    });
  }

  private generateKey(name: string): string {
    return name
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 3)
      .toUpperCase();
  }

  private validateKey(key: string): string | null {
    if (key.length < 2 || key.length > 7) {
      return `Project key must be 2-7 characters, got ${key.length}. Provide a --key explicitly.`;
    }
    if (!/^[A-Z0-9]+$/.test(key)) {
      return 'Project key must contain only uppercase letters and digits.';
    }
    return null;
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
      return ok(result.value);
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
        if (byId.value) return ok(byId.value);

        const byKey = this.repo.findByKey(idOrName.toUpperCase());
        if (!byKey.ok) return byKey;
        if (byKey.value) return ok(byKey.value);

        const byName = this.repo.findByName(idOrName);
        if (!byName.ok) return byName;
        if (byName.value) return ok(byName.value);

        return err(new AppError('NOT_FOUND', `Project not found: ${idOrName}`));
      }

      const defaultProject = this.repo.findDefault();
      if (!defaultProject.ok) return defaultProject;
      if (defaultProject.value) return ok(defaultProject.value);

      return err(
        new AppError(
          'NOT_FOUND',
          'No project specified and no default project set. Create a project first.',
        ),
      );
    });
  }

  nextTaskId(project: Project): Result<string> {
    return logger.startSpan('ProjectService.nextTaskId', () => {
      const counterResult = this.repo.incrementTaskCounter(project.id);
      if (!counterResult.ok) return counterResult;
      return ok(`${project.key}-${counterResult.value}`);
    });
  }
}
