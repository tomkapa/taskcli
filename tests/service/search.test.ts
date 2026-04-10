import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createContainer } from '../../src/cli/container.js';
import { runMigrations } from '../../src/db/migrator.js';
import type { Container } from '../../src/cli/container.js';
import type { Project } from '../../src/types/project.js';

let container: Container;
let project: Project;

beforeEach(() => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  runMigrations(db);
  container = createContainer(db);
  container.projectService.createProject({ name: 'Proj', isDefault: true });
  const p = container.projectService.resolveProject();
  if (!p.ok) throw new Error('setup failed');
  project = p.value;
});

describe('FTS5 Search', () => {
  it('finds tasks by name tokens', () => {
    container.taskService.createTask({ name: 'Fix login authentication bug' }, project);
    container.taskService.createTask({ name: 'Add dashboard widget' }, project);
    container.taskService.createTask({ name: 'Update login page styles' }, project);

    const result = container.taskService.searchTasks('login', project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    expect(result.value.map((r) => r.task.name)).toContain('Fix login authentication bug');
    expect(result.value.map((r) => r.task.name)).toContain('Update login page styles');
  });

  it('supports prefix search', () => {
    container.taskService.createTask({ name: 'Authentication module' }, project);
    container.taskService.createTask({ name: 'Authorization rules' }, project);
    container.taskService.createTask({ name: 'Billing system' }, project);

    const result = container.taskService.searchTasks('auth', project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
  });

  it('searches across description and technical notes', () => {
    container.taskService.createTask(
      { name: 'Task A', description: 'JWT token refresh is broken' },
      project,
    );
    container.taskService.createTask(
      { name: 'Task B', technicalNotes: 'Check JWT expiry logic' },
      project,
    );
    container.taskService.createTask({ name: 'Task C', description: 'Unrelated work' }, project);

    const result = container.taskService.searchTasks('JWT', project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    expect(result.value.map((r) => r.task.name).sort()).toEqual(['Task A', 'Task B']);
  });

  it('returns results ranked by relevance', () => {
    // Task with "login" in name should rank higher than in description
    container.taskService.createTask({ name: 'Fix login bug' }, project);
    container.taskService.createTask(
      { name: 'Task B', description: 'Something about login in the description' },
      project,
    );

    const result = container.taskService.searchTasks('login', project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    // bm25 returns negative values; more negative = better match
    expect(result.value[0]!.rank).toBeLessThanOrEqual(result.value[1]!.rank);
  });

  it('supports multi-word search', () => {
    container.taskService.createTask({ name: 'Fix login authentication bug' }, project);
    container.taskService.createTask({ name: 'Login page redesign' }, project);
    container.taskService.createTask({ name: 'Fix payment bug' }, project);

    const result = container.taskService.searchTasks('fix bug', project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Both words must match (prefix) somewhere in the task
    expect(result.value.length).toBeGreaterThanOrEqual(1);
    expect(result.value.map((r) => r.task.name)).toContain('Fix login authentication bug');
  });

  it('scopes search to a project', () => {
    container.projectService.createProject({ name: 'Other' });
    const p2 = container.projectService.resolveProject('Other');
    if (!p2.ok) throw new Error('setup failed');

    container.taskService.createTask({ name: 'Login fix in default' }, project);
    container.taskService.createTask({ name: 'Login fix in other' }, p2.value);

    const result = container.taskService.searchTasks('login', p2.value);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]!.task.name).toBe('Login fix in other');
  });

  it('scopes search to default project when no project specified', () => {
    container.projectService.createProject({ name: 'Other' });
    const p2 = container.projectService.resolveProject('Other');
    if (!p2.ok) throw new Error('setup failed');

    container.taskService.createTask({ name: 'Login fix in default' }, project);
    container.taskService.createTask({ name: 'Login fix in other' }, p2.value);

    const result = container.taskService.searchTasks('login', project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]!.task.name).toBe('Login fix in default');
  });

  it('returns empty for no matches', () => {
    container.taskService.createTask({ name: 'Some task' }, project);

    const result = container.taskService.searchTasks('nonexistent', project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(0);
  });

  it('rejects empty query', () => {
    const result = container.taskService.searchTasks('  ', project);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
  });

  it('FTS index stays in sync after task update', () => {
    const t = container.taskService.createTask({ name: 'Original name' }, project);
    if (!t.ok) throw new Error('setup failed');

    container.taskService.updateTask(t.value.id, { name: 'Updated name with keyword' });

    const oldResult = container.taskService.searchTasks('Original', project);
    expect(oldResult.ok).toBe(true);
    if (!oldResult.ok) return;
    expect(oldResult.value).toHaveLength(0);

    const newResult = container.taskService.searchTasks('keyword', project);
    expect(newResult.ok).toBe(true);
    if (!newResult.ok) return;
    expect(newResult.value).toHaveLength(1);
  });

  it('FTS index stays in sync after task delete', () => {
    const t = container.taskService.createTask({ name: 'Deletable task' }, project);
    if (!t.ok) throw new Error('setup failed');

    container.taskService.deleteTask(t.value.id);

    const result = container.taskService.searchTasks('Deletable', project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(0);
  });

  it('existing task list --search still works with FTS', () => {
    container.taskService.createTask({ name: 'Fix login bug' }, project);
    container.taskService.createTask({ name: 'Add dashboard' }, project);

    const result = container.taskService.listTasks(project, { search: 'login' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]!.name).toBe('Fix login bug');
  });
});

describe('Field-specific search (id: prefix)', () => {
  it('id: prefix filters by task id only via listTasks', () => {
    const t1 = container.taskService.createTask({ name: 'Fix login bug' }, project);
    const t2 = container.taskService.createTask({ name: 'Add dashboard' }, project);
    if (!t1.ok || !t2.ok) throw new Error('setup failed');

    const result = container.taskService.listTasks(project, { search: `id:${t1.value.id}` });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]!.id).toBe(t1.value.id);
  });

  it('id: prefix supports partial id match', () => {
    const t1 = container.taskService.createTask({ name: 'Task A' }, project);
    const t2 = container.taskService.createTask({ name: 'Task B' }, project);
    if (!t1.ok || !t2.ok) throw new Error('setup failed');

    // Extract the project prefix (e.g. "PROJ" from "PROJ-1")
    const prefix = t1.value.id.split('-')[0]!;
    const result = container.taskService.listTasks(project, { search: `id:${prefix}` });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Both tasks share the same project prefix
    expect(result.value.length).toBeGreaterThanOrEqual(2);
  });

  it('id: prefix does not match text in other fields', () => {
    // Create a task whose name contains the other task's ID
    const t1 = container.taskService.createTask({ name: 'First task' }, project);
    if (!t1.ok) throw new Error('setup failed');

    container.taskService.createTask(
      { name: `Reference to ${t1.value.id} in name` },
      project,
    );

    const result = container.taskService.listTasks(project, { search: `id:${t1.value.id}` });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Only the task with matching id, not the one with the id in name
    expect(result.value).toHaveLength(1);
    expect(result.value[0]!.id).toBe(t1.value.id);
  });

  it('id: prefix works with searchTasks (BM25)', () => {
    const t1 = container.taskService.createTask({ name: 'Task A' }, project);
    if (!t1.ok) throw new Error('setup failed');
    container.taskService.createTask({ name: 'Task B' }, project);

    const result = container.taskService.searchTasks(`id:${t1.value.id}`, project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]!.task.id).toBe(t1.value.id);
  });

  it('plain search matches task name via FTS (all-field search)', () => {
    container.taskService.createTask({ name: 'Fix login authentication bug' }, project);
    container.taskService.createTask({ name: 'Add dashboard widget' }, project);

    // Plain text without id: prefix searches all FTS-indexed fields
    const result = container.taskService.searchTasks('login', project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]!.task.name).toBe('Fix login authentication bug');
  });

  it('id: prefix with no matches returns empty', () => {
    container.taskService.createTask({ name: 'Task A' }, project);

    const result = container.taskService.listTasks(project, { search: 'id:NONEXISTENT-999' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(0);
  });
});
