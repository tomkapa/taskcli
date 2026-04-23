import type { Task } from '../../types/task.js';
import type { TaskStatus, TaskType } from '../../types/enums.js';
import type { Project } from '../../types/project.js';
import { GitRemote } from '../../types/git-remote.js';
import type { TaskDependency } from '../../types/dependency.js';
import type { DependencyType } from '../../types/enums.js';
import { TaskId, ProjectId } from '../../types/branded.js';
import assert from 'node:assert';

export const NOT_DELETED = 'deleted_at IS NULL';

export interface TaskRow {
  id: string;
  project_id: string;
  parent_id: string | null;
  name: string;
  description: string;
  type: string;
  status: string;
  rank: number;
  technical_notes: string;
  additional_requirements: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectRow {
  id: string;
  key: string;
  name: string;
  description: string;
  is_default: number;
  task_counter: number;
  git_remote: string | null;
  created_at: string;
  updated_at: string;
}

export interface DependencyRow {
  task_id: string;
  depends_on_id: string;
  type: string;
  created_at: string;
}

export function rowToTask(row: TaskRow): Task {
  assert(typeof row.id === 'string' && row.id.length > 0, 'TaskRow.id missing');
  assert(
    typeof row.project_id === 'string' && row.project_id.length > 0,
    'TaskRow.project_id missing',
  );
  return {
    id: TaskId.unsafe(row.id),
    projectId: ProjectId.unsafe(row.project_id),
    parentId: row.parent_id ? TaskId.unsafe(row.parent_id) : null,
    name: row.name,
    description: row.description,
    type: row.type as TaskType,
    status: row.status as TaskStatus,
    rank: row.rank,
    technicalNotes: row.technical_notes,
    additionalRequirements: row.additional_requirements,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToProject(row: ProjectRow): Project {
  assert(typeof row.id === 'string' && row.id.length > 0, 'ProjectRow.id missing');
  assert(typeof row.key === 'string' && row.key.length > 0, 'ProjectRow.key missing');
  return {
    id: ProjectId.unsafe(row.id),
    key: row.key,
    name: row.name,
    description: row.description,
    isDefault: row.is_default === 1,
    gitRemote: row.git_remote ? GitRemote.parse(row.git_remote) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function rowToDependency(row: DependencyRow): TaskDependency {
  assert(
    typeof row.task_id === 'string' && row.task_id.length > 0,
    'DependencyRow.task_id missing',
  );
  assert(
    typeof row.depends_on_id === 'string' && row.depends_on_id.length > 0,
    'DependencyRow.depends_on_id missing',
  );
  return {
    taskId: TaskId.unsafe(row.task_id),
    dependsOnId: TaskId.unsafe(row.depends_on_id),
    type: row.type as DependencyType,
    createdAt: row.created_at,
  };
}
