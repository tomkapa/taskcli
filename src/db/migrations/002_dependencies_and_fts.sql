-- Task dependencies (DAG edges)
CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type          TEXT NOT NULL DEFAULT 'blocks' CHECK(type IN ('blocks','relates-to','duplicates')),
  created_at    TEXT NOT NULL,
  PRIMARY KEY (task_id, depends_on_id),
  CHECK (task_id != depends_on_id)
);

CREATE INDEX IF NOT EXISTS idx_deps_depends_on ON task_dependencies(depends_on_id);
CREATE INDEX IF NOT EXISTS idx_deps_type ON task_dependencies(type);

-- Full-text search index on tasks
CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
  id UNINDEXED,
  name,
  description,
  technical_notes,
  additional_requirements,
  content='tasks',
  content_rowid='rowid'
);

-- Populate FTS from existing tasks
INSERT INTO tasks_fts(rowid, id, name, description, technical_notes, additional_requirements)
  SELECT rowid, id, name, description, technical_notes, additional_requirements FROM tasks;

-- Keep FTS in sync: INSERT
CREATE TRIGGER IF NOT EXISTS tasks_fts_ai AFTER INSERT ON tasks BEGIN
  INSERT INTO tasks_fts(rowid, id, name, description, technical_notes, additional_requirements)
  VALUES (NEW.rowid, NEW.id, NEW.name, NEW.description, NEW.technical_notes, NEW.additional_requirements);
END;

-- Keep FTS in sync: DELETE
CREATE TRIGGER IF NOT EXISTS tasks_fts_ad AFTER DELETE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, id, name, description, technical_notes, additional_requirements)
  VALUES ('delete', OLD.rowid, OLD.id, OLD.name, OLD.description, OLD.technical_notes, OLD.additional_requirements);
END;

-- Keep FTS in sync: UPDATE
CREATE TRIGGER IF NOT EXISTS tasks_fts_au AFTER UPDATE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, id, name, description, technical_notes, additional_requirements)
  VALUES ('delete', OLD.rowid, OLD.id, OLD.name, OLD.description, OLD.technical_notes, OLD.additional_requirements);
  INSERT INTO tasks_fts(rowid, id, name, description, technical_notes, additional_requirements)
  VALUES (NEW.rowid, NEW.id, NEW.name, NEW.description, NEW.technical_notes, NEW.additional_requirements);
END;
