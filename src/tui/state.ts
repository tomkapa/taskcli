import { ViewType } from './types.js';
import type { AppState, Action } from './types.js';

export const initialState: AppState = {
  activeView: ViewType.TaskList,
  breadcrumbs: [ViewType.TaskList],
  tasks: [],
  selectedIndex: 0,
  selectedTask: null,
  projects: [],
  activeProject: null,
  filter: { status: 'backlog' },
  searchQuery: '',
  isSearchActive: false,
  isReordering: false,
  reorderSnapshot: null,
  flash: null,
  confirmDelete: null,
  formData: null,
  depBlockers: [],
  depDependents: [],
  depRelated: [],
  depDuplicates: [],
  depSelectedIndex: 0,
  isAddingDep: false,
  addDepInput: '',
  focusedPanel: 'list',
};

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'NAVIGATE_TO':
      return {
        ...state,
        breadcrumbs: [...state.breadcrumbs, action.view],
        activeView: action.view,
        confirmDelete: null,
        focusedPanel: 'list',
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
        focusedPanel: 'list',
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
      return { ...state, filter: { status: 'backlog' }, selectedIndex: 0, searchQuery: '' };

    case 'SET_SEARCH_ACTIVE':
      return { ...state, isSearchActive: action.active };

    case 'SET_SEARCH_QUERY':
      return { ...state, searchQuery: action.query };

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

    case 'SET_CURSOR': {
      const maxIndex = Math.max(0, state.tasks.length - 1);
      return { ...state, selectedIndex: Math.max(0, Math.min(action.index, maxIndex)) };
    }

    case 'SELECT_TASK':
      return { ...state, selectedTask: action.task };

    case 'SET_FORM_DATA':
      return { ...state, formData: action.data };

    case 'ENTER_REORDER':
      return {
        ...state,
        isReordering: true,
        reorderSnapshot: [...state.tasks],
      };

    case 'REORDER_MOVE': {
      if (!state.isReordering) return state;
      const idx = state.selectedIndex;
      const tasks = [...state.tasks];
      const swapIdx = action.direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= tasks.length) return state;

      // Swap tasks in the local array
      const current = tasks[idx];
      const swap = tasks[swapIdx];
      if (!current || !swap) return state;
      tasks[idx] = swap;
      tasks[swapIdx] = current;

      return {
        ...state,
        tasks,
        selectedIndex: swapIdx,
      };
    }

    case 'EXIT_REORDER': {
      if (!action.save && state.reorderSnapshot) {
        // Revert to snapshot
        return {
          ...state,
          isReordering: false,
          tasks: state.reorderSnapshot,
          reorderSnapshot: null,
        };
      }
      return {
        ...state,
        isReordering: false,
        reorderSnapshot: null,
      };
    }

    case 'SET_DEPS':
      return {
        ...state,
        depBlockers: action.blockers,
        depDependents: action.dependents,
        depRelated: action.related,
        depDuplicates: action.duplicates,
        depSelectedIndex: 0,
      };

    case 'DEP_MOVE_CURSOR': {
      const total =
        state.depBlockers.length +
        state.depDependents.length +
        state.depRelated.length +
        state.depDuplicates.length;
      if (total === 0) return state;
      const maxIdx = Math.max(0, total - 1);
      const newIdx =
        action.direction === 'up'
          ? Math.max(0, state.depSelectedIndex - 1)
          : Math.min(maxIdx, state.depSelectedIndex + 1);
      return { ...state, depSelectedIndex: newIdx };
    }

    case 'SET_ADDING_DEP':
      return { ...state, isAddingDep: action.active, addDepInput: '' };

    case 'SET_ADD_DEP_INPUT':
      return { ...state, addDepInput: action.input };

    case 'SET_PANEL_FOCUS':
      return { ...state, focusedPanel: action.panel };
  }
}
