import { z } from 'zod/v4';
import type { TaskId } from './branded.js';

// ── Export types ──────────────────────────────────────────────────────

export interface ExportTask {
  id: TaskId;
  name: string;
  description: string;
  type: string;
  status: string;
  parentId: TaskId | null;
  technicalNotes: string;
  additionalRequirements: string;
  rank: number;
}

export interface ExportDependency {
  taskId: TaskId;
  dependsOnId: TaskId;
  type: string;
}

export interface ExportData {
  version: 1;
  exportedAt: string;
  tasks: ExportTask[];
  dependencies: ExportDependency[];
}

// ── Import types ──────────────────────────────────────────────────────

/** Loose schema: tasks/dependencies are arbitrary objects to allow field mapping. */
export const ImportFileSchema = z.object({
  version: z.number().optional(),
  tasks: z.array(z.record(z.string(), z.unknown())).min(1, 'At least one task is required'),
  dependencies: z.array(z.record(z.string(), z.unknown())).optional().default([]),
});
export type ImportFile = z.infer<typeof ImportFileSchema>;

/** Map from source field name → our field name. */
export type FieldMapping = Map<string, string>;

export interface ImportResult {
  imported: number;
  dependencies: number;
  idMap: Record<string, string>;
}

// ── Helpers ───────────────────────────────────────────────────────────

/**
 * Parse a comma-separated "source:target" mapping string.
 * Example: "title:name,summary:description,key:id"
 */
export function parseFieldMapping(raw: string): FieldMapping {
  const mapping = new Map<string, string>();
  for (const pair of raw.split(',')) {
    const parts = pair.split(':').map((s) => s.trim());
    if (parts.length === 2 && parts[0] && parts[1]) {
      mapping.set(parts[0], parts[1]);
    }
  }
  return mapping;
}
