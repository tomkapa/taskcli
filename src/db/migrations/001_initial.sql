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

CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_parent_id ON tasks(parent_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_type ON tasks(type);
