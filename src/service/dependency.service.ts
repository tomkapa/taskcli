import type { Result } from '../types/common.js';
import { ok, err } from '../types/common.js';
import type { Task } from '../types/task.js';
import type { TaskDependency } from '../types/dependency.js';
import { AddDependencySchema, RemoveDependencySchema } from '../types/dependency.js';
import type { DependencyRepository } from '../repository/dependency.repository.js';
import type { TaskRepository } from '../repository/task.repository.js';
import { logger } from '../logging/logger.js';
import { UIDependencyType, DependencyType } from '../types/enums.js';
import type { TaskId } from '../types/branded.js';
import type { DependencyServiceError } from './errors.js';
import { DepErr, mapDepRepo } from './errors.js';

export interface DependencyEdge {
  from: TaskId;
  to: TaskId;
  type: string;
}

export interface DependencyGraph {
  nodes: Task[];
  edges: DependencyEdge[];
  mermaid: string;
}

export interface DependencyService {
  addDependency(input: unknown): Result<TaskDependency, DependencyServiceError>;
  removeDependency(input: unknown): Result<void, DependencyServiceError>;
  /** Remove a dependency between two tasks regardless of which direction it was stored. */
  removeDependencyBetween(
    taskId: TaskId,
    otherId: TaskId,
  ): Result<void, DependencyServiceError>;
  listBlockers(taskId: TaskId): Result<Task[], DependencyServiceError>;
  listDependents(taskId: TaskId): Result<Task[], DependencyServiceError>;
  listRelated(taskId: TaskId): Result<Task[], DependencyServiceError>;
  listDuplicates(taskId: TaskId): Result<Task[], DependencyServiceError>;
  listAllDeps(taskId: TaskId): Result<TaskDependency[], DependencyServiceError>;
  getTransitiveDeps(taskId: TaskId): Result<Task[], DependencyServiceError>;
  buildGraph(taskId: TaskId): Result<DependencyGraph, DependencyServiceError>;
}

export class DependencyServiceImpl implements DependencyService {
  constructor(
    private readonly depRepo: DependencyRepository,
    private readonly taskRepo: TaskRepository,
  ) {}

  private requireTask(taskId: TaskId): Result<Task, DependencyServiceError> {
    const result = mapDepRepo(this.taskRepo.findById(taskId));
    if (!result.ok) return result;
    if (!result.value) {
      return err(DepErr.taskNotFound(taskId));
    }
    return ok(result.value);
  }

  addDependency(input: unknown): Result<TaskDependency, DependencyServiceError> {
    return logger.startSpan('DependencyService.addDependency', () => {
      const normalized = normalizeBlockedBy(input);
      const parsed = AddDependencySchema.safeParse(normalized);
      if (!parsed.success) {
        return err(DepErr.validation(parsed.error.message));
      }

      const { taskId, dependsOnId, type } = parsed.data;

      const taskResult = this.requireTask(taskId);
      if (!taskResult.ok) return taskResult;

      const depResult = this.requireTask(dependsOnId);
      if (!depResult.ok) return depResult;

      const cycleResult = mapDepRepo(this.depRepo.wouldCreateCycle(taskId, dependsOnId));
      if (!cycleResult.ok) return cycleResult;
      if (cycleResult.value) {
        return err(DepErr.cycle(taskId, dependsOnId));
      }

      return mapDepRepo(this.depRepo.insert(taskId, dependsOnId, type));
    });
  }

  removeDependency(input: unknown): Result<void, DependencyServiceError> {
    return logger.startSpan('DependencyService.removeDependency', () => {
      const parsed = RemoveDependencySchema.safeParse(input);
      if (!parsed.success) {
        return err(DepErr.validation(parsed.error.message));
      }
      return mapDepRepo(this.depRepo.delete(parsed.data.taskId, parsed.data.dependsOnId));
    });
  }

  removeDependencyBetween(taskId: TaskId, otherId: TaskId): Result<void, DependencyServiceError> {
    return logger.startSpan('DependencyService.removeDependencyBetween', () => {
      const forward = mapDepRepo(this.depRepo.delete(taskId, otherId));
      if (forward.ok) return forward;
      return mapDepRepo(this.depRepo.delete(otherId, taskId));
    });
  }

  listBlockers(taskId: TaskId): Result<Task[], DependencyServiceError> {
    return mapDepRepo(this.depRepo.getBlockers(taskId));
  }

