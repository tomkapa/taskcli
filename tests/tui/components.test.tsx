import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import type { Task } from '../../src/types/task.js';
import type { Project } from '../../src/types/project.js';
import { TaskList } from '../../src/tui/components/TaskList.js';
import { TaskDetail } from '../../src/tui/components/TaskDetail.js';
import { TaskForm } from '../../src/tui/components/TaskForm.js';
import { ProjectSelector } from '../../src/tui/components/ProjectSelector.js';
import { Header } from '../../src/tui/components/Header.js';
import { Crumbs } from '../../src/tui/components/Crumbs.js';
import { FlashMessage } from '../../src/tui/components/FlashMessage.js';
import { HelpOverlay } from '../../src/tui/components/HelpOverlay.js';
import { ConfirmDialog } from '../../src/tui/components/ConfirmDialog.js';
import { Markdown } from '../../src/tui/components/Markdown.js';
import { StatusBadge, TypeBadge } from '../../src/tui/components/Badges.js';
import { initialState } from '../../src/tui/state.js';
import { ViewType } from '../../src/tui/types.js';

const mockTask: Task = {
  id: '01ABC123',
  projectId: 'proj-1',
  parentId: null,
  name: 'Fix login bug',
  description: 'Login fails on **mobile** devices',
  type: 'bug',
  status: 'in-progress',
  rank: 1000,
  technicalNotes: '## Root cause\nJWT token expiry not checked',
  additionalRequirements: 'Must work on iOS Safari',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-16T14:30:00Z',
};

