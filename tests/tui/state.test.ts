import { describe, it, expect } from 'vitest';
import { appReducer, initialState } from '../../src/tui/state.js';
import { ViewType } from '../../src/tui/types.js';
import type { Task } from '../../src/types/task.js';

const mockTask: Task = {
  id: 'task-1',
  projectId: 'proj-1',
  parentId: null,
  name: 'Test task',
  description: 'A test task',
  type: 'story',
  status: 'backlog',
  rank: 1000,
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

  it('defaults filter to backlog status', () => {
    expect(initialState.filter.status).toBe('backlog');
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
      filter: { search: 'test' },
    });
    expect(updated.filter.status).toBe('todo');
    expect(updated.filter.type).toBe('bug');
    expect(updated.filter.search).toBe('test');
  });

  it('CLEAR_FILTER resets to backlog default', () => {
    const withFilter = appReducer(initialState, {
      type: 'SET_FILTER',
      filter: { status: 'todo', type: 'bug', search: 'hello' },
    });
    const cleared = appReducer(withFilter, { type: 'CLEAR_FILTER' });
    expect(cleared.filter).toEqual({ status: 'backlog' });
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

  describe('Reorder', () => {
    it('ENTER_REORDER enables reorder mode and takes snapshot', () => {
      const withTasks = appReducer(initialState, {
        type: 'SET_TASKS',
        tasks: [mockTask, { ...mockTask, id: 'task-2', rank: 2000 }],
      });
      const state = appReducer(withTasks, { type: 'ENTER_REORDER' });
      expect(state.isReordering).toBe(true);
      expect(state.reorderSnapshot).toHaveLength(2);
    });

    it('REORDER_MOVE swaps tasks and moves cursor', () => {
      const task2 = { ...mockTask, id: 'task-2', name: 'Task 2', rank: 2000 };
      let state = appReducer(initialState, {
        type: 'SET_TASKS',
        tasks: [mockTask, task2],
      });
      state = appReducer(state, { type: 'ENTER_REORDER' });

      // Move down: swap task-1 and task-2
      const moved = appReducer(state, { type: 'REORDER_MOVE', direction: 'down' });
      expect(moved.selectedIndex).toBe(1);
      expect(moved.tasks[0]?.id).toBe('task-2');
      expect(moved.tasks[1]?.id).toBe('task-1');
    });

    it('REORDER_MOVE does nothing at boundaries', () => {
      const state = appReducer(initialState, {
        type: 'SET_TASKS',
        tasks: [mockTask],
      });
      const reordering = appReducer(state, { type: 'ENTER_REORDER' });

      const movedUp = appReducer(reordering, { type: 'REORDER_MOVE', direction: 'up' });
      expect(movedUp.selectedIndex).toBe(0);

      const movedDown = appReducer(reordering, { type: 'REORDER_MOVE', direction: 'down' });
      expect(movedDown.selectedIndex).toBe(0);
    });

    it('EXIT_REORDER with save=false reverts to snapshot', () => {
      const task2 = { ...mockTask, id: 'task-2', name: 'Task 2', rank: 2000 };
      let state = appReducer(initialState, {
        type: 'SET_TASKS',
        tasks: [mockTask, task2],
      });
      state = appReducer(state, { type: 'ENTER_REORDER' });
      state = appReducer(state, { type: 'REORDER_MOVE', direction: 'down' });

      const reverted = appReducer(state, { type: 'EXIT_REORDER', save: false });
      expect(reverted.isReordering).toBe(false);
      expect(reverted.tasks[0]?.id).toBe('task-1');
    });

    it('EXIT_REORDER with save=true keeps new order', () => {
      const task2 = { ...mockTask, id: 'task-2', name: 'Task 2', rank: 2000 };
      let state = appReducer(initialState, {
        type: 'SET_TASKS',
        tasks: [mockTask, task2],
      });
      state = appReducer(state, { type: 'ENTER_REORDER' });
      state = appReducer(state, { type: 'REORDER_MOVE', direction: 'down' });

      const saved = appReducer(state, { type: 'EXIT_REORDER', save: true });
      expect(saved.isReordering).toBe(false);
      expect(saved.tasks[0]?.id).toBe('task-2');
      expect(saved.reorderSnapshot).toBeNull();
    });

    it('REORDER_MOVE is no-op when not reordering', () => {
      const state = appReducer(initialState, {
        type: 'SET_TASKS',
        tasks: [mockTask, { ...mockTask, id: 'task-2', rank: 2000 }],
      });
      const moved = appReducer(state, { type: 'REORDER_MOVE', direction: 'down' });
      expect(moved.tasks[0]?.id).toBe('task-1');
    });
  });
});
