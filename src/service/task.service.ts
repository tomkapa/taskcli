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
import type { TaskId } from '../types/branded.js';
import type { ProjectService } from './project.service.js';
import type { Project } from '../types/project.js';
import type { DependencyService } from './dependency.service.js';
import { logger } from '../logging/logger.js';
import {
  TaskStatus,
  TaskLevel,
  RANK_GAP,
  isTerminalStatus,
  getTaskLevel,
  midpoint,
} from '../types/enums.js';
import type { TaskServiceError } from './errors.js';
import { TaskErr, mapTaskRepo } from './errors.js';

export interface TaskService {
  createTask(input: unknown, project: Project): Result<Task, TaskServiceError>;
  getTask(id: TaskId): Result<Task, TaskServiceError>;
  listTasks(project: Project, filter: unknown): Result<Task[], TaskServiceError>;
  updateTask(id: TaskId, input: unknown): Result<Task, TaskServiceError>;
  deleteTask(id: TaskId): Result<void, TaskServiceError>;
  breakdownTask(parentId: TaskId, subtasks: unknown[]): Result<Task[], TaskServiceError>;
  rerankTask(input: unknown, project: Project): Result<Task, TaskServiceError>;
  searchTasks(query: string, project: Project): Result<SearchResult[], TaskServiceError>;
}

