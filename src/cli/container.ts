import type Database from 'better-sqlite3';
import { SqliteProjectRepository } from '../repository/project.repository.js';
import { SqliteTaskRepository } from '../repository/task.repository.js';
import { ProjectServiceImpl } from '../service/project.service.js';
import { TaskServiceImpl } from '../service/task.service.js';
import type { ProjectService } from '../service/project.service.js';
import type { TaskService } from '../service/task.service.js';

export interface Container {
  projectService: ProjectService;
  taskService: TaskService;
}

export function createContainer(db: Database.Database): Container {
  const projectRepo = new SqliteProjectRepository(db);
  const taskRepo = new SqliteTaskRepository(db);
  const projectService = new ProjectServiceImpl(projectRepo);
  const taskService = new TaskServiceImpl(taskRepo, projectService);

  return { projectService, taskService };
}
