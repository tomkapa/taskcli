import type { Result } from '../types/common.js';
import { ok, err } from '../types/common.js';
import type {
  ExportData,
  ExportTask,
  ExportDependency,
  FieldMapping,
  ImportResult,
} from '../types/portability.js';
import { ImportFileSchema } from '../types/portability.js';
import type { TaskId } from '../types/branded.js';
import type { TaskService } from './task.service.js';
import type { DependencyService } from './dependency.service.js';
import type { Project } from '../types/project.js';
import { logger } from '../logging/logger.js';
import type { PortabilityServiceError } from './errors.js';
import { PortabilityErr } from './errors.js';

// ── Internal mapped types ─────────────────────────────────────────────

interface MappedTask {
  sourceId: string;
  name: string;
  description: string;
  type: string;
  status: string;
  parentId: string | null;
  technicalNotes: string;
  additionalRequirements: string;
}

interface MappedDependency {
  sourceTaskId: string;
  sourceDependsOnId: string;
  type: string;
}

// ── Service interface ─────────────────────────────────────────────────

export interface PortabilityService {
  exportTasks(project: Project): Result<ExportData, PortabilityServiceError>;
  importTasks(
    fileData: unknown,
    project: Project,
    fieldMapping?: FieldMapping,
  ): Result<ImportResult, PortabilityServiceError>;
}

// ── Implementation ────────────────────────────────────────────────────

export class PortabilityServiceImpl implements PortabilityService {
  constructor(
    private readonly taskService: TaskService,
    private readonly depService: DependencyService,
  ) {}

  exportTasks(project: Project): Result<ExportData, PortabilityServiceError> {
    return logger.startSpan('PortabilityService.exportTasks', () => {
      const tasksResult = this.taskService.listTasks(project, {});
      if (!tasksResult.ok) return err(PortabilityErr.taskService(tasksResult.error));
      const tasks = tasksResult.value;

      const taskIds = new Set(tasks.map((t) => t.id));

      const exportTasks: ExportTask[] = tasks.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        type: t.type,
        status: t.status,
        parentId: t.parentId,
        technicalNotes: t.technicalNotes,
        additionalRequirements: t.additionalRequirements,
        rank: t.rank,
      }));

      // Collect dependencies where both ends belong to this project
      const allDeps: ExportDependency[] = [];
      for (const task of tasks) {
        const depsResult = this.depService.listAllDeps(task.id);
        if (!depsResult.ok) return err(PortabilityErr.depService(depsResult.error));
        for (const dep of depsResult.value) {
          if (taskIds.has(dep.dependsOnId)) {
            allDeps.push({
              taskId: dep.taskId,
              dependsOnId: dep.dependsOnId,
              type: dep.type,
            });
          }
        }
      }

      logger.info('Exported tasks', {
        project: project.key,
        tasks: tasks.length,
        dependencies: allDeps.length,
      });