export class TaskServiceImpl implements TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly projectService: ProjectService,
    private readonly getDependencyService: () => DependencyService,
  ) {}

  createTask(input: unknown, project: Project): Result<Task, TaskServiceError> {
    return logger.startSpan('TaskService.createTask', () => {
      const parsed = CreateTaskSchema.safeParse(input);
      if (!parsed.success) {
        return err(TaskErr.validation(parsed.error.message));
      }

      const taskLevel = getTaskLevel(parsed.data.type);

      if (taskLevel === TaskLevel.Release && parsed.data.parentId) {
        return err(TaskErr.validation('Release tasks cannot have a parent'));
      }

      if (parsed.data.parentId) {
        const parentResult = mapTaskRepo(this.repo.findById(parsed.data.parentId));
        if (!parentResult.ok) return parentResult;
        if (!parentResult.value) {
          return err(TaskErr.notFound(parsed.data.parentId));
        }
        if (getTaskLevel(parentResult.value.type) !== TaskLevel.Release) {
          return err(TaskErr.validation('Tasks can only be children of release-level tasks'));
        }
      }

      const taskIdResult = this.projectService.nextTaskId(project);
      if (!taskIdResult.ok) {
        // Project-service failure at task creation — surface as repo-level
        // failure for the caller (rare path; keeps the variant count low).
        return err(TaskErr.validation(taskIdResult.error.message));
      }

      const insertResult = mapTaskRepo(
        this.repo.insert(taskIdResult.value, {
          ...parsed.data,
          projectId: project.id,
        }),
      );
      if (!insertResult.ok) return insertResult;

      if (parsed.data.dependsOn && parsed.data.dependsOn.length > 0) {
        for (const entry of parsed.data.dependsOn) {
          const depResult = this.getDependencyService().addDependency({
            taskId: insertResult.value.id,
            dependsOnId: entry.id,
            type: entry.type,
          });
          if (!depResult.ok) return err(TaskErr.depFailed(depResult.error));
        }
      }

      return insertResult;
    });
  }

  getTask(id: TaskId): Result<Task, TaskServiceError> {
    return logger.startSpan('TaskService.getTask', () => {
      const result = mapTaskRepo(this.repo.findById(id));
      if (!result.ok) return result;
      if (!result.value) {
        return err(TaskErr.notFound(id));
      }
      return ok(result.value);
    });
  }

  listTasks(project: Project, filter: unknown): Result<Task[], TaskServiceError> {
    return logger.startSpan('TaskService.listTasks', () => {
      const parsed = TaskFilterSchema.safeParse(filter);
      if (!parsed.success) {
        return err(TaskErr.validation(parsed.error.message));
      }

      const resolvedFilter: TaskFilter = {
        ...parsed.data,
        projectId: project.id,
      };

      return mapTaskRepo(this.repo.findMany(resolvedFilter));
    });
  }

  updateTask(id: TaskId, input: unknown): Result<Task, TaskServiceError> {
    return logger.startSpan('TaskService.updateTask', () => {
      const parsed = UpdateTaskSchema.safeParse(input);
      if (!parsed.success) {
        return err(TaskErr.validation(parsed.error.message));
      }

      if (parsed.data.status === TaskStatus.InProgress) {
        const blockersResult = this.getDependencyService().listBlockers(id);
        if (!blockersResult.ok) return err(TaskErr.depFailed(blockersResult.error));
        const hasNonTerminalBlocker = blockersResult.value.some((b) => !isTerminalStatus(b.status));
        if (hasNonTerminalBlocker) {
          return err(TaskErr.validation('Task is blocked by unfinished dependencies'));
        }
      }

      const existingResult = mapTaskRepo(this.repo.findById(id));
      if (!existingResult.ok) return existingResult;
      if (!existingResult.value) {
        return err(TaskErr.notFound(id));
      }
      const existing = existingResult.value;

      if (parsed.data.type) {
        const newLevel = getTaskLevel(parsed.data.type);
        const oldLevel = getTaskLevel(existing.type);

        if (newLevel !== oldLevel) {
          if (oldLevel === TaskLevel.Release) {
            const childrenResult = mapTaskRepo(
              this.repo.findMany({
                projectId: existing.projectId,
                parentId: id,
              }),
            );
            if (childrenResult.ok && childrenResult.value.length > 0) {
              return err(
                TaskErr.validation(
                  'Cannot change type from release: task has children. Remove children first.',
                ),
              );
            }
          }
          if (newLevel === TaskLevel.Release && existing.parentId) {
            return err(TaskErr.validation('Cannot change type to release: task has a parent'));
          }
        }
      }

      if (parsed.data.parentId !== undefined) {
        const effectiveType = parsed.data.type ?? existing.type;
        const effectiveLevel = getTaskLevel(effectiveType);

        if (effectiveLevel === TaskLevel.Release && parsed.data.parentId) {
          return err(TaskErr.validation('Release tasks cannot have a parent'));
        }
        if (parsed.data.parentId) {
          const parentResult = mapTaskRepo(this.repo.findById(parsed.data.parentId));
          if (!parentResult.ok) return parentResult;
          if (!parentResult.value) {
            return err(TaskErr.notFound(parsed.data.parentId));
          }
          if (getTaskLevel(parentResult.value.type) !== TaskLevel.Release) {
            return err(TaskErr.validation('Tasks can only be children of release-level tasks'));
          }
        }
      }

      if (parsed.data.status && isTerminalStatus(parsed.data.status)) {
        const effectiveType = parsed.data.type ?? existing.type;
        const level = getTaskLevel(effectiveType);

        const updateResult = mapTaskRepo(this.repo.update(id, parsed.data));
        if (!updateResult.ok) return updateResult;

        if (!isTerminalStatus(existing.status)) {
          const maxRankResult = mapTaskRepo(this.repo.getMaxRankByLevel(existing.projectId, level));
          if (!maxRankResult.ok) return maxRankResult;
          const rerankResult = mapTaskRepo(this.repo.rerank(id, maxRankResult.value + RANK_GAP));
          if (!rerankResult.ok) return rerankResult;
          this.propagateParentStatus(existing);
          return rerankResult;
        }
        this.propagateParentStatus(existing);
        return updateResult;
      }

      const updateResult = mapTaskRepo(this.repo.update(id, parsed.data));
      if (!updateResult.ok) return updateResult;

      if (parsed.data.status && parsed.data.status !== existing.status) {
        this.propagateParentStatus(existing);
      }

      return updateResult;
    });
  }

  deleteTask(id: TaskId): Result<void, TaskServiceError> {
    return mapTaskRepo(this.repo.delete(id));
  }

  breakdownTask(parentId: TaskId, subtasks: unknown[]): Result<Task[], TaskServiceError> {
    return logger.startSpan('TaskService.breakdownTask', () => {
      const parentResult = mapTaskRepo(this.repo.findById(parentId));
      if (!parentResult.ok) return parentResult;
      if (!parentResult.value) {
        return err(TaskErr.notFound(parentId));
      }

      const parent = parentResult.value;

      if (getTaskLevel(parent.type) !== TaskLevel.Release) {
        return err(TaskErr.validation('Breakdown parent must be a release-level task'));
      }

      const projectResult = this.projectService.getProject(parent.projectId);
      if (!projectResult.ok) return err(TaskErr.validation(projectResult.error.message));
      const project = projectResult.value;

      const created: Task[] = [];

      for (const subtask of subtasks) {
        const parsed = CreateTaskSchema.safeParse(subtask);
        if (!parsed.success) {
          return err(TaskErr.validation(`Invalid subtask: ${parsed.error.message}`));
        }

        if (getTaskLevel(parsed.data.type) === TaskLevel.Release) {
          return err(TaskErr.validation(`Subtask "${parsed.data.name}" cannot be a release`));
        }

        const taskIdResult = this.projectService.nextTaskId(project);
        if (!taskIdResult.ok) return err(TaskErr.validation(taskIdResult.error.message));

        const result = mapTaskRepo(
          this.repo.insert(taskIdResult.value, {
            ...parsed.data,
            projectId: parent.projectId,
            parentId,
          }),
        );
        if (!result.ok) return result;
        created.push(result.value);
      }

      return ok(created);
    });
  }

  rerankTask(input: unknown, project: Project): Result<Task, TaskServiceError> {
    return logger.startSpan('TaskService.rerankTask', () => {
      const parsed = RerankTaskSchema.safeParse(input);
      if (!parsed.success) {
        return err(TaskErr.validation(parsed.error.message));
      }

      const { taskId, afterId, beforeId, position, top, bottom } = parsed.data;

      const specifiedCount =
        [afterId, beforeId, position].filter((v) => v !== undefined).length +
        (top ? 1 : 0) +
        (bottom ? 1 : 0);
      if (specifiedCount !== 1) {
        return err(
          TaskErr.validation(
            'Exactly one of --after, --before, --position, --top, or --bottom must be specified',
          ),
        );
      }

      const taskResult = mapTaskRepo(this.repo.findById(taskId));
      if (!taskResult.ok) return taskResult;
      if (!taskResult.value) {
        return err(TaskErr.notFound(taskId));
      }
      const task = taskResult.value;

      if (isTerminalStatus(task.status)) {
        return err(
          TaskErr.validation(
            `Cannot rerank a task with status '${task.status}'. Only active tasks can be reranked.`,
          ),
        );
      }

      const taskLevel = getTaskLevel(task.type);

      const projectId = project.id;

      const depService = this.getDependencyService();
      const blockersResult = depService.listBlockers(taskId);
      if (!blockersResult.ok) return err(TaskErr.depFailed(blockersResult.error));
      const constrainingBlockers = blockersResult.value.filter(
        (b) => !isTerminalStatus(b.status) && b.projectId === projectId,
      );
      const dependentsResult = depService.listDependents(taskId);
      if (!dependentsResult.ok) return err(TaskErr.depFailed(dependentsResult.error));
      const constrainingDependents = dependentsResult.value.filter(
        (d) => !isTerminalStatus(d.status) && d.projectId === projectId,
      );

      const attempt = (): Result<number | null, TaskServiceError> => {
        const rankedResult = mapTaskRepo(
          this.repo.getRankedNonTerminalTasksByLevel(projectId, taskLevel),
        );
        if (!rankedResult.ok) return rankedResult;
        const ranked = rankedResult.value.filter((t) => t.id !== taskId);

        if (top === true) {
          return ok(this.computeTopRank(ranked, constrainingBlockers));
        }
        if (bottom === true) {
          const minTerminalResult = mapTaskRepo(
            this.repo.getMinTerminalRankByLevel(projectId, taskLevel),
          );
          if (!minTerminalResult.ok) return minTerminalResult;
          return ok(
            this.computeBottomRank(ranked, minTerminalResult.value, constrainingDependents),
          );
        }
        if (afterId) {
          const anchorIndex = ranked.findIndex((t) => t.id === afterId);
          const anchor = ranked[anchorIndex];
          if (!anchor) {
            return err(TaskErr.notFound(afterId));
          }
          const next = ranked[anchorIndex + 1];
          return ok(next ? midpoint(anchor.rank, next.rank) : anchor.rank + RANK_GAP);
        }
        if (beforeId) {
          const anchorIndex = ranked.findIndex((t) => t.id === beforeId);
          const anchor = ranked[anchorIndex];
          if (!anchor) {
            return err(TaskErr.notFound(beforeId));
          }
          const prev = ranked[anchorIndex - 1];
          return ok(prev ? midpoint(prev.rank, anchor.rank) : anchor.rank - RANK_GAP);
        }
        const pos = position as number;
        if (pos < 1) {
          return err(TaskErr.validation('Position must be >= 1'));
        }
        if (pos === 1) {
          return ok(this.computeTopRank(ranked));
        }
        if (pos > ranked.length) {
          const minTerminalResult = mapTaskRepo(
            this.repo.getMinTerminalRankByLevel(projectId, taskLevel),
          );
          if (!minTerminalResult.ok) return minTerminalResult;
          return ok(this.computeBottomRank(ranked, minTerminalResult.value));
        }
        const above = ranked[pos - 2];
        const below = ranked[pos - 1];
        if (!above || !below) {
          return err(TaskErr.validation('Unexpected missing neighbor tasks'));
        }
        return ok(midpoint(above.rank, below.rank));
      };

      let computed = attempt();
      if (!computed.ok) return computed;
      if (computed.value === null) {
        const rb = mapTaskRepo(this.repo.rebalanceByLevel(projectId, taskLevel));
        if (!rb.ok) return rb;
        computed = attempt();
        if (!computed.ok) return computed;
        if (computed.value === null) {
          return err(TaskErr.validation('Rank computation did not converge after rebalance'));
        }
      }
      const newRank = computed.value;

      for (const blocker of constrainingBlockers) {
        if (newRank < blocker.rank) {
          return err(
            TaskErr.validation(
              `Cannot rank above blocker "${blocker.id}" (${blocker.name}). Complete or remove the dependency first.`,
            ),
          );
        }
      }
      for (const dep of constrainingDependents) {
        if (newRank > dep.rank) {
          return err(
            TaskErr.validation(
              `Cannot rank below dependent "${dep.id}" (${dep.name}). Complete or remove the dependency first.`,
            ),
          );
        }
      }

      return mapTaskRepo(this.repo.rerank(taskId, newRank));
    });
  }

  searchTasks(query: string, project: Project): Result<SearchResult[], TaskServiceError> {
    return logger.startSpan('TaskService.searchTasks', () => {
      if (!query.trim()) {
        return err(TaskErr.validation('Search query cannot be empty'));
      }

      return mapTaskRepo(this.repo.search(query, project.id));
    });
  }

  private computeTopRank(ranked: Task[], constrainingBlockers: Task[] = []): number | null {
    if (constrainingBlockers.length > 0) {
      const highestBlocker = constrainingBlockers.reduce((a, b) => (a.rank > b.rank ? a : b));
      const idx = ranked.findIndex((t) => t.id === highestBlocker.id);
      if (idx >= 0) {
        const next = ranked[idx + 1];
        return next ? midpoint(highestBlocker.rank, next.rank) : highestBlocker.rank + RANK_GAP;
      }
    }
    const first = ranked[0];
    return first ? first.rank - RANK_GAP : RANK_GAP;
  }

  private computeBottomRank(
    ranked: Task[],
    minTerminal: number | null,
    constrainingDependents: Task[] = [],
  ): number | null {
    if (constrainingDependents.length > 0) {
      const lowestDependent = constrainingDependents.reduce((a, b) => (a.rank < b.rank ? a : b));
      const idx = ranked.findIndex((t) => t.id === lowestDependent.id);
      if (idx >= 0) {
        const prev = ranked[idx - 1];
        return prev ? midpoint(prev.rank, lowestDependent.rank) : lowestDependent.rank - RANK_GAP;
      }
    }
    const last = ranked[ranked.length - 1];
    if (!last) return RANK_GAP;
    return minTerminal !== null && minTerminal > last.rank
      ? midpoint(last.rank, minTerminal)
      : last.rank + RANK_GAP;
  }

  /** Best-effort parent status propagation; swallows repo errors. */
  private propagateParentStatus(child: Task): void {
    if (!child.parentId) return;

    const parentResult = this.repo.findById(child.parentId);
    if (!parentResult.ok || !parentResult.value) return;
    const parent = parentResult.value;

    const updatedChildResult = this.repo.findById(child.id);
    if (!updatedChildResult.ok || !updatedChildResult.value) return;
    const updatedChild = updatedChildResult.value;

    if (
      updatedChild.status === TaskStatus.InProgress &&
      (parent.status === TaskStatus.Backlog || parent.status === TaskStatus.Todo)
    ) {
      this.repo.update(parent.id, { status: TaskStatus.InProgress });
      return;
    }

    if (isTerminalStatus(updatedChild.status)) {
      const siblingsResult = this.repo.findMany({
        projectId: parent.projectId,
        parentId: parent.id,
      });
      if (!siblingsResult.ok) return;
      const allTerminal = siblingsResult.value.every((s) => isTerminalStatus(s.status));
      if (allTerminal && !isTerminalStatus(parent.status)) {
        const maxRankResult = this.repo.getMaxRankByLevel(
          parent.projectId,
          getTaskLevel(parent.type),
        );
        this.repo.update(parent.id, { status: TaskStatus.Done });
        if (maxRankResult.ok) {
          this.repo.rerank(parent.id, maxRankResult.value + RANK_GAP);
        }
      }
    }
  }
}
