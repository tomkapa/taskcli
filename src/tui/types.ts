import type { Task } from '../types/task.js';
import type { Project } from '../types/project.js';
import type { TaskFilter } from '../types/task.js';

export const ViewType = {
  TaskList: 'task-list',
  TaskDetail: 'task-detail',
  TaskCreate: 'task-create',
  TaskEdit: 'task-edit',
  ProjectSelector: 'project-selector',
  Help: 'help',
} as const;
export type ViewType = (typeof ViewType)[keyof typeof ViewType];

export type FlashLevel = 'info' | 'warn' | 'error';

export const SortColumn = {
  Priority: 'priority',
  Status: 'status',
  Type: 'type',
  Name: 'name',
} as const;
export type SortColumn = (typeof SortColumn)[keyof typeof SortColumn];

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

export interface AppState {
  activeView: ViewType;
  breadcrumbs: ViewType[];
  tasks: Task[];
  selectedIndex: number;
  selectedTask: Task | null;
  projects: Project[];
  activeProject: Project | null;
  filter: TaskFilter;
  searchQuery: string;
  isSearchActive: boolean;
  sort: SortState;
  flash: { message: string; level: FlashLevel } | null;
  confirmDelete: Task | null;
  formData: Partial<FormData> | null;
}

export interface FormData {
  name: string;
  description: string;
  type: string;
  status: string;
  priority: number;
  technicalNotes: string;
  additionalRequirements: string;
  parentId: string;
}

export type Action =
  | { type: 'NAVIGATE_TO'; view: ViewType }
  | { type: 'GO_BACK' }
  | { type: 'SET_TASKS'; tasks: Task[] }
  | { type: 'SET_PROJECTS'; projects: Project[] }
  | { type: 'SET_ACTIVE_PROJECT'; project: Project | null }
  | { type: 'SET_FILTER'; filter: Partial<TaskFilter> }
  | { type: 'CLEAR_FILTER' }
  | { type: 'SET_SEARCH_ACTIVE'; active: boolean }
  | { type: 'SET_SEARCH_QUERY'; query: string }
  | { type: 'FLASH'; message: string; level: FlashLevel }
  | { type: 'CLEAR_FLASH' }
  | { type: 'CONFIRM_DELETE'; task: Task }
  | { type: 'CANCEL_DELETE' }
  | { type: 'CYCLE_SORT'; column: SortColumn }
  | { type: 'MOVE_CURSOR'; direction: 'up' | 'down' }
  | { type: 'SELECT_TASK'; task: Task }
  | { type: 'SET_FORM_DATA'; data: Partial<FormData> | null };
