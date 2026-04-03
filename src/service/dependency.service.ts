import type { Result } from '../types/common.js';
import { ok, err } from '../types/common.js';
import type { Task } from '../types/task.js';
import type { TaskDependency } from '../types/dependency.js';
import { AddDependencySchema, RemoveDependencySchema } from '../types/dependency.js';
import type { DependencyRepository } from '../repository/dependency.repository.js';
import type { TaskRepository } from '../repository/task.repository.js';
import { AppError } from '../errors/app-error.js';
import { logger } from '../logging/logger.js';
import { UIDependencyType, DependencyType } from '../types/enums.js';

export interface DependencyEdge {
  from: string;
  to: string;
  type: string;
}

export interface DependencyGraph {
  nodes: Task[];
  edges: DependencyEdge[];
  mermaid: string;
}

export interface DependencyService {
  addDependency(input: unknown): Result<TaskDependency>;
  removeDependency(input: unknown): Result<void>;
  /** Remove a dependency between two tasks regardless of which direction it was stored. */
  removeDependencyBetween(taskId: string, otherId: string): Result<void>;
  listBlockers(taskId: string): Result<Task[]>;
  listDependents(taskId: string): Result<Task[]>;
  listRelated(taskId: string): Result<Task[]>;
  listDuplicates(taskId: string): Result<Task[]>;
  listAllDeps(taskId: string): Result<TaskDependency[]>;
  getTransitiveDeps(taskId: string): Result<Task[]>;
  buildGraph(taskId: string): Result<DependencyGraph>;
}

export class DependencyServiceImpl implements DependencyService {
  constructor(
    private readonly depRepo: DependencyRepository,
    private readonly taskRepo: TaskRepository,
  ) {}

  private requireTask(taskId: string): Result<Task> {
    const result = this.taskRepo.findById(taskId);
    if (!result.ok) return result;
    if (!result.value) {
      return err(new AppError('NOT_FOUND', `Task not found: ${taskId}`));
    }
    return ok(result.value);
  }

  addDependency(input: unknown): Result<TaskDependency> {
    return logger.startSpan('DependencyService.addDependency', () => {
      // Normalize blocked-by: callers express "A is blocked-by B" as
      // {taskId: A, dependsOnId: B, type: blocked-by}; we store it as
      // {taskId: B, dependsOnId: A, type: blocks} (B blocks A).
      const normalized = normalizeBlockedBy(input);
      const parsed = AddDependencySchema.safeParse(normalized);
      if (!parsed.success) {
        return err(new AppError('VALIDATION', parsed.error.message));
      }

      const { taskId, dependsOnId, type } = parsed.data;

      const taskResult = this.requireTask(taskId);
      if (!taskResult.ok) return taskResult;

      const depResult = this.requireTask(dependsOnId);
      if (!depResult.ok) return depResult;

      const cycleResult = this.depRepo.wouldCreateCycle(taskId, dependsOnId);
      if (!cycleResult.ok) return cycleResult;
      if (cycleResult.value) {
        return err(
          new AppError(
            'VALIDATION',
            `Adding this dependency would create a cycle: ${taskId} -> ${dependsOnId}`,
          ),
        );
      }

      return this.depRepo.insert(taskId, dependsOnId, type);
    });
  }

  removeDependency(input: unknown): Result<void> {
    return logger.startSpan('DependencyService.removeDependency', () => {
      const parsed = RemoveDependencySchema.safeParse(input);
      if (!parsed.success) {
        return err(new AppError('VALIDATION', parsed.error.message));
      }
      return this.depRepo.delete(parsed.data.taskId, parsed.data.dependsOnId);
    });
  }

  removeDependencyBetween(taskId: string, otherId: string): Result<void> {
    return logger.startSpan('DependencyService.removeDependencyBetween', () => {
      const forward = this.depRepo.delete(taskId, otherId);
      if (forward.ok) return forward;
      return this.depRepo.delete(otherId, taskId);
    });
  }

  listBlockers(taskId: string): Result<Task[]> {
    return this.depRepo.getBlockers(taskId);
  }

  listDependents(taskId: string): Result<Task[]> {
    return this.depRepo.getDependents(taskId);
  }

  listRelated(taskId: string): Result<Task[]> {
    return this.depRepo.getRelated(taskId);
  }

  listDuplicates(taskId: string): Result<Task[]> {
    return this.depRepo.getDuplicates(taskId);
  }

  listAllDeps(taskId: string): Result<TaskDependency[]> {
    return this.depRepo.findByTask(taskId);
  }

  getTransitiveDeps(taskId: string): Result<Task[]> {
    return this.depRepo.getTransitiveClosure(taskId);
  }

  buildGraph(taskId: string): Result<DependencyGraph> {
    return logger.startSpan('DependencyService.buildGraph', () => {
      const taskResult = this.taskRepo.findById(taskId);
      if (!taskResult.ok) return taskResult;
      if (!taskResult.value) {
        return err(new AppError('NOT_FOUND', `Task not found: ${taskId}`));
      }
      const rootTask = taskResult.value;

      // Collect all reachable nodes via BFS in both directions
      const visited = new Map<string, Task>();
      const allEdges: DependencyEdge[] = [];
      const queue: string[] = [taskId];
      visited.set(taskId, rootTask);

      while (queue.length > 0) {
        const current = queue.shift();
        if (!current) break;

        // Outgoing: things this task depends on
        const blockersResult = this.depRepo.findByTask(current);
        if (!blockersResult.ok) return blockersResult;
        for (const dep of blockersResult.value) {
          allEdges.push({ from: dep.taskId, to: dep.dependsOnId, type: dep.type });
          if (!visited.has(dep.dependsOnId)) {
            const t = this.taskRepo.findById(dep.dependsOnId);
            if (!t.ok) return t;
            if (t.value) {
              visited.set(dep.dependsOnId, t.value);
              queue.push(dep.dependsOnId);
            }
          }
        }

        // Incoming: things that depend on this task
        const dependentsResult = this.depRepo.findDependents(current);
        if (!dependentsResult.ok) return dependentsResult;
        for (const dep of dependentsResult.value) {
          allEdges.push({ from: dep.taskId, to: dep.dependsOnId, type: dep.type });
          if (!visited.has(dep.taskId)) {
            const t = this.taskRepo.findById(dep.taskId);
            if (!t.ok) return t;
            if (t.value) {
              visited.set(dep.taskId, t.value);
              queue.push(dep.taskId);
            }
          }
        }
      }

      // Deduplicate edges
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

  private toMermaid(nodes: Task[], edges: DependencyEdge[], highlightId: string): string {
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

/**
 * Normalizes a blocked-by relationship before schema validation.
 * "A blocked-by B" is stored as "B blocks A": swap taskId/dependsOnId
 * and change type from blocked-by to blocks.
 */
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
