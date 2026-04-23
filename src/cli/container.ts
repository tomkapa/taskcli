import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { RepositorySet } from '../repository/repository-set.js';
import { ProjectServiceImpl } from '../service/project.service.js';
import type { DetectGitRemoteFn } from '../service/project.service.js';
import { TaskServiceImpl } from '../service/task.service.js';
import { DependencyServiceImpl } from '../service/dependency.service.js';
import { PortabilityServiceImpl } from '../service/portability.service.js';
import { UpdateServiceImpl } from '../service/update.service.js';
import { AnalyticServiceImpl } from '../service/analytic.service.js';
import type { ProjectService } from '../service/project.service.js';
import type { TaskService } from '../service/task.service.js';
import type { DependencyService } from '../service/dependency.service.js';
import type { PortabilityService } from '../service/portability.service.js';
import type { UpdateService } from '../service/update.service.js';
import type { AnalyticService } from '../service/analytic.service.js';

export interface Container {
  repos: RepositorySet;
  dbPath: string;
  updateCachePath: string;
  dismissedGitRemotesPath: string;
  projectService: ProjectService;
  taskService: TaskService;
  dependencyService: DependencyService;
  portabilityService: PortabilityService;
  updateService: UpdateService;
  analyticService: AnalyticService;
}

export interface CreateContainerOptions {
  dbPath?: string;
  detectGitRemote?: DetectGitRemoteFn;
  updateCachePath?: string;
  dismissedGitRemotesPath?: string;
}

export function createContainer(
  repos: RepositorySet,
  options: CreateContainerOptions = {},
): Container {
  const projectService = new ProjectServiceImpl(repos.projects, options.detectGitRemote);
  const dependencyService = new DependencyServiceImpl(repos.dependencies, repos.tasks);
  const taskService = new TaskServiceImpl(repos.tasks, projectService, () => dependencyService);
  const portabilityService = new PortabilityServiceImpl(taskService, dependencyService);
  const resolvedUpdateCachePath =
    options.updateCachePath ?? join(tmpdir(), 'tayto-update-check.json');
  const updateService = new UpdateServiceImpl(resolvedUpdateCachePath);
  const analyticService = new AnalyticServiceImpl(repos.tasks);

  return {
    repos,
    dbPath: options.dbPath ?? '',
    updateCachePath: resolvedUpdateCachePath,
    dismissedGitRemotesPath:
      options.dismissedGitRemotesPath ?? join(tmpdir(), 'tayto-dismissed-git-remotes.json'),
    projectService,
    taskService,
    dependencyService,
    portabilityService,
    updateService,
    analyticService,
  };
}
