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
  container.projectService.createProject({ name: 'Proj', isDefault: true });
});

describe('DependencyService', () => {
  it('adds a dependency between two tasks', () => {
    const t1 = container.taskService.createTask({ name: 'Task 1' });
    const t2 = container.taskService.createTask({ name: 'Task 2' });
    if (!t1.ok || !t2.ok) throw new Error('setup failed');

    const result = container.dependencyService.addDependency({
      taskId: t2.value.id,
      dependsOnId: t1.value.id,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.taskId).toBe(t2.value.id);
    expect(result.value.dependsOnId).toBe(t1.value.id);
    expect(result.value.type).toBe('blocks');
  });

  it('rejects self-dependency', () => {
    const t1 = container.taskService.createTask({ name: 'Task 1' });
    if (!t1.ok) throw new Error('setup failed');

    const result = container.dependencyService.addDependency({
      taskId: t1.value.id,
      dependsOnId: t1.value.id,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
  });

  it('rejects duplicate dependency', () => {
    const t1 = container.taskService.createTask({ name: 'Task 1' });
    const t2 = container.taskService.createTask({ name: 'Task 2' });
    if (!t1.ok || !t2.ok) throw new Error('setup failed');

    container.dependencyService.addDependency({
      taskId: t2.value.id,
      dependsOnId: t1.value.id,
    });

    const result = container.dependencyService.addDependency({
      taskId: t2.value.id,
      dependsOnId: t1.value.id,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('DUPLICATE');
  });

  it('detects direct cycle', () => {
    const t1 = container.taskService.createTask({ name: 'Task 1' });
    const t2 = container.taskService.createTask({ name: 'Task 2' });
    if (!t1.ok || !t2.ok) throw new Error('setup failed');

    // t2 depends on t1
    container.dependencyService.addDependency({
      taskId: t2.value.id,
      dependsOnId: t1.value.id,
    });

    // t1 depends on t2 would create a cycle
    const result = container.dependencyService.addDependency({
      taskId: t1.value.id,
      dependsOnId: t2.value.id,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
    expect(result.error.message).toContain('cycle');
  });

  it('detects transitive cycle', () => {
    const t1 = container.taskService.createTask({ name: 'Task 1' });
    const t2 = container.taskService.createTask({ name: 'Task 2' });
    const t3 = container.taskService.createTask({ name: 'Task 3' });
    if (!t1.ok || !t2.ok || !t3.ok) throw new Error('setup failed');

    // t2 -> t1, t3 -> t2
    container.dependencyService.addDependency({
      taskId: t2.value.id,
      dependsOnId: t1.value.id,
    });
    container.dependencyService.addDependency({
      taskId: t3.value.id,
      dependsOnId: t2.value.id,
    });

    // t1 -> t3 would create cycle: t1 -> t3 -> t2 -> t1
    const result = container.dependencyService.addDependency({
      taskId: t1.value.id,
      dependsOnId: t3.value.id,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
    expect(result.error.message).toContain('cycle');
  });

  it('removes a dependency', () => {
    const t1 = container.taskService.createTask({ name: 'Task 1' });
    const t2 = container.taskService.createTask({ name: 'Task 2' });
    if (!t1.ok || !t2.ok) throw new Error('setup failed');

    container.dependencyService.addDependency({
      taskId: t2.value.id,
      dependsOnId: t1.value.id,
    });

    const result = container.dependencyService.removeDependency({
      taskId: t2.value.id,
      dependsOnId: t1.value.id,
    });
    expect(result.ok).toBe(true);

    const deps = container.dependencyService.listAllDeps(t2.value.id);
    expect(deps.ok).toBe(true);
    if (!deps.ok) return;
    expect(deps.value).toHaveLength(0);
  });

  it('lists blockers for a task', () => {
    const t1 = container.taskService.createTask({ name: 'Blocker 1' });
    const t2 = container.taskService.createTask({ name: 'Blocker 2' });
    const t3 = container.taskService.createTask({ name: 'Blocked task' });
    if (!t1.ok || !t2.ok || !t3.ok) throw new Error('setup failed');

    container.dependencyService.addDependency({
      taskId: t3.value.id,
      dependsOnId: t1.value.id,
    });
    container.dependencyService.addDependency({
      taskId: t3.value.id,
      dependsOnId: t2.value.id,
    });

    const result = container.dependencyService.listBlockers(t3.value.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    expect(result.value.map((t) => t.name).sort()).toEqual(['Blocker 1', 'Blocker 2']);
  });

  it('lists dependents of a task', () => {
    const t1 = container.taskService.createTask({ name: 'Foundation' });
    const t2 = container.taskService.createTask({ name: 'Dependent 1' });
    const t3 = container.taskService.createTask({ name: 'Dependent 2' });
    if (!t1.ok || !t2.ok || !t3.ok) throw new Error('setup failed');

    container.dependencyService.addDependency({
      taskId: t2.value.id,
      dependsOnId: t1.value.id,
    });
    container.dependencyService.addDependency({
      taskId: t3.value.id,
      dependsOnId: t1.value.id,
    });

    const result = container.dependencyService.listDependents(t1.value.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
  });

  it('returns transitive dependencies', () => {
    const t1 = container.taskService.createTask({ name: 'Root' });
    const t2 = container.taskService.createTask({ name: 'Middle' });
    const t3 = container.taskService.createTask({ name: 'Leaf' });
    if (!t1.ok || !t2.ok || !t3.ok) throw new Error('setup failed');

    // t3 -> t2 -> t1
    container.dependencyService.addDependency({
      taskId: t2.value.id,
      dependsOnId: t1.value.id,
    });
    container.dependencyService.addDependency({
      taskId: t3.value.id,
      dependsOnId: t2.value.id,
    });

    const result = container.dependencyService.getTransitiveDeps(t3.value.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(2);
    expect(result.value.map((t) => t.name).sort()).toEqual(['Middle', 'Root']);
  });

  it('builds a dependency graph with mermaid output', () => {
    const t1 = container.taskService.createTask({ name: 'Task A' });
    const t2 = container.taskService.createTask({ name: 'Task B' });
    const t3 = container.taskService.createTask({ name: 'Task C' });
    if (!t1.ok || !t2.ok || !t3.ok) throw new Error('setup failed');

    container.dependencyService.addDependency({
      taskId: t2.value.id,
      dependsOnId: t1.value.id,
    });
    container.dependencyService.addDependency({
      taskId: t3.value.id,
      dependsOnId: t2.value.id,
    });

    const result = container.dependencyService.buildGraph(t2.value.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.nodes).toHaveLength(3);
    expect(result.value.edges).toHaveLength(2);
    expect(result.value.mermaid).toContain('graph LR');
    expect(result.value.mermaid).toContain('blocks');
  });

  it('returns NOT_FOUND for dependency on non-existent task', () => {
    const t1 = container.taskService.createTask({ name: 'Task 1' });
    if (!t1.ok) throw new Error('setup failed');

    const result = container.dependencyService.addDependency({
      taskId: t1.value.id,
      dependsOnId: 'nonexistent',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('NOT_FOUND');
  });

  it('supports different dependency types', () => {
    const t1 = container.taskService.createTask({ name: 'Task 1' });
    const t2 = container.taskService.createTask({ name: 'Task 2' });
    if (!t1.ok || !t2.ok) throw new Error('setup failed');

    const result = container.dependencyService.addDependency({
      taskId: t2.value.id,
      dependsOnId: t1.value.id,
      type: 'relates-to',
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.type).toBe('relates-to');
  });
});
