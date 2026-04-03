-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id            TEXT PRIMARY KEY,
  key           TEXT NOT NULL UNIQUE CHECK(LENGTH(key) BETWEEN 2 AND 7 AND key = UPPER(key) AND key NOT GLOB '*[^A-Z0-9]*'),
  name          TEXT NOT NULL UNIQUE,
  description   TEXT NOT NULL DEFAULT '',
  is_default    INTEGER NOT NULL DEFAULT 0,
  task_counter  INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id                      TEXT PRIMARY KEY,
  project_id              TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parent_id               TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  name                    TEXT NOT NULL,
  description             TEXT NOT NULL DEFAULT '',
  type                    TEXT NOT NULL CHECK(type IN ('story','tech-debt','bug')),
  status                  TEXT NOT NULL CHECK(status IN ('backlog','todo','in-progress','review','done','cancelled')),
  rank                    REAL NOT NULL DEFAULT 0,
  technical_notes         TEXT NOT NULL DEFAULT '',
  additional_requirements TEXT NOT NULL DEFAULT '',
  created_at              TEXT NOT NULL,
  updated_at              TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(type);
CREATE INDEX IF NOT EXISTS idx_tasks_rank ON tasks(rank);

-- Seed default project
INSERT INTO projects (id, key, name, description, is_default, task_counter, created_at, updated_at)
VALUES ('default', 'DEFAULT', 'default', 'Default project', 1, 0, datetime('now'), datetime('now'));
