import { ViewType, SortColumn } from './types.js';
import type { AppState, Action } from './types.js';

export const initialState: AppState = {
  activeView: ViewType.TaskList,
  breadcrumbs: [ViewType.TaskList],
  tasks: [],
  selectedIndex: 0,
  selectedTask: null,
  projects: [],
  activeProject: null,
  filter: {},
  searchQuery: '',
  isSearchActive: false,
  sort: { column: SortColumn.Priority, direction: 'asc' },
  flash: null,
  confirmDelete: null,
  formData: null,
};

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'NAVIGATE_TO':
      return {
        ...state,
        breadcrumbs: [...state.breadcrumbs, action.view],
        activeView: action.view,
        confirmDelete: null,
      };

    case 'GO_BACK': {
      const crumbs =
        state.breadcrumbs.length > 1 ? state.breadcrumbs.slice(0, -1) : [ViewType.TaskList];
      return {
        ...state,
        activeView: crumbs[crumbs.length - 1] ?? ViewType.TaskList,
        breadcrumbs: crumbs,
        confirmDelete: null,
        isSearchActive: false,
        formData: null,
      };
    }

    case 'SET_TASKS':
      return {
        ...state,
        tasks: action.tasks,
        selectedIndex: Math.min(state.selectedIndex, Math.max(0, action.tasks.length - 1)),
      };

    case 'SET_PROJECTS':
      return { ...state, projects: action.projects };

    case 'SET_ACTIVE_PROJECT':
      return { ...state, activeProject: action.project };

    case 'SET_FILTER':
      return {
        ...state,
        filter: { ...state.filter, ...action.filter },
        selectedIndex: 0,
      };

    case 'CLEAR_FILTER':
      return { ...state, filter: {}, selectedIndex: 0, searchQuery: '' };

    case 'SET_SEARCH_ACTIVE':
      return { ...state, isSearchActive: action.active };

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.query };

    case 'CYCLE_SORT': {
      const current = state.sort;
      if (current.column === action.column) {
        // Same column: toggle direction
        return {
          ...state,
          sort: { column: action.column, direction: current.direction === 'asc' ? 'desc' : 'asc' },
          selectedIndex: 0,
        };
      }
      // Different column: set to asc
      return {
        ...state,
        sort: { column: action.column, direction: 'asc' },
        selectedIndex: 0,
      };
    }

    case 'FLASH':
      return {
        ...state,
        flash: { message: action.message, level: action.level },
      };

    case 'CLEAR_FLASH':
      return { ...state, flash: null };

    case 'CONFIRM_DELETE':
      return { ...state, confirmDelete: action.task };

    case 'CANCEL_DELETE':
      return { ...state, confirmDelete: null };

    case 'MOVE_CURSOR': {
      const maxIndex = Math.max(0, state.tasks.length - 1);
      const newIndex =
        action.direction === 'up'
          ? Math.max(0, state.selectedIndex - 1)
          : Math.min(maxIndex, state.selectedIndex + 1);
      return { ...state, selectedIndex: newIndex };
    }

    case 'SELECT_TASK':
      return { ...state, selectedTask: action.task };

    case 'SET_FORM_DATA':
      return { ...state, formData: action.data };
  }
}
