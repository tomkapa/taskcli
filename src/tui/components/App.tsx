import { useReducer, useEffect, useCallback } from 'react';
import { Box, useInput, useApp } from 'ink';
import type { Container } from '../../cli/container.js';
import { TaskStatus, TaskType } from '../../types/enums.js';
import type { Task } from '../../types/task.js';
import { ViewType, SortColumn } from '../types.js';
import { appReducer, initialState } from '../state.js';
import { Header } from './Header.js';
import { Crumbs } from './Crumbs.js';
import { FlashMessage } from './FlashMessage.js';
import { TaskList } from './TaskList.js';
import { TaskDetail } from './TaskDetail.js';
import { TaskForm } from './TaskForm.js';
import { ProjectSelector } from './ProjectSelector.js';
import { HelpOverlay } from './HelpOverlay.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import { openAllMermaidDiagrams } from './Markdown.js';
import { logger } from '../../logging/logger.js';

interface Props {
  container: Container;
  initialProject?: string;
}

const STATUS_CYCLE = [
  TaskStatus.Backlog,
  TaskStatus.Todo,
  TaskStatus.InProgress,
  TaskStatus.Review,
  TaskStatus.Done,
];

const STATUS_VALUES = Object.values(TaskStatus);
const TYPE_VALUES = Object.values(TaskType);

