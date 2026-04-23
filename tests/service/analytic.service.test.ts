import { describe, it, expect, beforeEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createContainer } from '../../src/cli/container.js';
import { runMigrations } from '../../src/db/migrator.js';
import type { Container } from '../../src/cli/container.js';
import type { Project } from '../../src/types/project.js';
import { TaskStatus, TaskType } from '../../src/types/enums.js';

let container: Container;
let project: Project;

beforeEach(() => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  runMigrations(db);
  container = createContainer(db);
  container.projectService.createProject({ name: 'Test', isDefault: true });
  const p = container.projectService.resolveProject();
  if (!p.ok) throw new Error('setup failed');
  project = p.value;
});

describe('AnalyticService.summary', () => {
  it('returns zeroed payload for empty project', () => {
    const result = container.analyticService.summary({ period: 'day' }, project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const s = result.value;
    expect(s.period).toBe('day');
    expect(new Date(s.windowEnd).getTime()).toBeGreaterThanOrEqual(new Date(s.windowStart).getTime());
    const windowMs = new Date(s.windowEnd).getTime() - new Date(s.windowStart).getTime();
    expect(windowMs).toBeCloseTo(24 * 60 * 60 * 1000, -3);
    expect(s.completed.total).toBe(0);
    expect(s.created.total).toBe(0);
    expect(s.current.total).toBe(0);
    expect(s.backlogDelta).toBe(0);
    expect(s.throughputPerDay).toBe(0);
    // All type and status keys are present and zero
    for (const t of Object.values(TaskType)) {
      expect(s.completed.byType[t]).toBe(0);
      expect(s.created.byType[t]).toBe(0);
    }
    for (const st of Object.values(TaskStatus)) {
      expect(s.current.byStatus[st]).toBe(0);
    }
  });

  it('week window spans 7 days', () => {
    const result = container.analyticService.summary({ period: 'week' }, project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const windowMs =
      new Date(result.value.windowEnd).getTime() -
      new Date(result.value.windowStart).getTime();
    expect(windowMs).toBeCloseTo(7 * 24 * 60 * 60 * 1000, -3);
  });

  it('counts tasks done inside the window', () => {
    const t = container.taskService.createTask({ name: 'Done task', type: 'story' }, project);
    if (!t.ok) throw new Error('setup failed');
    container.taskService.updateTask(t.value.id, { status: 'done' });

    const result = container.analyticService.summary({ period: 'day' }, project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.completed.total).toBe(1);
    expect(result.value.completed.byType[TaskType.Story]).toBe(1);
  });

  it('does not count cancelled tasks as completed', () => {
    const t = container.taskService.createTask({ name: 'Cancelled', type: 'story' }, project);
    if (!t.ok) throw new Error('setup failed');
    container.taskService.updateTask(t.value.id, { status: 'cancelled' });

    const result = container.analyticService.summary({ period: 'day' }, project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.completed.total).toBe(0);
  });

  it('counts created tasks inside the window', () => {
    container.taskService.createTask({ name: 'T1', type: 'bug' }, project);
    container.taskService.createTask({ name: 'T2', type: 'story' }, project);

    const result = container.analyticService.summary({ period: 'day' }, project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.created.total).toBe(2);
    expect(result.value.created.byType[TaskType.Bug]).toBe(1);
    expect(result.value.created.byType[TaskType.Story]).toBe(1);
  });

  it('current.byStatus reflects active tasks', () => {
    const t1 = container.taskService.createTask({ name: 'A', type: 'story' }, project);
    const t2 = container.taskService.createTask({ name: 'B', type: 'story' }, project);
    if (!t1.ok || !t2.ok) throw new Error('setup failed');
    container.taskService.updateTask(t1.value.id, { status: 'in-progress' });

    const result = container.analyticService.summary({ period: 'day' }, project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.current.total).toBe(2);
    expect(result.value.current.byStatus[TaskStatus.InProgress]).toBe(1);
    expect(result.value.current.byStatus[TaskStatus.Backlog]).toBe(1);
  });

  it('backlogDelta = created.total - completed.total', () => {
    container.taskService.createTask({ name: 'A', type: 'story' }, project);
    container.taskService.createTask({ name: 'B', type: 'story' }, project);
    const t3 = container.taskService.createTask({ name: 'C', type: 'story' }, project);
    if (!t3.ok) throw new Error('setup failed');
    container.taskService.updateTask(t3.value.id, { status: 'done' });

    const result = container.analyticService.summary({ period: 'day' }, project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.created.total).toBe(3);
    expect(result.value.completed.total).toBe(1);
    expect(result.value.backlogDelta).toBe(2);
  });

  it('throughputPerDay divides by 7 for week period', () => {
    const t = container.taskService.createTask({ name: 'Done', type: 'story' }, project);
    if (!t.ok) throw new Error('setup failed');
    container.taskService.updateTask(t.value.id, { status: 'done' });

    const result = container.analyticService.summary({ period: 'week' }, project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.throughputPerDay).toBeCloseTo(1 / 7, 5);
  });

  it('byType totals add up to total', () => {
    container.taskService.createTask({ name: 'A', type: 'story' }, project);
    container.taskService.createTask({ name: 'B', type: 'bug' }, project);
    const t3 = container.taskService.createTask({ name: 'C', type: 'story' }, project);
    if (!t3.ok) throw new Error('setup failed');
    container.taskService.updateTask(t3.value.id, { status: 'done' });

    const result = container.analyticService.summary({ period: 'day' }, project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const completedSum = Object.values(result.value.completed.byType).reduce((a, b) => a + b, 0);
    expect(completedSum).toBe(result.value.completed.total);
    const createdSum = Object.values(result.value.created.byType).reduce((a, b) => a + b, 0);
    expect(createdSum).toBe(result.value.created.total);
  });

  it('rejects invalid period', () => {
    const result = container.analyticService.summary({ period: 'month' }, project);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
  });
});

describe('AnalyticService.listCompleted', () => {
  it('returns done tasks updated within the window', () => {
    const t = container.taskService.createTask({ name: 'Done', type: 'story' }, project);
    if (!t.ok) throw new Error('setup failed');
    container.taskService.updateTask(t.value.id, { status: 'done' });

    const result = container.analyticService.listCompleted({ since: '1d' }, project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.id).toBe(t.value.id);
  });

  it('does not return cancelled tasks', () => {
    const t = container.taskService.createTask({ name: 'Cancelled', type: 'story' }, project);
    if (!t.ok) throw new Error('setup failed');
    container.taskService.updateTask(t.value.id, { status: 'cancelled' });

    const result = container.analyticService.listCompleted({ since: '1d' }, project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(0);
  });

  it('returns empty list when nothing was completed', () => {
    container.taskService.createTask({ name: 'Active', type: 'story' }, project);
    const result = container.analyticService.listCompleted({ since: '7d' }, project);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(0);
  });

  it('rejects empty since string', () => {
    const result = container.analyticService.listCompleted({ since: '' }, project);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
  });

  it('rejects invalid duration format', () => {
    const result = container.analyticService.listCompleted({ since: '5' }, project);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
  });

  it('rejects unsupported unit', () => {
    const result = container.analyticService.listCompleted({ since: '5x' }, project);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
  });

  it('rejects negative duration', () => {
    const result = container.analyticService.listCompleted({ since: '-1d' }, project);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
  });

  it('rejects duration over 365 days', () => {
    const result = container.analyticService.listCompleted({ since: '500d' }, project);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('VALIDATION');
  });
});
