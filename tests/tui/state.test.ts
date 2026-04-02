import { describe, it, expect } from 'vitest';
import { appReducer, initialState } from '../../src/tui/state.js';
import { ViewType, SortColumn } from '../../src/tui/types.js';
import type { Task } from '../../src/types/task.js';

const mockTask: Task = {
  id: 'task-1',
  projectId: 'proj-1',
  parentId: null,
  name: 'Test task',
  description: 'A test task',
  type: 'story',
  status: 'backlog',
  priority: 3,
  technicalNotes: '',
  additionalRequirements: '',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('appReducer', () => {
  it('starts with TaskList view and single breadcrumb', () => {
    expect(initialState.activeView).toBe(ViewType.TaskList);
    expect(initialState.breadcrumbs).toEqual([ViewType.TaskList]);
  });

  it('NAVIGATE_TO changes view and pushes breadcrumb', () => {
    const state = appReducer(initialState, {
      type: 'NAVIGATE_TO',
      view: ViewType.TaskDetail,
    });
    expect(state.activeView).toBe(ViewType.TaskDetail);
    expect(state.breadcrumbs).toEqual([ViewType.TaskList, ViewType.TaskDetail]);
  });

  it('GO_BACK pops breadcrumb and returns to previous view', () => {
    const navigated = appReducer(initialState, {
      type: 'NAVIGATE_TO',
      view: ViewType.TaskDetail,
    });
    const back = appReducer(navigated, { type: 'GO_BACK' });
    expect(back.activeView).toBe(ViewType.TaskList);
    expect(back.breadcrumbs).toEqual([ViewType.TaskList]);
  });

  it('GO_BACK defaults to TaskList when at root', () => {
    const back = appReducer(initialState, { type: 'GO_BACK' });
    expect(back.activeView).toBe(ViewType.TaskList);
    expect(back.breadcrumbs).toEqual([ViewType.TaskList]);
  });

  it('supports deep breadcrumb navigation', () => {
    let state = appReducer(initialState, {
      type: 'NAVIGATE_TO',
      view: ViewType.TaskDetail,
    });
    state = appReducer(state, {
      type: 'NAVIGATE_TO',
      view: ViewType.TaskEdit,
    });
    expect(state.breadcrumbs).toEqual([
      ViewType.TaskList,
      ViewType.TaskDetail,
      ViewType.TaskEdit,
    ]);

    const back1 = appReducer(state, { type: 'GO_BACK' });
    expect(back1.activeView).toBe(ViewType.TaskDetail);
    expect(back1.breadcrumbs).toEqual([ViewType.TaskList, ViewType.TaskDetail]);

    const back2 = appReducer(back1, { type: 'GO_BACK' });
    expect(back2.activeView).toBe(ViewType.TaskList);
  });

  it('SET_TASKS updates tasks and clamps selectedIndex', () => {
    const withIndex = { ...initialState, selectedIndex: 5 };
    const state = appReducer(withIndex, {
      type: 'SET_TASKS',
      tasks: [mockTask, { ...mockTask, id: 'task-2' }],
    });
    expect(state.tasks).toHaveLength(2);
    expect(state.selectedIndex).toBe(1);
  });

  it('SET_TASKS handles empty array', () => {
    const state = appReducer(initialState, { type: 'SET_TASKS', tasks: [] });
    expect(state.tasks).toHaveLength(0);
    expect(state.selectedIndex).toBe(0);
  });

  it('MOVE_CURSOR up/down respects bounds', () => {
    const withTasks = appReducer(initialState, {
      type: 'SET_TASKS',
      tasks: [mockTask, { ...mockTask, id: 'task-2' }, { ...mockTask, id: 'task-3' }],
    });

    const down1 = appReducer(withTasks, { type: 'MOVE_CURSOR', direction: 'down' });
    expect(down1.selectedIndex).toBe(1);

    const down2 = appReducer(down1, { type: 'MOVE_CURSOR', direction: 'down' });
    expect(down2.selectedIndex).toBe(2);

    const down3 = appReducer(down2, { type: 'MOVE_CURSOR', direction: 'down' });
    expect(down3.selectedIndex).toBe(2);

    const up = appReducer(down2, { type: 'MOVE_CURSOR', direction: 'up' });
    expect(up.selectedIndex).toBe(1);

    const upFromZero = appReducer(withTasks, { type: 'MOVE_CURSOR', direction: 'up' });
    expect(upFromZero.selectedIndex).toBe(0);
  });

  it('SET_FILTER merges filter and resets cursor', () => {
    const withIndex = { ...initialState, selectedIndex: 3 };
    const state = appReducer(withIndex, {
      type: 'SET_FILTER',
      filter: { status: 'todo' },
    });
    expect(state.filter.status).toBe('todo');
    expect(state.selectedIndex).toBe(0);
  });

  it('SET_FILTER preserves other filter fields', () => {
    const withFilter = appReducer(initialState, {
      type: 'SET_FILTER',
      filter: { status: 'todo', type: 'bug' },
    });
    const updated = appReducer(withFilter, {
      type: 'SET_FILTER',
      filter: { priority: 1 },
    });
    expect(updated.filter.status).toBe('todo');
    expect(updated.filter.type).toBe('bug');
    expect(updated.filter.priority).toBe(1);
  });

  it('CLEAR_FILTER resets all filters', () => {
    const withFilter = appReducer(initialState, {
      type: 'SET_FILTER',
      filter: { status: 'todo', type: 'bug', search: 'hello' },
    });
    const cleared = appReducer(withFilter, { type: 'CLEAR_FILTER' });
    expect(cleared.filter).toEqual({});
    expect(cleared.searchQuery).toBe('');
  });

  it('FLASH and CLEAR_FLASH', () => {
    const state = appReducer(initialState, {
      type: 'FLASH',
      message: 'Task created',
      level: 'info',
    });
    expect(state.flash).toEqual({ message: 'Task created', level: 'info' });

    const cleared = appReducer(state, { type: 'CLEAR_FLASH' });
    expect(cleared.flash).toBeNull();
  });

  it('FLASH supports error level', () => {
    const state = appReducer(initialState, {
      type: 'FLASH',
      message: 'Not found',
      level: 'error',
    });
    expect(state.flash?.level).toBe('error');
  });

  it('CONFIRM_DELETE and CANCEL_DELETE', () => {
    const state = appReducer(initialState, {
      type: 'CONFIRM_DELETE',
      task: mockTask,
    });
    expect(state.confirmDelete).toBe(mockTask);

    const cancelled = appReducer(state, { type: 'CANCEL_DELETE' });
    expect(cancelled.confirmDelete).toBeNull();
  });

  it('SET_SEARCH_ACTIVE and SET_SEARCH_QUERY', () => {
    const active = appReducer(initialState, {
      type: 'SET_SEARCH_ACTIVE',
      active: true,
    });
    expect(active.isSearchActive).toBe(true);

    const withQuery = appReducer(active, {
      type: 'SET_SEARCH_QUERY',
      query: 'login',
    });
    expect(withQuery.searchQuery).toBe('login');
  });

  it('SELECT_TASK stores the selected task', () => {
    const state = appReducer(initialState, {
      type: 'SELECT_TASK',
      task: mockTask,
    });
    expect(state.selectedTask).toBe(mockTask);
  });

  it('NAVIGATE_TO clears confirmDelete', () => {
    const withConfirm = appReducer(initialState, {
      type: 'CONFIRM_DELETE',
      task: mockTask,
    });
    const navigated = appReducer(withConfirm, {
      type: 'NAVIGATE_TO',
      view: ViewType.TaskCreate,
    });
    expect(navigated.confirmDelete).toBeNull();
  });

  it('GO_BACK clears form data and search', () => {
    let state = appReducer(initialState, {
      type: 'SET_SEARCH_ACTIVE',
      active: true,
    });
    state = appReducer(state, {
      type: 'SET_FORM_DATA',
      data: { name: 'test' },
    });
    const back = appReducer(state, { type: 'GO_BACK' });
    expect(back.isSearchActive).toBe(false);
    expect(back.formData).toBeNull();
  });

  it('CYCLE_SORT sets new column with asc direction', () => {
    const state = appReducer(initialState, {
      type: 'CYCLE_SORT',
      column: SortColumn.Status,
    });
    expect(state.sort.column).toBe(SortColumn.Status);
    expect(state.sort.direction).toBe('asc');
    expect(state.selectedIndex).toBe(0);
  });

  it('CYCLE_SORT toggles direction on same column', () => {
    const first = appReducer(initialState, {
      type: 'CYCLE_SORT',
      column: SortColumn.Priority,
    });
    // initialState already has priority asc, so first cycle toggles to desc
    expect(first.sort.direction).toBe('desc');

    const second = appReducer(first, {
      type: 'CYCLE_SORT',
      column: SortColumn.Priority,
    });
    expect(second.sort.direction).toBe('asc');
  });

  it('CYCLE_SORT resets cursor on column change', () => {
    const withIndex = { ...initialState, selectedIndex: 5 };
    const state = appReducer(withIndex, {
      type: 'CYCLE_SORT',
      column: SortColumn.Type,
    });
    expect(state.selectedIndex).toBe(0);
  });

  it('initial sort is priority asc', () => {
    expect(initialState.sort.column).toBe(SortColumn.Priority);
    expect(initialState.sort.direction).toBe('asc');
  });
});
