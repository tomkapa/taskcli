import type { Result } from '../types/common.js';
import type { Project, CreateProjectInput, UpdateProjectInput } from '../types/project.js';
import type { GitRemote } from '../types/git-remote.js';
import type { ProjectId } from '../types/branded.js';
import type { RepositoryError } from './errors.js';

export interface ProjectRepository {
  insert(input: CreateProjectInput & { key: string }): Result<Project, RepositoryError>;
  findById(id: ProjectId): Result<Project | null, RepositoryError>;
  findByKey(key: string): Result<Project | null, RepositoryError>;
  findByName(name: string): Result<Project | null, RepositoryError>;
  findByGitRemote(remote: GitRemote): Result<Project | null, RepositoryError>;
  findDefault(): Result<Project | null, RepositoryError>;
  findAll(): Result<Project[], RepositoryError>;
  update(id: ProjectId, input: UpdateProjectInput): Result<Project, RepositoryError>;
  delete(id: ProjectId): Result<void, RepositoryError>;
  incrementTaskCounter(id: ProjectId): Result<number, RepositoryError>;
}