      return ok({
        version: 1 as const,
        exportedAt: new Date().toISOString(),
        tasks: exportTasks,
        dependencies: allDeps,
      });
    });
  }

  importTasks(
    fileData: unknown,
    project: Project,
    fieldMapping?: FieldMapping,
  ): Result<ImportResult, PortabilityServiceError> {
    return logger.startSpan('PortabilityService.importTasks', () => {
      const parsed = ImportFileSchema.safeParse(fileData);
      if (!parsed.success) {
        return err(PortabilityErr.validation(parsed.error.message));
      }

      const reverseMap = this.buildReverseMap(fieldMapping);

      const mappedTasks: MappedTask[] = [];
      for (const sourceTask of parsed.data.tasks) {
        const mapped = this.mapTaskFields(sourceTask, reverseMap);
        if (!mapped.ok) return mapped;
        mappedTasks.push(mapped.value);
      }

      const mappedDeps: MappedDependency[] = [];
      for (const sourceDep of parsed.data.dependencies) {
        const mapped = this.mapDependencyFields(sourceDep, reverseMap);
        if (!mapped.ok) return mapped;
        mappedDeps.push(mapped.value);
      }

      const sorted = this.topoSortByParent(mappedTasks);

      // sourceId is foreign (from the import file); newId is our branded
      // `TaskId`, returned from the repository on insert.
      const idMap = new Map<string, TaskId>();
      for (const task of sorted) {
        let parentId: string | undefined;
        if (task.parentId) {
          parentId = idMap.get(task.parentId) ?? task.parentId;
        }

        const createResult = this.taskService.createTask(
          {
            name: task.name,
            description: task.description || undefined,
            type: task.type || undefined,
            status: task.status || undefined,
            parentId,
            technicalNotes: task.technicalNotes || undefined,
            additionalRequirements: task.additionalRequirements || undefined,
          },
          project,
        );
        if (!createResult.ok) return err(PortabilityErr.taskService(createResult.error));

        idMap.set(task.sourceId, createResult.value.id);
        logger.info('Imported task', {
          sourceId: task.sourceId,
          newId: createResult.value.id,
        });
      }

      let depCount = 0;
      for (const dep of mappedDeps) {
        const taskId = idMap.get(dep.sourceTaskId) ?? dep.sourceTaskId;
        const dependsOnId = idMap.get(dep.sourceDependsOnId) ?? dep.sourceDependsOnId;

        const depResult = this.depService.addDependency({
          taskId,
          dependsOnId,
          type: dep.type || undefined,
        });
        if (!depResult.ok) return err(PortabilityErr.depService(depResult.error));

        depCount++;
        logger.info('Imported dependency', { from: taskId, to: dependsOnId });
      }

      const idMapObj: Record<string, string> = {};
      for (const [k, v] of idMap) {
        idMapObj[k] = v;
      }

      logger.info('Import completed', {
        tasks: mappedTasks.length,
        dependencies: depCount,
      });

      return ok({
        imported: mappedTasks.length,
        dependencies: depCount,
        idMap: idMapObj,
      });
    });
  }

  // ── Private helpers ───────────────────────────────────────────────

  private buildReverseMap(fieldMapping?: FieldMapping): Map<string, string> {
    const reverse = new Map<string, string>();
    if (!fieldMapping) return reverse;
    for (const [source, target] of fieldMapping) {
      reverse.set(target, source);
    }
    return reverse;
  }

  private getField(
    source: Record<string, unknown>,
    field: string,
    reverseMap: Map<string, string>,
  ): string {
    const sourceField = reverseMap.get(field) ?? field;
    const value = source[sourceField];
    if (value == null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return `${value}`;
    return JSON.stringify(value);
  }

  private mapTaskFields(
    source: Record<string, unknown>,
    reverseMap: Map<string, string>,
  ): Result<MappedTask, PortabilityServiceError> {
    const sourceId = this.getField(source, 'id', reverseMap);
    const name = this.getField(source, 'name', reverseMap);

    if (!sourceId) {
      return err(PortabilityErr.validation('Each imported task must have an id'));
    }
    if (!name) {
      return err(
        PortabilityErr.validation(
          `Imported task '${sourceId}' is missing required field 'name'`,
        ),
      );
    }

    return ok({
      sourceId,
      name,
      description: this.getField(source, 'description', reverseMap),
      type: this.getField(source, 'type', reverseMap),
      status: this.getField(source, 'status', reverseMap),
      parentId: this.getField(source, 'parentId', reverseMap) || null,
      technicalNotes: this.getField(source, 'technicalNotes', reverseMap),
      additionalRequirements: this.getField(source, 'additionalRequirements', reverseMap),
    });
  }

  private mapDependencyFields(
    source: Record<string, unknown>,
    reverseMap: Map<string, string>,
  ): Result<MappedDependency, PortabilityServiceError> {
    const taskId = this.getField(source, 'taskId', reverseMap);
    const dependsOnId = this.getField(source, 'dependsOnId', reverseMap);

    if (!taskId || !dependsOnId) {
      return err(PortabilityErr.validation('Each dependency must have taskId and dependsOnId'));
    }

    return ok({
      sourceTaskId: taskId,
      sourceDependsOnId: dependsOnId,
      type: this.getField(source, 'type', reverseMap),
    });
  }

  /**
   * Sort tasks so parents come before children within the import set.
   * Tasks whose parentId is outside the import set are treated as roots.
   */
  private topoSortByParent(tasks: MappedTask[]): MappedTask[] {
    const sourceIds = new Set(tasks.map((t) => t.sourceId));
    const sorted: MappedTask[] = [];
    const remaining = new Set(tasks);
    const created = new Set<string>();

    while (remaining.size > 0) {
      const batch: MappedTask[] = [];
      for (const task of remaining) {
        const parentInImport = task.parentId !== null && sourceIds.has(task.parentId);
        if (!parentInImport || (task.parentId !== null && created.has(task.parentId))) {
          batch.push(task);
        }
      }

      if (batch.length === 0) {
        logger.warn('Circular parent references detected during import, forcing remaining tasks');
        for (const t of remaining) {
          sorted.push(t);
        }
        break;
      }

      for (const t of batch) {
        remaining.delete(t);
        created.add(t.sourceId);
        sorted.push(t);
      }
    }

    return sorted;
  }
}
