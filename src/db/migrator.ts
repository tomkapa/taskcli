import type Database from 'better-sqlite3';
import { logger } from '../logging/logger.js';

const migrations: Array<{ name: string; sql: string }> = [
  {
    name: '001_initial.sql',
    sql: `
CREATE TABLE IF NOT EXISTS projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  is_default  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id                      TEXT PRIMARY KEY,
  project_id              TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id               TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  name                    TEXT NOT NULL,
  description             TEXT NOT NULL DEFAULT '',
  type                    TEXT NOT NULL CHECK(type IN ('story','tech-debt','bug')),
  status                  TEXT NOT NULL CHECK(status IN ('backlog','todo','in-progress','review','done','cancelled')),
  priority                INTEGER NOT NULL DEFAULT 3 CHECK(priority BETWEEN 1 AND 5),
  technical_notes         TEXT NOT NULL DEFAULT '',
  additional_requirements TEXT NOT NULL DEFAULT '',
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
`,
  },
];

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    (db.prepare('SELECT name FROM _migrations').all() as Array<{ name: string }>).map(
      (r) => r.name,
    ),
  );

  for (const migration of migrations) {
    if (applied.has(migration.name)) continue;

    logger.info(`Applying migration: ${migration.name}`);

    const migrate = db.transaction(() => {
      db.exec(migration.sql);
      db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(
        migration.name,
        new Date().toISOString(),
      );
    });

    migrate();
    logger.info(`Migration applied: ${migration.name}`);
  }
}
