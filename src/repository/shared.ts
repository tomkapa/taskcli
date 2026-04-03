import type { Task } from '../types/task.js';
import type { TaskStatus, TaskType } from '../types/enums.js';

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

export function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    projectId: row.project_id,
    parentId: row.parent_id,
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