const mockProject: Project = {
  id: 'proj-1',
  key: 'MYA',
  name: 'My App',
  description: 'Main application',
  isDefault: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('TUI Component Rendering', () => {
  describe('Badges', () => {
    it('renders StatusBadge without crashing', () => {
      const { lastFrame } = render(<StatusBadge status="in-progress" />);
      expect(lastFrame()).toContain('IN-PROG');
    });

    it('renders TypeBadge without crashing', () => {
      const { lastFrame } = render(<TypeBadge type="bug" />);
      expect(lastFrame()).toContain('bug');
    });
  });

  describe('Markdown', () => {
    it('renders markdown content', () => {
      const { lastFrame } = render(<Markdown content="Hello **world**" />);
      expect(lastFrame()).toBeTruthy();
    });

    it('renders empty content gracefully', () => {
      const { lastFrame } = render(<Markdown content="" />);
      expect(lastFrame()).toContain('No content');
    });

    it('renders whitespace-only content as empty', () => {
      const { lastFrame } = render(<Markdown content="   " />);
      expect(lastFrame()).toContain('No content');
    });

    it('renders code blocks', () => {
      const md = '```typescript\nconst x = 1;\n```';
      const { lastFrame } = render(<Markdown content={md} />);
      expect(lastFrame()).toContain('const x = 1');
    });

    it('renders mermaid blocks with diagram label', () => {
      const md = '```mermaid\ngraph TD\n    A --> B\n```';
      const { lastFrame } = render(<Markdown content={md} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('Mermaid Diagram');
      expect(frame).toContain('A --> B');
    });

    it('renders headings and lists', () => {
      const md = '# Title\n\n- item one\n- item two';
      const { lastFrame } = render(<Markdown content={md} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('Title');
      expect(frame).toContain('item one');
    });
  });

  describe('TaskList', () => {
    it('renders with tasks', () => {
      const { lastFrame } = render(
        <TaskList
          tasks={[mockTask]}
          selectedIndex={0}
          searchQuery=""
          isSearchActive={false}
          isReordering={false}
          filter={{}}
          activeProjectName="My App"
        />,
      );
      const frame = lastFrame();
      expect(frame).toContain('Fix login bug');
      expect(frame).toContain('tasks');
      expect(frame).toContain('My App');
    });

    it('renders empty state', () => {
      const { lastFrame } = render(
        <TaskList
          tasks={[]}
          selectedIndex={0}
          searchQuery=""
          isSearchActive={false}
          isReordering={false}
          filter={{}}
          activeProjectName="My App"
        />,
      );
      expect(lastFrame()).toContain('No tasks found');
    });

    it('renders search bar when active', () => {
      const { lastFrame } = render(
        <TaskList
          tasks={[mockTask]}
          selectedIndex={0}
          searchQuery="login"
          isSearchActive={true}
          isReordering={false}
          filter={{}}
          activeProjectName="My App"
        />,
      );
      expect(lastFrame()).toContain('login');
    });

    it('renders filter in title bar', () => {
      const { lastFrame } = render(
        <TaskList
          tasks={[mockTask]}
          selectedIndex={0}
          searchQuery=""
          isSearchActive={false}
          isReordering={false}
          filter={{ status: 'todo', type: 'bug' }}
          activeProjectName="My App"
        />,
      );
      const frame = lastFrame() ?? '';
      expect(frame).toContain('status:todo');
      expect(frame).toContain('type:bug');
    });

    it('renders multiple tasks with selection indicator', () => {
      const tasks = [
        mockTask,
        { ...mockTask, id: 'task-2', name: 'Add dashboard', type: 'story' as const, status: 'todo' as const, rank: 2000 },
      ];
      const { lastFrame } = render(
        <TaskList
          tasks={tasks}
          selectedIndex={0}
          searchQuery=""
          isSearchActive={false}
          isReordering={false}
          filter={{}}
          activeProjectName="My App"
        />,
      );
      const frame = lastFrame() ?? '';
      expect(frame).toContain('Fix login bug');
      expect(frame).toContain('Add dashboard');
    });

    it('renders reorder indicator when reordering', () => {
      const { lastFrame } = render(
        <TaskList
          tasks={[mockTask]}
          selectedIndex={0}
          searchQuery=""
          isSearchActive={false}
          isReordering={true}
          filter={{}}
          activeProjectName="My App"
        />,
      );
      const frame = lastFrame() ?? '';
      expect(frame).toContain('REORDER');
    });
  });

  describe('TaskDetail', () => {
    it('renders task details with all fields', () => {
      const { lastFrame } = render(<TaskDetail task={mockTask} />);
      const frame = lastFrame();
      expect(frame).toContain('Fix login bug');
      expect(frame).toContain('detail');
    });

    it('renders task without optional fields', () => {
      const minimalTask: Task = {
        ...mockTask,
        technicalNotes: '',
        additionalRequirements: '',
        parentId: null,
      };
      const { lastFrame } = render(<TaskDetail task={minimalTask} />);
      expect(lastFrame()).toContain('Fix login bug');
    });

    it('renders task with parent id', () => {
      const childTask = { ...mockTask, parentId: 'parent-123' };
      const { lastFrame } = render(<TaskDetail task={childTask} />);
      expect(lastFrame()).toContain('parent');
    });

    it('renders YAML-style metadata', () => {
      const { lastFrame } = render(<TaskDetail task={mockTask} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('type');
      expect(frame).toContain('status');
    });
  });

  describe('TaskForm', () => {
    it('renders create form', () => {
      const { lastFrame } = render(
        <TaskForm editingTask={null} onSave={() => {}} onCancel={() => {}} />,
      );
      const frame = lastFrame();
      expect(frame).toContain('create');
      expect(frame).toContain('Name');
      expect(frame).toContain('Type');
      expect(frame).toContain('Status');
      expect(frame).toContain('ctrl+s: save');
    });

    it('renders edit form with existing data', () => {
      const { lastFrame } = render(
        <TaskForm editingTask={mockTask} onSave={() => {}} onCancel={() => {}} />,
      );
      const frame = lastFrame();
      expect(frame).toContain('edit');
      expect(frame).toContain('Fix login bug');
    });

    it('shows $EDITOR hint for long text fields', () => {
      const { lastFrame } = render(
        <TaskForm editingTask={null} onSave={() => {}} onCancel={() => {}} />,
      );
      const frame = lastFrame();
      expect(frame).toContain('Description');
      expect(frame).toContain('Tech Notes');
      expect(frame).toContain('Requirements');
    });

    it('shows preview of existing editor content', () => {
      const { lastFrame } = render(
        <TaskForm editingTask={mockTask} onSave={() => {}} onCancel={() => {}} />,
      );
      const frame = lastFrame();
      expect(frame).toContain('Login fails');
    });
  });

  describe('ProjectSelector', () => {
    it('renders project list', () => {
      const { lastFrame } = render(
        <ProjectSelector
          projects={[mockProject]}
          activeProject={mockProject}
          onSelect={() => {}}
          onCancel={() => {}}
        />,
      );
      const frame = lastFrame();
      expect(frame).toContain('My App');
      expect(frame).toContain('projects');
    });

    it('renders empty state', () => {
      const { lastFrame } = render(
        <ProjectSelector
          projects={[]}
          activeProject={null}
          onSelect={() => {}}
          onCancel={() => {}}
        />,
      );
      expect(lastFrame()).toContain('No projects');
    });
  });

  describe('Header', () => {
    it('renders app info', () => {
      const state = { ...initialState, activeProject: mockProject, tasks: [mockTask] };
      const { lastFrame } = render(<Header state={state} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('My App');
      expect(frame).toContain('Project:');
    });

    it('renders key hints', () => {
      const { lastFrame } = render(<Header state={initialState} />);
      const frame = lastFrame() ?? '';
      expect(frame).toContain('create');
      expect(frame).toContain('help');
    });
  });

  describe('Crumbs', () => {
    it('renders breadcrumb trail', () => {
      const { lastFrame } = render(
        <Crumbs breadcrumbs={[ViewType.TaskList, ViewType.TaskDetail]} />,
      );
      const frame = lastFrame() ?? '';
      expect(frame).toContain('tasks');
      expect(frame).toContain('detail');
    });

    it('renders single breadcrumb', () => {
      const { lastFrame } = render(<Crumbs breadcrumbs={[ViewType.TaskList]} />);
      expect(lastFrame()).toContain('tasks');
    });
  });

  describe('FlashMessage', () => {
    it('renders info flash', () => {
      const { lastFrame } = render(<FlashMessage message="Task created" level="info" />);
      expect(lastFrame()).toContain('Task created');
    });

    it('renders error flash', () => {
      const { lastFrame } = render(<FlashMessage message="Not found" level="error" />);
      expect(lastFrame()).toContain('Not found');
    });

    it('renders warning flash', () => {
      const { lastFrame } = render(<FlashMessage message="Careful" level="warn" />);
      expect(lastFrame()).toContain('Careful');
    });
  });

  describe('HelpOverlay', () => {
    it('renders all shortcut sections', () => {
      const { lastFrame } = render(<HelpOverlay />);
      const frame = lastFrame();
      expect(frame).toContain('Help');
      expect(frame).toContain('NAVIGATION');
      expect(frame).toContain('ACTIONS');
      expect(frame).toContain('REORDER');
      expect(frame).toContain('FILTER');
      expect(frame).toContain('GENERAL');
      expect(frame).toContain('Press any key to close');
    });
  });

  describe('ConfirmDialog', () => {
    it('renders delete confirmation with task name', () => {
      const { lastFrame } = render(<ConfirmDialog task={mockTask} />);
      const frame = lastFrame();
      expect(frame).toContain('Delete');
      expect(frame).toContain('Fix login bug');
      expect(frame).toContain('OK');
      expect(frame).toContain('Cancel');
    });
  });
});
