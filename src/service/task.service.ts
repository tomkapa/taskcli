import type { Result } from '../types/common.js';
import { ok, err } from '../types/common.js';
import type { Task, TaskFilter } from '../types/task.js';
import { CreateTaskSchema, UpdateTaskSchema, TaskFilterSchema } from '../types/task.js';
import type { TaskRepository } from '../repository/task.repository.js';
import type { ProjectService } from './project.service.js';
import { AppError } from '../errors/app-error.js';
import { logger } from '../logging/logger.js';

export interface TaskService {
  createTask(input: unknown, projectIdOrName?: string): Result<Task>;
  getTask(id: string): Result<Task>;
  listTasks(filter: unknown): Result<Task[]>;
  updateTask(id: string, input: unknown): Result<Task>;
  deleteTask(id: string): Result<void>;
  breakdownTask(parentId: string, subtasks: unknown[]): Result<Task[]>;
}

export class TaskServiceImpl implements TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly projectService: ProjectService,
  ) {}

  createTask(input: unknown, projectIdOrName?: string): Result<Task> {
    return logger.startSpan('TaskService.createTask', () => {
      const parsed = CreateTaskSchema.safeParse(input);
      if (!parsed.success) {
        return err(new AppError('VALIDATION', parsed.error.message));
      }

      const projectRef = parsed.data.projectId ?? projectIdOrName;
      const projectResult = this.projectService.resolveProject(projectRef);
      if (!projectResult.ok) return projectResult;

      if (parsed.data.parentId) {
        const parentResult = this.repo.findById(parsed.data.parentId);
        if (!parentResult.ok) return parentResult;
        if (!parentResult.value) {
          return err(new AppError('NOT_FOUND', `Parent task not found: ${parsed.data.parentId}`));
        }
      }

      return this.repo.insert({ ...parsed.data, projectId: projectResult.value.id });
    });
  }

  getTask(id: string): Result<Task> {
    return logger.startSpan('TaskService.getTask', () => {
      const result = this.repo.findById(id);
      if (!result.ok) return result;
      if (!result.value) {
        return err(new AppError('NOT_FOUND', `Task not found: ${id}`));
      }
      return { ok: true, value: result.value };
    });
  }

  listTasks(filter: unknown): Result<Task[]> {
    return logger.startSpan('TaskService.listTasks', () => {
      const parsed = TaskFilterSchema.safeParse(filter);
      if (!parsed.success) {
        return err(new AppError('VALIDATION', parsed.error.message));
      }

      let resolvedFilter: TaskFilter = parsed.data;

      if (parsed.data.projectId) {
        const projectResult = this.projectService.resolveProject(parsed.data.projectId);
        if (!projectResult.ok) return projectResult;
        resolvedFilter = { ...resolvedFilter, projectId: projectResult.value.id };
      }

      return this.repo.findMany(resolvedFilter);
    });
  }

  updateTask(id: string, input: unknown): Result<Task> {
    return logger.startSpan('TaskService.updateTask', () => {
      const parsed = UpdateTaskSchema.safeParse(input);
      if (!parsed.success) {
        return err(new AppError('VALIDATION', parsed.error.message));
      }
      return this.repo.update(id, parsed.data);
    });
  }

  deleteTask(id: string): Result<void> {
    return this.repo.delete(id);
  }

  breakdownTask(parentId: string, subtasks: unknown[]): Result<Task[]> {
    return logger.startSpan('TaskService.breakdownTask', () => {
      const parentResult = this.repo.findById(parentId);
      if (!parentResult.ok) return parentResult;
      if (!parentResult.value) {
        return err(new AppError('NOT_FOUND', `Parent task not found: ${parentId}`));
      }

      const parent = parentResult.value;
      const created: Task[] = [];

      for (const subtask of subtasks) {
        const parsed = CreateTaskSchema.safeParse(subtask);
        if (!parsed.success) {
          return err(new AppError('VALIDATION', `Invalid subtask: ${parsed.error.message}`));
        }

        const result = this.repo.insert({
          ...parsed.data,
          projectId: parent.projectId,
          parentId,
        });
        if (!result.ok) return result;
        created.push(result.value);
      }

      return ok(created);
    });
  }
}
