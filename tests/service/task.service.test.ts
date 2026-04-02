import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { createContainer } from '../../src/cli/container.js';
import { runMigrations } from '../../src/db/migrator.js';
import type { Container } from '../../src/cli/container.js';

let container: Container;

beforeEach(() => {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  runMigrations(db);
  container = createContainer(db);
});

describe('ProjectService', () => {
  it('creates and retrieves a project', () => {
    const result = container.projectService.createProject({
      name: 'Test Project',
      description: 'A test project',
      isDefault: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('Test Project');
    expect(result.value.isDefault).toBe(true);
  });

  it('lists projects', () => {
    container.projectService.createProject({ name: 'P1' });
    container.projectService.createProject({ name: 'P2' });
    const result = container.projectService.listProjects();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
  });

  it('rejects duplicate project names', () => {
    container.projectService.createProject({ name: 'P1' });
    const result = container.projectService.createProject({ name: 'P1' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('DUPLICATE');
  });

  it('resolves default project', () => {
    container.projectService.createProject({ name: 'Default', isDefault: true });
    const result = container.projectService.resolveProject();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('Default');
  });

  it('resolves project by name', () => {
    container.projectService.createProject({ name: 'Named' });
    const result = container.projectService.resolveProject('Named');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('Named');
  });
});

describe('TaskService', () => {
  beforeEach(() => {
    container.projectService.createProject({ name: 'Proj', isDefault: true });
  });

  it('creates a task in the default project', () => {
    const result = container.taskService.createTask({ name: 'My task' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('My task');
    expect(result.value.type).toBe('story');
    expect(result.value.status).toBe('backlog');
    expect(result.value.priority).toBe(3);
  });

  it('creates a task with all fields', () => {
    const result = container.taskService.createTask({
      name: 'Full task',
      description: 'Description here',
      type: 'bug',
      status: 'todo',
      priority: 1,
      technicalNotes: 'Some notes',
      additionalRequirements: 'Some reqs',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.type).toBe('bug');
    expect(result.value.priority).toBe(1);
    expect(result.value.technicalNotes).toBe('Some notes');
  });

  it('lists tasks with filters', () => {
    container.taskService.createTask({ name: 'Bug 1', type: 'bug' });
    container.taskService.createTask({ name: 'Story 1', type: 'story' });
    container.taskService.createTask({ name: 'Bug 2', type: 'bug' });

    const result = container.taskService.listTasks({ type: 'bug' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    expect(result.value.every((t) => t.type === 'bug')).toBe(true);
  });

  it('searches tasks by text', () => {
    container.taskService.createTask({ name: 'Fix login bug' });
    container.taskService.createTask({ name: 'Add dashboard' });

    const result = container.taskService.listTasks({ search: 'login' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.name).toBe('Fix login bug');
  });

  it('updates a task', () => {
    const created = container.taskService.createTask({ name: 'Original' });
    if (!created.ok) throw new Error('setup failed');

    const result = container.taskService.updateTask(created.value.id, {
      name: 'Updated',
      status: 'in-progress',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe('Updated');
    expect(result.value.status).toBe('in-progress');
  });

  it('appends to technical notes', () => {
    const created = container.taskService.createTask({
      name: 'Task',
      technicalNotes: 'Initial note',
    });
    if (!created.ok) throw new Error('setup failed');

    const result = container.taskService.updateTask(created.value.id, {
      appendNotes: 'Follow-up note',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.technicalNotes).toContain('Initial note');
    expect(result.value.technicalNotes).toContain('Follow-up note');
    expect(result.value.technicalNotes).toContain('---');
  });

  it('deletes a task', () => {
    const created = container.taskService.createTask({ name: 'To delete' });
    if (!created.ok) throw new Error('setup failed');

    const result = container.taskService.deleteTask(created.value.id);
    expect(result.ok).toBe(true);

    const get = container.taskService.getTask(created.value.id);
    expect(get.ok).toBe(false);
  });

  it('breaks down a task into subtasks', () => {
    const parent = container.taskService.createTask({ name: 'Parent' });
    if (!parent.ok) throw new Error('setup failed');

    const result = container.taskService.breakdownTask(parent.value.id, [
      { name: 'Subtask 1', type: 'story' },
      { name: 'Subtask 2', type: 'bug', priority: 1 },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    expect(result.value[0]?.parentId).toBe(parent.value.id);
    expect(result.value[1]?.type).toBe('bug');
  });

  it('rejects invalid task type', () => {
    const result = container.taskService.createTask({
      name: 'Bad task',
      type: 'invalid' as never,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
  });

  it('returns NOT_FOUND for missing task', () => {
    const result = container.taskService.getTask('nonexistent');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
  });
});
