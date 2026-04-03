import type { Result } from '../types/common.js';
import { ok, err } from '../types/common.js';
import type { Task, TaskFilter } from '../types/task.js';
import {
  CreateTaskSchema,
  UpdateTaskSchema,
  TaskFilterSchema,
  RerankTaskSchema,
} from '../types/task.js';
import type { TaskRepository, SearchResult } from '../repository/task.repository.js';
import type { ProjectService } from './project.service.js';
import type { DependencyService } from './dependency.service.js';
import { AppError } from '../errors/app-error.js';
import { logger } from '../logging/logger.js';
import { TaskStatus, RANK_GAP, isTerminalStatus, UIDependencyType, DependencyType } from '../types/enums.js';

export interface TaskService {
  createTask(input: unknown, projectIdOrName?: string): Result<Task>;
  getTask(id: string): Result<Task>;
  listTasks(filter: unknown): Result<Task[]>;
  updateTask(id: string, input: unknown): Result<Task>;
  deleteTask(id: string): Result<void>;
  breakdownTask(parentId: string, subtasks: unknown[]): Result<Task[]>;
  rerankTask(input: unknown, projectIdOrName?: string): Result<Task>;
  searchTasks(query: string, projectIdOrName?: string): Result<SearchResult[]>;
}

export class TaskServiceImpl implements TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly projectService: ProjectService,
    private readonly getDependencyService: () => DependencyService,
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

      const project = projectResult.value;
      const taskIdResult = this.projectService.nextTaskId(project);
      if (!taskIdResult.ok) return taskIdResult;

      const insertResult = this.repo.insert(taskIdResult.value, {
        ...parsed.data,
        projectId: project.id,
      });
      if (!insertResult.ok) return insertResult;

      if (parsed.data.dependsOn && parsed.data.dependsOn.length > 0) {
        for (const entry of parsed.data.dependsOn) {
          // blocked-by is a UI-only type: the new task blocks the picked task,
          // so we store the relationship in reverse (picked depends on new task).
          const isBlockedBy = entry.type === UIDependencyType.BlockedBy;
          const depResult = this.getDependencyService().addDependency({
            taskId: isBlockedBy ? entry.id : insertResult.value.id,
            dependsOnId: isBlockedBy ? insertResult.value.id : entry.id,
            type: isBlockedBy ? DependencyType.Blocks : entry.type,
          });
          if (!depResult.ok) return depResult;
        }
      }

      return insertResult;
    });
  }

  getTask(id: string): Result<Task> {
    return logger.startSpan('TaskService.getTask', () => {
      const result = this.repo.findById(id);
      if (!result.ok) return result;
      if (!result.value) {
        return err(new AppError('NOT_FOUND', `Task not found: ${id}`));
      }
      return ok(result.value);
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

      // Check if transitioning to terminal status (done/cancelled)
      if (parsed.data.status && isTerminalStatus(parsed.data.status)) {
        const existingResult = this.repo.findById(id);
        if (!existingResult.ok) return existingResult;
        if (!existingResult.value) {
          return err(new AppError('NOT_FOUND', `Task not found: ${id}`));
        }
        const existing = existingResult.value;

        const updateResult = this.repo.update(id, parsed.data);
        if (!updateResult.ok) return updateResult;

        // Auto-rerank to bottom only when transitioning from active → terminal
        if (!isTerminalStatus(existing.status)) {
          const maxRankResult = this.repo.getMaxRank(existing.projectId);
          if (!maxRankResult.ok) return maxRankResult;
          return this.repo.rerank(id, maxRankResult.value + RANK_GAP);
        }
        return updateResult;
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

      const projectResult = this.projectService.resolveProject(parent.projectId);
      if (!projectResult.ok) return projectResult;
      const project = projectResult.value;

      const created: Task[] = [];

      for (const subtask of subtasks) {
        const parsed = CreateTaskSchema.safeParse(subtask);
        if (!parsed.success) {
          return err(new AppError('VALIDATION', `Invalid subtask: ${parsed.error.message}`));
        }

        const taskIdResult = this.projectService.nextTaskId(project);
        if (!taskIdResult.ok) return taskIdResult;

        const result = this.repo.insert(taskIdResult.value, {
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

  /**
   * Re-rank a task using Jira-style ranking:
   * - afterId: place the task immediately after the given task
   * - beforeId: place the task immediately before the given task
   * - position: place the task at the given 1-based position in the backlog
   *
   * New rank is computed as the midpoint between neighbors.
   * If moving to the top, rank = first_rank - GAP.
   * If moving to the bottom, rank = last_rank + GAP.
   */
  rerankTask(input: unknown, projectIdOrName?: string): Result<Task> {
    return logger.startSpan('TaskService.rerankTask', () => {
      const parsed = RerankTaskSchema.safeParse(input);
      if (!parsed.success) {
        return err(new AppError('VALIDATION', parsed.error.message));
      }

      const { taskId, afterId, beforeId, position } = parsed.data;

      const specifiedCount = [afterId, beforeId, position].filter((v) => v !== undefined).length;
      if (specifiedCount !== 1) {
        return err(
          new AppError(
            'VALIDATION',
            'Exactly one of --after, --before, or --position must be specified',
          ),
        );
      }

      const taskResult = this.repo.findById(taskId);
      if (!taskResult.ok) return taskResult;
      if (!taskResult.value) {
        return err(new AppError('NOT_FOUND', `Task not found: ${taskId}`));
      }
      const task = taskResult.value;

      if (isTerminalStatus(task.status)) {
        return err(
          new AppError(
            'VALIDATION',
            `Cannot rerank a task with status '${task.status}'. Only active tasks can be reranked.`,
          ),
        );
      }

      // Resolve project for getting ranked list
      const projectRef = projectIdOrName ?? task.projectId;
      const projectResult = this.projectService.resolveProject(projectRef);
      if (!projectResult.ok) return projectResult;
      const projectId = projectResult.value.id;

      // Get all backlog tasks in rank order (excluding the task being moved)
      const rankedResult = this.repo.getRankedTasks(projectId, TaskStatus.Backlog);
      if (!rankedResult.ok) return rankedResult;
      const ranked = rankedResult.value.filter((t) => t.id !== taskId);

      let newRank: number;

      if (afterId) {
        const anchor = ranked.find((t) => t.id === afterId);
        if (!anchor) {
          return err(new AppError('NOT_FOUND', `Anchor task not found in backlog: ${afterId}`));
        }
        const anchorIndex = ranked.indexOf(anchor);
        const next = ranked[anchorIndex + 1];
        newRank = next ? (anchor.rank + next.rank) / 2 : anchor.rank + RANK_GAP;
      } else if (beforeId) {
        const anchor = ranked.find((t) => t.id === beforeId);
        if (!anchor) {
          return err(new AppError('NOT_FOUND', `Anchor task not found in backlog: ${beforeId}`));
        }
        const anchorIndex = ranked.indexOf(anchor);
        const prev = ranked[anchorIndex - 1];
        newRank = prev ? (prev.rank + anchor.rank) / 2 : anchor.rank - RANK_GAP;
      } else {
        // position is defined (guaranteed by specifiedCount === 1 check above)
        const pos = position as number;
        if (pos < 1) {
          return err(new AppError('VALIDATION', 'Position must be >= 1'));
        }
        if (pos === 1) {
          const first = ranked[0];
          newRank = first ? first.rank - RANK_GAP : RANK_GAP;
        } else if (pos > ranked.length) {
          const last = ranked[ranked.length - 1];
          newRank = last ? last.rank + RANK_GAP : RANK_GAP;
        } else {
          const above = ranked[pos - 2];
          const below = ranked[pos - 1];
          if (!above || !below) {
            return err(new AppError('DB_ERROR', 'Unexpected missing neighbor tasks'));
          }
          newRank = (above.rank + below.rank) / 2;
        }
      }

      // Dependency constraint: a blocked task must not rank higher (lower number)
      // than any of its blockers, and must not rank lower than any of its dependents.
      const depService = this.getDependencyService();
      const blockersResult = depService.listBlockers(taskId);
      if (blockersResult.ok) {
        for (const blocker of blockersResult.value) {
          if (blocker.projectId === projectId && newRank < blocker.rank) {
            return err(
              new AppError(
                'VALIDATION',
                `Cannot rank above blocker "${blocker.id}" (${blocker.name}). Complete or remove the dependency first.`,
              ),
            );
          }
        }
      }

      const dependentsResult = depService.listDependents(taskId);
      if (dependentsResult.ok) {
        for (const dep of dependentsResult.value) {
          if (dep.projectId === projectId && newRank > dep.rank) {
            return err(
              new AppError(
                'VALIDATION',
                `Cannot rank below dependent "${dep.id}" (${dep.name}). Complete or remove the dependency first.`,
              ),
            );
          }
        }
      }

      return this.repo.rerank(taskId, newRank);
    });
  }

  searchTasks(query: string, projectIdOrName?: string): Result<SearchResult[]> {
    return logger.startSpan('TaskService.searchTasks', () => {
      if (!query.trim()) {
        return err(new AppError('VALIDATION', 'Search query cannot be empty'));
      }

      let projectId: string | undefined;
      if (projectIdOrName) {
        const projectResult = this.projectService.resolveProject(projectIdOrName);
        if (!projectResult.ok) return projectResult;
        projectId = projectResult.value.id;
      }

      return this.repo.search(query, projectId);
    });
  }
}
