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

export const Priority = {
  Critical: 1,
  High: 2,
  Medium: 3,
  Low: 4,
  Lowest: 5,
} as const;
export type Priority = (typeof Priority)[keyof typeof Priority];