export function App({ container, initialProject }: Props) {
  const { exit } = useApp();
  const [state, dispatch] = useReducer(appReducer, initialState);

  const loadProjects = useCallback(() => {
    const result = container.projectService.listProjects();
    if (result.ok) {
      dispatch({ type: 'SET_PROJECTS', projects: result.value });
    } else {
      dispatch({ type: 'FLASH', message: result.error.message, level: 'error' });
    }
  }, [container]);

  const loadTasks = useCallback(() => {
    logger.startSpan('TUI.loadTasks', () => {
      const filter = { ...state.filter };
      if (state.activeProject) {
        filter.projectId = state.activeProject.id;
      }
      const result = container.taskService.listTasks(filter);
      if (result.ok) {
        dispatch({ type: 'SET_TASKS', tasks: result.value });
      } else {
        dispatch({ type: 'FLASH', message: result.error.message, level: 'error' });
      }
    });
  }, [container, state.filter, state.activeProject]);

  const cycleStatus = useCallback(
    (task: Task) => {
      const currentIndex = STATUS_CYCLE.indexOf(task.status);
      const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length];
      if (!nextStatus) return;
      const result = container.taskService.updateTask(task.id, { status: nextStatus });
      if (result.ok) {
        dispatch({ type: 'FLASH', message: `Status -> ${nextStatus}`, level: 'info' });
        if (state.selectedTask?.id === task.id) {
          dispatch({ type: 'SELECT_TASK', task: result.value });
        }
        loadTasks();
      } else {
        dispatch({ type: 'FLASH', message: result.error.message, level: 'error' });
      }
    },
    [container, state.selectedTask, loadTasks],
  );

  // Initial load
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Resolve initial project
  useEffect(() => {
    if (state.projects.length > 0 && !state.activeProject) {
      const result = container.projectService.resolveProject(initialProject);
      if (result.ok) {
        dispatch({ type: 'SET_ACTIVE_PROJECT', project: result.value });
      } else if (state.projects.length > 0) {
        dispatch({ type: 'SET_ACTIVE_PROJECT', project: state.projects[0] ?? null });
      }
    }
  }, [state.projects, state.activeProject, initialProject, container]);

  // Reload tasks when project or filter changes
  useEffect(() => {
    if (state.activeProject) {
      loadTasks();
    }
  }, [state.activeProject, state.filter, loadTasks]);

  // Auto-clear flash
  useEffect(() => {
    if (state.flash) {
      const timer = setTimeout(() => {
        dispatch({ type: 'CLEAR_FLASH' });
      }, 3000);
      return () => {
        clearTimeout(timer);
      };
    }
    return undefined;
  }, [state.flash]);

  // Keyboard handler
  useInput((input, key) => {
    // Handle confirm delete dialog
    if (state.confirmDelete) {
      if (input === 'y') {
        const result = container.taskService.deleteTask(state.confirmDelete.id);
        if (result.ok) {
          dispatch({ type: 'FLASH', message: 'Task deleted', level: 'info' });
          dispatch({ type: 'CANCEL_DELETE' });
          if (state.activeView === ViewType.TaskDetail) {
            dispatch({ type: 'GO_BACK' });
          }
          loadTasks();
        } else {
          dispatch({ type: 'FLASH', message: result.error.message, level: 'error' });
          dispatch({ type: 'CANCEL_DELETE' });
        }
      } else if (input === 'n' || key.escape) {
        dispatch({ type: 'CANCEL_DELETE' });
      }
      return;
    }

    // Help view - any key closes
    if (state.activeView === ViewType.Help) {
      dispatch({ type: 'GO_BACK' });
      return;
    }

    // Form/selector views handle their own input
    if (
      state.activeView === ViewType.TaskCreate ||
      state.activeView === ViewType.TaskEdit ||
      state.activeView === ViewType.ProjectSelector
    ) {
      return;
    }

    // Search mode
    if (state.isSearchActive) {
      if (key.escape) {
        dispatch({ type: 'SET_SEARCH_ACTIVE', active: false });
        dispatch({ type: 'SET_SEARCH_QUERY', query: '' });
        dispatch({ type: 'SET_FILTER', filter: { search: undefined } });
        return;
      }
      if (key.return) {
        dispatch({ type: 'SET_SEARCH_ACTIVE', active: false });
        dispatch({ type: 'SET_FILTER', filter: { search: state.searchQuery || undefined } });
        return;
      }
      if (key.backspace || key.delete) {
        dispatch({ type: 'SET_SEARCH_QUERY', query: state.searchQuery.slice(0, -1) });
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        dispatch({ type: 'SET_SEARCH_QUERY', query: state.searchQuery + input });
        return;
      }
      return;
    }

    // Global
    if (input === 'q' && state.activeView === ViewType.TaskList) {
      exit();
      return;
    }
    if (input === 'q' || key.escape) {
      dispatch({ type: 'GO_BACK' });
      return;
    }
    if (input === '?') {
      dispatch({ type: 'NAVIGATE_TO', view: ViewType.Help });
      return;
    }

    // Task List
    if (state.activeView === ViewType.TaskList) {
      if (key.upArrow || input === 'k') {
        dispatch({ type: 'MOVE_CURSOR', direction: 'up' });
        return;
      }
      if (key.downArrow || input === 'j') {
        dispatch({ type: 'MOVE_CURSOR', direction: 'down' });
        return;
      }
      // g = go to top, G = go to bottom
      if (input === 'g') {
        for (let i = 0; i < state.tasks.length; i++) {
          dispatch({ type: 'MOVE_CURSOR', direction: 'up' });
        }
        return;
      }
      if (input === 'G') {
        for (let i = 0; i < state.tasks.length; i++) {
          dispatch({ type: 'MOVE_CURSOR', direction: 'down' });
        }
        return;
      }
      if (key.return) {
        const task = state.tasks[state.selectedIndex];
        if (task) {
          dispatch({ type: 'SELECT_TASK', task });
          dispatch({ type: 'NAVIGATE_TO', view: ViewType.TaskDetail });
        }
        return;
      }
      if (input === 'c') {
        dispatch({ type: 'NAVIGATE_TO', view: ViewType.TaskCreate });
        return;
      }
      if (input === 'e') {
        const task = state.tasks[state.selectedIndex];
        if (task) {
          dispatch({ type: 'SELECT_TASK', task });
          dispatch({ type: 'NAVIGATE_TO', view: ViewType.TaskEdit });
        }
        return;
      }
      if (input === 'd') {
        const task = state.tasks[state.selectedIndex];
        if (task) {
          dispatch({ type: 'CONFIRM_DELETE', task });
        }
        return;
      }
      if (input === 's') {
        const task = state.tasks[state.selectedIndex];
        if (task) {
          cycleStatus(task);
        }
        return;
      }
      if (input === '/') {
        dispatch({ type: 'SET_SEARCH_ACTIVE', active: true });
        dispatch({ type: 'SET_SEARCH_QUERY', query: '' });
        return;
      }
      if (input === 'p') {
        dispatch({ type: 'NAVIGATE_TO', view: ViewType.ProjectSelector });
        return;
      }
      if (input === 'S') {
        // Cycle sort column: priority -> status -> type -> name -> priority
        const order: SortColumn[] = [
          SortColumn.Priority,
          SortColumn.Status,
          SortColumn.Type,
          SortColumn.Name,
        ];
        const currentIdx = order.indexOf(state.sort.column);
        const nextCol = order[(currentIdx + 1) % order.length] ?? SortColumn.Priority;
        dispatch({ type: 'CYCLE_SORT', column: nextCol });
        return;
      }
      if (input === 'f') {
        const currentStatus = state.filter.status;
        const currentIndex = currentStatus ? STATUS_VALUES.indexOf(currentStatus) : -1;
        const nextIndex = currentIndex + 1;
        const nextStatus = nextIndex < STATUS_VALUES.length ? STATUS_VALUES[nextIndex] : undefined;
        dispatch({ type: 'SET_FILTER', filter: { status: nextStatus } });
        return;
      }
      if (input === 't') {
        const currentType = state.filter.type;
        const currentIndex = currentType ? TYPE_VALUES.indexOf(currentType) : -1;
        const nextIndex = currentIndex + 1;
        const nextType = nextIndex < TYPE_VALUES.length ? TYPE_VALUES[nextIndex] : undefined;
        dispatch({ type: 'SET_FILTER', filter: { type: nextType } });
        return;
      }
      if (input === '0') {
        dispatch({ type: 'CLEAR_FILTER' });
        return;
      }
      if (input && /^[1-5]$/.test(input)) {
        const priority = parseInt(input, 10);
        const current = state.filter.priority;
        dispatch({
          type: 'SET_FILTER',
          filter: { priority: current === priority ? undefined : priority },
        });
        return;
      }
    }

    // Task Detail
    if (state.activeView === ViewType.TaskDetail) {
      if (input === 'e' && state.selectedTask) {
        dispatch({ type: 'NAVIGATE_TO', view: ViewType.TaskEdit });
        return;
      }
      if (input === 'd' && state.selectedTask) {
        dispatch({ type: 'CONFIRM_DELETE', task: state.selectedTask });
        return;
      }
      if (input === 's' && state.selectedTask) {
        cycleStatus(state.selectedTask);
        return;
      }
      if (input === 'm' && state.selectedTask) {
        const allText = `${state.selectedTask.description}\n${state.selectedTask.technicalNotes}\n${state.selectedTask.additionalRequirements}`;
        const count = openAllMermaidDiagrams(allText);
        if (count > 0) {
          dispatch({
            type: 'FLASH',
            message: `Opened ${count} diagram${count > 1 ? 's' : ''} in browser`,
            level: 'info',
          });
        }
        return;
      }
    }
  });

  const handleFormSave = useCallback(
    (data: {
      name: string;
      description: string;
      type: string;
      status: string;
      priority: number;
      technicalNotes: string;
      additionalRequirements: string;
    }) => {
      if (state.activeView === ViewType.TaskEdit && state.selectedTask) {
        const result = container.taskService.updateTask(state.selectedTask.id, data);
        if (result.ok) {
          dispatch({ type: 'FLASH', message: 'Task updated', level: 'info' });
          dispatch({ type: 'SELECT_TASK', task: result.value });
          dispatch({ type: 'GO_BACK' });
          loadTasks();
        } else {
          dispatch({ type: 'FLASH', message: result.error.message, level: 'error' });
        }
      } else {
        const result = container.taskService.createTask(data, state.activeProject?.id);
        if (result.ok) {
          dispatch({ type: 'FLASH', message: 'Task created', level: 'info' });
          dispatch({ type: 'GO_BACK' });
          loadTasks();
        } else {
          dispatch({ type: 'FLASH', message: result.error.message, level: 'error' });
        }
      }
    },
    [container, state.activeView, state.selectedTask, state.activeProject, loadTasks],
  );

  const handleFormCancel = useCallback(() => {
    dispatch({ type: 'GO_BACK' });
  }, []);

  const handleProjectSelect = useCallback(
    (project: {
      id: string;
      name: string;
      description: string;
      isDefault: boolean;
      createdAt: string;
      updatedAt: string;
    }) => {
      dispatch({ type: 'SET_ACTIVE_PROJECT', project });
      dispatch({ type: 'GO_BACK' });
      dispatch({ type: 'FLASH', message: `Switched to: ${project.name}`, level: 'info' });
    },
    [],
  );

  const handleProjectCancel = useCallback(() => {
    dispatch({ type: 'GO_BACK' });
  }, []);

  return (
    <Box flexDirection="column" height="100%">
      {/* Header: app info + key hints + logo */}
      <Header state={state} />

      {/* Content area */}
      <Box flexDirection="column" flexGrow={1}>
        {state.confirmDelete && <ConfirmDialog task={state.confirmDelete} />}

        {!state.confirmDelete && state.activeView === ViewType.TaskList && (
          <TaskList
            tasks={state.tasks}
            selectedIndex={state.selectedIndex}
            searchQuery={state.searchQuery}
            isSearchActive={state.isSearchActive}
            filter={state.filter}
            sort={state.sort}
            activeProjectName={state.activeProject?.name ?? 'none'}
          />
        )}

        {!state.confirmDelete && state.activeView === ViewType.TaskDetail && state.selectedTask && (
          <TaskDetail task={state.selectedTask} />
        )}

        {!state.confirmDelete &&
          (state.activeView === ViewType.TaskCreate || state.activeView === ViewType.TaskEdit) && (
            <TaskForm
              editingTask={state.activeView === ViewType.TaskEdit ? state.selectedTask : null}
              onSave={handleFormSave}
              onCancel={handleFormCancel}
            />
          )}

        {!state.confirmDelete && state.activeView === ViewType.ProjectSelector && (
          <ProjectSelector
            projects={state.projects}
            activeProject={state.activeProject}
            onSelect={handleProjectSelect}
            onCancel={handleProjectCancel}
          />
        )}

        {!state.confirmDelete && state.activeView === ViewType.Help && <HelpOverlay />}
      </Box>

      {/* Breadcrumbs */}
      <Crumbs breadcrumbs={state.breadcrumbs} />

      {/* Flash message */}
      {state.flash && <FlashMessage message={state.flash.message} level={state.flash.level} />}
    </Box>
  );
}
