import type { Result } from '../types/common.js';
import { ok, err } from '../types/common.js';
import type { Project } from '../types/project.js';
import { CreateProjectSchema, UpdateProjectSchema } from '../types/project.js';
import { GitRemote } from '../types/git-remote.js';
import type { ProjectId, TaskId } from '../types/branded.js';
import {
  TaskId as TaskIdCtor,
  ProjectId as ProjectIdCtor,
  isParseError,
} from '../types/branded.js';
import type { ProjectRepository } from '../repository/project.repository.js';
import { logger } from '../logging/logger.js';
import { detectGitRemote as defaultDetectGitRemote } from '../utils/git.js';
import type { ProjectServiceError } from './errors.js';
import { ProjectErr, mapProjectRepo } from './errors.js';

export type DetectGitRemoteFn = (cwd?: string) => Result<GitRemote | null, never>;

export interface ProjectService {
  createProject(input: unknown): Result<Project, ProjectServiceError>;
  listProjects(): Result<Project[], ProjectServiceError>;
  getProject(id: ProjectId): Result<Project, ProjectServiceError>;
  updateProject(id: ProjectId, input: unknown): Result<Project, ProjectServiceError>;
  deleteProject(id: ProjectId): Result<void, ProjectServiceError>;
  resolveProject(idOrName?: string, cwd?: string): Result<Project, ProjectServiceError>;
  linkGitRemote(idOrName: string, remote?: string): Result<Project, ProjectServiceError>;
  unlinkGitRemote(idOrName: string): Result<Project, ProjectServiceError>;
  nextTaskId(project: Project): Result<TaskId, ProjectServiceError>;
}

export class ProjectServiceImpl implements ProjectService {
  constructor(
    private readonly repo: ProjectRepository,
    private readonly detectRemote: DetectGitRemoteFn = defaultDetectGitRemote,
  ) {}

  createProject(input: unknown): Result<Project, ProjectServiceError> {
    return logger.startSpan('ProjectService.createProject', () => {
      const parsed = CreateProjectSchema.safeParse(input);
      if (!parsed.success) {
        return err(ProjectErr.validation(parsed.error.message));
      }

      const key = parsed.data.key ?? this.generateKey(parsed.data.name);
      const keyError = this.validateKey(key);
      if (keyError) {
        return err(ProjectErr.validation(keyError));
      }

      const existingResult = mapProjectRepo(this.repo.findByKey(key));
      if (!existingResult.ok) return existingResult;
      if (existingResult.value) {
        return err(ProjectErr.duplicate(key));
      }

      return mapProjectRepo(this.repo.insert({ ...parsed.data, key }));
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

  listProjects(): Result<Project[], ProjectServiceError> {
    return mapProjectRepo(this.repo.findAll());
  }

  getProject(id: ProjectId): Result<Project, ProjectServiceError> {
    return logger.startSpan('ProjectService.getProject', () => {
      const result = mapProjectRepo(this.repo.findById(id));
      if (!result.ok) return result;
      if (!result.value) {
        return err(ProjectErr.notFound(id));
      }
      return ok(result.value);
    });
  }

  updateProject(id: ProjectId, input: unknown): Result<Project, ProjectServiceError> {
    return logger.startSpan('ProjectService.updateProject', () => {
      const parsed = UpdateProjectSchema.safeParse(input);
      if (!parsed.success) {
        return err(ProjectErr.validation(parsed.error.message));
      }
      return mapProjectRepo(this.repo.update(id, parsed.data));
    });
  }

  deleteProject(id: ProjectId): Result<void, ProjectServiceError> {
    return mapProjectRepo(this.repo.delete(id));
  }

  resolveProject(idOrName?: string, cwd?: string): Result<Project, ProjectServiceError> {
    return logger.startSpan('ProjectService.resolveProject', () => {
      if (idOrName) {
        const maybeId = ProjectIdCtor.parse(idOrName);
        if (!isParseError(maybeId)) {
          const byId = mapProjectRepo(this.repo.findById(maybeId));
          if (!byId.ok) return byId;
          if (byId.value) return ok(byId.value);
        }

        const byKey = mapProjectRepo(this.repo.findByKey(idOrName.toUpperCase()));
        if (!byKey.ok) return byKey;
        if (byKey.value) return ok(byKey.value);

        const byName = mapProjectRepo(this.repo.findByName(idOrName));
        if (!byName.ok) return byName;
        if (byName.value) return ok(byName.value);

        return err(ProjectErr.notFound(idOrName));
      }

      // Try git remote detection before falling back to default
      const remoteResult = this.detectRemote(cwd);
      if (remoteResult.ok && remoteResult.value) {
        const byRemote = mapProjectRepo(this.repo.findByGitRemote(remoteResult.value));
        if (!byRemote.ok) return byRemote;
        if (byRemote.value) {
          logger.info(`resolveProject: matched git remote to project key=${byRemote.value.key}`);
          return ok(byRemote.value);
        }
      }

      const defaultProject = mapProjectRepo(this.repo.findDefault());
      if (!defaultProject.ok) return defaultProject;
      if (defaultProject.value) return ok(defaultProject.value);

      return err(
        ProjectErr.notFound(
          '',
          'No project specified and no default project set. Create a project first.',
        ),
      );
    });
  }

  linkGitRemote(idOrName: string, remote?: string): Result<Project, ProjectServiceError> {
    return logger.startSpan('ProjectService.linkGitRemote', () => {
      const resolved = this.resolveProject(idOrName);
      if (!resolved.ok) return resolved;

      let gitRemote: GitRemote;
      if (remote) {
        gitRemote = GitRemote.parse(remote);
      } else {
        const detected = this.detectRemote();
        if (!detected.ok) return err(ProjectErr.gitRemoteMissing('Could not detect git remote'));
        if (!detected.value) {
          return err(
            ProjectErr.gitRemoteMissing(
              'No git remote detected in current directory. Use --remote <url> to specify one explicitly.',
            ),
          );
        }
        gitRemote = detected.value;
      }

      return mapProjectRepo(this.repo.update(resolved.value.id, { gitRemote }));
    });
  }

  unlinkGitRemote(idOrName: string): Result<Project, ProjectServiceError> {
    return logger.startSpan('ProjectService.unlinkGitRemote', () => {
      const resolved = this.resolveProject(idOrName);
      if (!resolved.ok) return resolved;

      if (!resolved.value.gitRemote) {
        return err(
          ProjectErr.notFound(
            resolved.value.name,
            `Project "${resolved.value.name}" has no linked git remote.`,
          ),
        );
      }

      return mapProjectRepo(this.repo.update(resolved.value.id, { gitRemote: null }));
    });
  }

  nextTaskId(project: Project): Result<TaskId, ProjectServiceError> {
    return logger.startSpan('ProjectService.nextTaskId', () => {
      const counterResult = mapProjectRepo(this.repo.incrementTaskCounter(project.id));
      if (!counterResult.ok) return counterResult;
      return ok(TaskIdCtor.unsafe(`${project.key}-${counterResult.value}`));
    });
  }
}
