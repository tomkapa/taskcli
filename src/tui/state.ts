import { ViewType, TopTab } from './types.js';
import type { AppState, Action } from './types.js';
import { PAGE_SIZE } from './constants.js';

function swapAt<T>(arr: T[], i: number, j: number): T[] {
  const next = [...arr];
  const a = next[i];
  const b = next[j];
  if (a === undefined || b === undefined) return arr;
  next[i] = b;
  next[j] = a;
  return next;
}

export const initialState: AppState = {
  activeView: ViewType.TaskList,
  breadcrumbs: [ViewType.TaskList],
  activeTab: TopTab.Tasks,
  tasks: [],
  selectedIndex: 0,
  selectedTask: null,
  projects: [],
  activeProject: null,
  filter: {},
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
  detailScrollOffset: 0,
  releases: [],
  releaseSelectedIndex: 0,
  selectedReleaseIds: new Set(),
  linkingProject: null,
  editingProject: null,
  isReleaseReordering: false,
  releaseReorderSnapshot: null,
  detectedGitRemote: null,
  changelogEntries: null,
  changelogIndex: 0,
  changelogDialogOpen: false,
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
        linkingProject: null,
        editingProject: null,
        detectedGitRemote: null,
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
      return { ...state, filter: {}, selectedIndex: 0, searchQuery: '' };

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
      return { ...state, selectedIndex: newIndex, detailScrollOffset: 0 };
    }

    case 'PAGE_CURSOR': {
      const maxIndex = Math.max(0, state.tasks.length - 1);
      const newIndex =
        action.direction === 'up'
          ? Math.max(0, state.selectedIndex - PAGE_SIZE)
          : Math.min(maxIndex, state.selectedIndex + PAGE_SIZE);
      return { ...state, selectedIndex: newIndex, detailScrollOffset: 0 };
    }

    case 'SET_CURSOR': {
      const maxIndex = Math.max(0, state.tasks.length - 1);
      return { ...state, selectedIndex: Math.max(0, Math.min(action.index, maxIndex)) };
    }

    case 'SELECT_TASK':
      return { ...state, selectedTask: action.task, detailScrollOffset: 0 };

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
      const swapIdx = action.direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= state.tasks.length) return state;
      return { ...state, tasks: swapAt(state.tasks, idx, swapIdx), selectedIndex: swapIdx };
    }

    case 'EXIT_REORDER': {
      if (!action.save && state.reorderSnapshot) {
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

    case 'DETAIL_SCROLL':
      return {
        ...state,
        detailScrollOffset:
          action.direction === 'up'
            ? Math.max(0, state.detailScrollOffset - 1)
            : state.detailScrollOffset + 1,
      };

    case 'DETAIL_RESET_SCROLL':
      return { ...state, detailScrollOffset: 0 };

    case 'SET_RELEASES':
      return {
        ...state,
        releases: action.releases,
        releaseSelectedIndex: Math.min(
          state.releaseSelectedIndex,
          Math.max(0, action.releases.length - 1),
        ),
      };

    case 'RELEASE_MOVE_CURSOR': {
      if (state.releases.length === 0) return state;
      const maxIdx = Math.max(0, state.releases.length - 1);
      const newIdx =
        action.direction === 'up'
          ? Math.max(0, state.releaseSelectedIndex - 1)
          : Math.min(maxIdx, state.releaseSelectedIndex + 1);
      return { ...state, releaseSelectedIndex: newIdx };
    }

    case 'TOGGLE_RELEASE': {
      const next = new Set(state.selectedReleaseIds);
      if (next.has(action.releaseId)) {
        next.delete(action.releaseId);
      } else {
        next.add(action.releaseId);
      }
      return { ...state, selectedReleaseIds: next, selectedIndex: 0 };
    }

    case 'CLEAR_RELEASE_SELECTION':
      return { ...state, selectedReleaseIds: new Set(), selectedIndex: 0 };

    case 'ENTER_RELEASE_REORDER':
      return {
        ...state,
        isReleaseReordering: true,
        releaseReorderSnapshot: [...state.releases],
      };

    case 'RELEASE_REORDER_MOVE': {
      if (!state.isReleaseReordering) return state;
      const idx = state.releaseSelectedIndex;
      const swapIdx = action.direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= state.releases.length) return state;
      return {
        ...state,
        releases: swapAt(state.releases, idx, swapIdx),
        releaseSelectedIndex: swapIdx,
      };
    }

    case 'EXIT_RELEASE_REORDER': {
      if (!action.save && state.releaseReorderSnapshot) {
        return {
          ...state,
          isReleaseReordering: false,
          releases: state.releaseReorderSnapshot,
          releaseReorderSnapshot: null,
        };
      }
      return {
        ...state,
        isReleaseReordering: false,
        releaseReorderSnapshot: null,
      };
    }

    case 'SET_LINKING_PROJECT':
      return { ...state, linkingProject: action.project };

    case 'SET_EDITING_PROJECT':
      return { ...state, editingProject: action.project };

    case 'SET_DETECTED_GIT_REMOTE':
      return { ...state, detectedGitRemote: action.remote };

    case 'SET_CHANGELOG':
      return { ...state, changelogEntries: action.entries, changelogIndex: 0 };

    case 'CHANGELOG_NAVIGATE': {
      if (!state.changelogEntries) return state;
      const max = Math.max(0, state.changelogEntries.length - 1);
      const newIdx =
        action.direction === 'up'
          ? Math.max(0, state.changelogIndex - 1)
          : Math.min(max, state.changelogIndex + 1);
      return { ...state, changelogIndex: newIdx };
    }

    case 'DISMISS_CHANGELOG':
      return { ...state, changelogEntries: null, changelogIndex: 0, changelogDialogOpen: false };

    case 'OPEN_CHANGELOG_DIALOG':
      return { ...state, changelogDialogOpen: true, changelogIndex: 0 };

    case 'CLOSE_CHANGELOG_DIALOG':
      return { ...state, changelogDialogOpen: false };

    case 'SWITCH_TAB': {
      const isSettings = action.tab === TopTab.Settings;
      return {
        ...state,
        activeTab: action.tab,
        activeView: isSettings ? ViewType.Settings : ViewType.TaskList,
        breadcrumbs: isSettings ? [ViewType.Settings] : [ViewType.TaskList],
        focusedPanel: 'list',
      };
    }
  }
}
