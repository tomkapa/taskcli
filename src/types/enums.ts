export const TaskStatus = {
  Backlog: 'backlog',
  Todo: 'todo',
  InProgress: 'in-progress',
  Review: 'review',
  Done: 'done',
  Cancelled: 'cancelled',
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const TaskType = {
  Story: 'story',
  TechDebt: 'tech-debt',
  Bug: 'bug',
} as const;
export type TaskType = (typeof TaskType)[keyof typeof TaskType];

/** Types stored in the database. */
export const DependencyType = {
  Blocks: 'blocks',
  RelatesTo: 'relates-to',
  Duplicates: 'duplicates',
} as const;
export type DependencyType = (typeof DependencyType)[keyof typeof DependencyType];

/**
 * UI-level dependency types — includes BlockedBy which is a reverse-Blocks
 * relationship resolved before persisting to the database.
 */
export const UIDependencyType = {
  ...DependencyType,
  BlockedBy: 'blocked-by',
} as const;
export type UIDependencyType = (typeof UIDependencyType)[keyof typeof UIDependencyType];

/** Gap between consecutive rank values, used for insertion between neighbors. */
export const RANK_GAP = 1000.0;

/** Statuses that represent terminal/completed task states. */
export const TERMINAL_STATUSES: ReadonlySet<string> = new Set([
  TaskStatus.Done,
  TaskStatus.Cancelled,
]);

export function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}
