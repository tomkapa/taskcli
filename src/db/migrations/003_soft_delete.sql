-- Add soft-delete column to projects
ALTER TABLE projects ADD COLUMN deleted_at TEXT DEFAULT NULL;

-- Add soft-delete column to tasks
ALTER TABLE tasks ADD COLUMN deleted_at TEXT DEFAULT NULL;

-- Index for efficient filtering of non-deleted rows
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at ON projects(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at ON tasks(deleted_at);

-- Replace FTS triggers to exclude soft-deleted tasks.
-- DROP + re-CREATE because SQLite does not support CREATE OR REPLACE TRIGGER.

DROP TRIGGER IF EXISTS tasks_fts_ai;
DROP TRIGGER IF EXISTS tasks_fts_ad;
DROP TRIGGER IF EXISTS tasks_fts_au;

-- INSERT: only index if not soft-deleted
CREATE TRIGGER tasks_fts_ai AFTER INSERT ON tasks
WHEN NEW.deleted_at IS NULL
BEGIN
  INSERT INTO tasks_fts(rowid, id, name, description, technical_notes, additional_requirements)
  VALUES (NEW.rowid, NEW.id, NEW.name, NEW.description, NEW.technical_notes, NEW.additional_requirements);
END;

-- DELETE: remove from FTS (hard deletes still possible via cascade)
CREATE TRIGGER tasks_fts_ad AFTER DELETE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, id, name, description, technical_notes, additional_requirements)
  VALUES ('delete', OLD.rowid, OLD.id, OLD.name, OLD.description, OLD.technical_notes, OLD.additional_requirements);
END;

-- UPDATE: re-index. If deleted_at was just set, remove from FTS. If cleared, add back.
CREATE TRIGGER tasks_fts_au AFTER UPDATE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, id, name, description, technical_notes, additional_requirements)
  VALUES ('delete', OLD.rowid, OLD.id, OLD.name, OLD.description, OLD.technical_notes, OLD.additional_requirements);
  INSERT INTO tasks_fts(rowid, id, name, description, technical_notes, additional_requirements)
  SELECT NEW.rowid, NEW.id, NEW.name, NEW.description, NEW.technical_notes, NEW.additional_requirements
  WHERE NEW.deleted_at IS NULL;
END;