  listDependents(taskId: TaskId): Result<Task[], DependencyServiceError> {
    return mapDepRepo(this.depRepo.getDependents(taskId));
  }

  listRelated(taskId: TaskId): Result<Task[], DependencyServiceError> {
    return mapDepRepo(this.depRepo.getRelated(taskId));
  }

  listDuplicates(taskId: TaskId): Result<Task[], DependencyServiceError> {
    return mapDepRepo(this.depRepo.getDuplicates(taskId));
  }

  listAllDeps(taskId: TaskId): Result<TaskDependency[], DependencyServiceError> {
    return mapDepRepo(this.depRepo.findByTask(taskId));
  }

  getTransitiveDeps(taskId: TaskId): Result<Task[], DependencyServiceError> {
    return mapDepRepo(this.depRepo.getTransitiveClosure(taskId));
  }

  buildGraph(taskId: TaskId): Result<DependencyGraph, DependencyServiceError> {
    return logger.startSpan('DependencyService.buildGraph', () => {
      const taskResult = mapDepRepo(this.taskRepo.findById(taskId));
      if (!taskResult.ok) return taskResult;
      if (!taskResult.value) {
        return err(DepErr.taskNotFound(taskId));
      }
      const rootTask = taskResult.value;

      const visited = new Map<TaskId, Task>();
      const allEdges: DependencyEdge[] = [];
      const queue: TaskId[] = [taskId];
      visited.set(taskId, rootTask);

      while (queue.length > 0) {
        const current = queue.shift();
        if (!current) break;

        const blockersResult = mapDepRepo(this.depRepo.findByTask(current));
        if (!blockersResult.ok) return blockersResult;
        for (const dep of blockersResult.value) {
          allEdges.push({ from: dep.taskId, to: dep.dependsOnId, type: dep.type });
          if (!visited.has(dep.dependsOnId)) {
            const t = mapDepRepo(this.taskRepo.findById(dep.dependsOnId));
            if (!t.ok) return t;
            if (t.value) {
              visited.set(dep.dependsOnId, t.value);
              queue.push(dep.dependsOnId);
            }
          }
        }

        const dependentsResult = mapDepRepo(this.depRepo.findDependents(current));
        if (!dependentsResult.ok) return dependentsResult;
        for (const dep of dependentsResult.value) {
          allEdges.push({ from: dep.taskId, to: dep.dependsOnId, type: dep.type });
          if (!visited.has(dep.taskId)) {
            const t = mapDepRepo(this.taskRepo.findById(dep.taskId));
            if (!t.ok) return t;
            if (t.value) {
              visited.set(dep.taskId, t.value);
              queue.push(dep.taskId);
            }
          }
        }
      }

      const edgeSet = new Set<string>();
      const uniqueEdges: DependencyEdge[] = [];
      for (const edge of allEdges) {
        const key = `${edge.from}->${edge.to}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          uniqueEdges.push(edge);
        }
      }

      const nodes = Array.from(visited.values());
      const mermaid = this.toMermaid(nodes, uniqueEdges, taskId);

      return ok({ nodes, edges: uniqueEdges, mermaid });
    });
  }

  private toMermaid(nodes: Task[], edges: DependencyEdge[], highlightId: TaskId): string {
    const lines: string[] = ['graph LR'];

    for (const node of nodes) {
      const label = `${node.id}: ${node.name} [${node.status}]`;
      const escaped = label.replace(/"/g, '#quot;');
      if (node.id === highlightId) {
        lines.push(`  ${node.id}("${escaped}"):::highlight`);
      } else {
        lines.push(`  ${node.id}["${escaped}"]`);
      }
    }

    for (const edge of edges) {
      const label = edge.type === 'blocks' ? 'blocks' : edge.type;
      lines.push(`  ${edge.from} -->|${label}| ${edge.to}`);
    }

    lines.push('  classDef highlight fill:#f9f,stroke:#333,stroke-width:2px');

    return lines.join('\n');
  }
}

function normalizeBlockedBy(input: unknown): unknown {
  if (
    typeof input === 'object' &&
    input !== null &&
    'type' in input &&
    (input as Record<string, unknown>).type === UIDependencyType.BlockedBy
  ) {
    const { taskId, dependsOnId, ...rest } = input as Record<string, unknown>;
    return { ...rest, taskId: dependsOnId, dependsOnId: taskId, type: DependencyType.Blocks };
  }
  return input;
}
