---
name: tayto
description: >
  Interact with the `tayto` CLI to manage projects and tasks for the current repo.
  Use this skill whenever the user asks to implement a task, plan work, search for
  related tasks, break down a feature, reorder the backlog, manage dependencies,
  or anything involving task tracking. Also trigger when the user says things like
  "what tasks are related to X", "organize my backlog", "add subtasks for Y",
  "mark Z as done", or "what should I work on next".
---

# tayto CLI Skill

This skill teaches you to operate the `tayto` CLI — a task management tool for solo developers and AI agents. The binary is `tayto` (installed globally or via `npx` in the project).

Read `references/commands.md` for the full flag reference. This document covers the higher-level patterns.

---

## Core Concepts

- **Projects** group tasks. A default project is set with `tayto project set-default`.
- **Tasks** live inside a project and have: name, description, type, status, optional parent, and rank order.
- **Task types**: `release`, `story`, `tech-debt`, `bug`.
- **Task levels**: Types map to levels. `release` = level 1 (grouping/delivery layer), `story`/`tech-debt`/`bug` = level 2 (work layer).
- **Parent-child rules**: Level 2 tasks can have zero or one release parent. Releases cannot have parents. Only releases can be parents.
- **Dependencies** express relationships between tasks: `blocks`, `blocked-by`, `relates-to`, `duplicates`. The direction matters: `tayto dep add A B` means A is blocked by B (A depends on B).
- **Rank** is the priority order within the backlog. Lower rank = higher priority. Ranking is scoped by level — releases rank among releases, work items among work items.
- **Auto-status propagation**: When a child moves to `in-progress` and its release parent is `backlog`/`todo`, the parent auto-moves to `in-progress`. When all children of a release reach terminal status (`done`/`cancelled`), the release auto-moves to `done`.

---

## Workflow Patterns

### 1. Implementing a task

When the user says "implement task X" or "work on feature Y":

1. **Search for existing tasks** to avoid duplicates and find related context:
   ```
   tayto task search "Y"
   ```
2. **Show the task** to read its full description, technical notes, and requirements:
   ```
   tayto task show <id>
   ```
3. **Check its dependencies** — what must be done first:
   ```
   tayto dep list <id>
   tayto dep graph <id>   # full tree as Mermaid
   ```
4. **Update status** to signal work has started:
   ```
   tayto task update <id> -s in-progress
   ```
5. Implement the work, then **mark done**:
   ```
   tayto task update <id> -s done
   ```

When returning after implementation, append notes about what was done:
```
tayto task update <id> --append-notes "Implemented via X approach. Key decisions: ..."
```

---

### 2. Breaking down a feature into subtasks

When the user asks to break down a large task:

1. Create the parent **release** if it doesn't exist:
   ```
   tayto task create -n "v1.0 Auth System" -t release -d "..."
   ```
2. Write a breakdown JSON file (e.g. `/tmp/subtasks.json`). Subtasks must be level 2 types (story, tech-debt, bug — not release):
   ```json
   [
     { "name": "Design DB schema", "type": "tech-debt", "description": "..." },
     { "name": "Implement login endpoint", "type": "story", "description": "..." },
     { "name": "Add JWT middleware", "type": "story", "description": "..." }
   ]
   ```
3. Run breakdown (parent must be a release):
   ```
   tayto task breakdown <releaseId> -f /tmp/subtasks.json
   ```
4. Add dependencies between subtasks in logical order:
   ```
   tayto dep add <loginId> <schemaId>     # login endpoint depends on schema
   tayto dep add <jwtId> <loginId>        # JWT middleware depends on login
   ```
5. Rank the subtasks so they reflect execution order:
   ```
   tayto task rank <schemaId> --position 1
   tayto task rank <loginId> --after <schemaId>
   tayto task rank <jwtId> --after <loginId>
   ```

---

### 3. Dependency-aware backlog ordering

When the user asks to "reorder tasks based on dependencies" or "what should I work on next":

1. List all backlog tasks:
   ```
   tayto task list -s backlog
   ```
2. For each task with dependencies, inspect its graph:
   ```
   tayto dep graph <id>
   ```
3. Perform a mental topological sort: tasks with no blockers come first.
4. Re-rank to reflect the order:
   ```
   tayto task rank <unblocked-id> --position 1
   tayto task rank <next-id> --after <unblocked-id>
   # ...
   ```
5. Tell the user: "Here's the optimal work order and why."

---

### 4. Finding tasks related to current work

When the user asks "what tasks are related to X" or before starting new work:

```
tayto task search "X"
tayto task list --search "X"    # also filters live
```

Then `tayto task show <id>` for any promising results to read full context.

If you find a task that covers what the user wants to build, say so — avoid creating duplicates.

---

### 5. Importing tasks from an external system

When the user wants to migrate tasks from Jira, Linear, or any other tracker:

1. **Prepare or locate the JSON file.** The format is:
   ```json
   {
     "version": 1,
     "tasks": [
       {
         "id": "JIRA-101",
         "name": "Design auth flow",
         "description": "...",
         "type": "story",
         "status": "done",
         "parentId": "JIRA-100",
         "technicalNotes": "...",
         "additionalRequirements": "..."
       }
     ],
     "dependencies": [
       { "taskId": "JIRA-102", "dependsOnId": "JIRA-101", "type": "blocks" }
     ]
   }
   ```
   - `tasks[].id` is the **source system ID** (e.g. Jira key). It is used to link old IDs to newly created tayto IDs.
   - `dependencies` reference tasks by their source IDs — tayto remaps them automatically.
   - `parentId` also references source IDs and is remapped during import.

2. **Run the import** (basic — field names already match):
   ```
   tayto task import -f /path/to/tasks.json
   tayto task import -f /path/to/tasks.json -p MyProject
   ```

3. **Use `--map` when source field names differ** from tayto's schema. Provide comma-separated `source:target` pairs:
   ```
   tayto task import -f /path/to/tasks.json \
     --map "key:id,title:name,summary:description,category:type"
   ```
   This maps the source's `key` field to tayto's `id`, `title` to `name`, etc. Mappable target fields: `id`, `name`, `description`, `type`, `status`, `parentId`, `technicalNotes`, `additionalRequirements`, `taskId`, `dependsOnId`.

4. **Read the output.** The command returns an `ImportResult` with:
   - `imported` — count of tasks created
   - `dependencies` — count of dependencies added
   - `idMap` — a mapping of every source ID to its new tayto ID (e.g. `"JIRA-101" → "abc123"`)

   Use the `idMap` to cross-reference old tickets.

**Key behaviors:**
- Tasks are topologically sorted by parent-child relationships so parents are created before children.
- Status values must match tayto's values exactly: `backlog`, `todo`, `in-progress`, `review`, `done`, `cancelled`. There is no automatic normalisation (e.g. `"TODO"` will fail — use `"todo"`).
- Task types must be one of: `release`, `story`, `tech-debt`, `bug`.
- Parent-child constraints apply during import: only releases can be parents, and subtasks cannot be releases.
- Dependency types: `blocks` (default), `relates-to`, `duplicates`.
- See `samples/import-example.json` for a complete example with tasks, parent-child hierarchies, and dependencies.

---

### 6. Working with releases

Releases are level 1 tasks that group related work items around a delivery boundary.

1. **Create a release**:
   ```
   tayto task create -n "v1.0 Auth System" -t release -d "..."
   ```

2. **List releases only**:
   ```
   tayto task list -l 1
   ```

3. **List work items only** (default):
   ```
   tayto task list              # defaults to level 2
   tayto task list -l 2         # explicit
   ```

4. **Assign a work task to a release**:
   ```
   tayto task update <taskId> --parent <releaseId>
   ```

5. **Detach a task from its release**:
   ```
   tayto task update <taskId> --detach-parent
   ```

6. **List children of a release**:
   ```
   tayto task list --parent <releaseId>
   ```

**Level constraints enforced by the CLI:**
- Releases cannot have a parent (`--parent` is rejected for release-type tasks).
- Only releases can be parents; `--parent <storyId>` is rejected.
- Changing type from release to story is rejected if the release has children.
- Changing type to release is rejected if the task has a parent.
- Ranking operates within the same level — releases rank among releases, work items among work items.

**Auto-status propagation:**
- When a child transitions to `in-progress` and its parent release is `backlog` or `todo`, the release automatically moves to `in-progress`.
- When all children of a release are terminal (`done`/`cancelled`), the release automatically moves to `done`.

---

### 7. Creating a new task with full context (including release parent)

When you need to log a new task with all relevant information:

```
tayto task create \
  -n "Name of task" \
  -t story \
  -d "One-sentence summary" \
  --technical-notes "## Approach\n\nContext and design decisions..." \
  --additional-requirements "- Must handle edge case X\n- Should integrate with Y" \
  --depends-on <blockerId>
```

Fill `--technical-notes` with what you know about the implementation approach. Fill `--additional-requirements` with constraints or acceptance criteria. This makes the task useful to future agents.

---

### 8. Updating task status and notes during implementation

Keep tasks accurate as you work. Don't wait until you're done:

```
# Starting work
tayto task update <id> -s in-progress

# Discovered a constraint mid-implementation
tayto task update <id> --append-notes "Found that X requires Y because ..."

# Done
tayto task update <id> -s done --append-notes "Completed. Implementation lives in src/..."
```

---

### 9. Querying productivity analytics

When a scheduled agent or user wants a performance summary over a rolling window:

**Productivity summary (completed, created, current counts):**
```
tayto analytic summary --period day
tayto analytic summary --period week
tayto analytic summary --period day -p MyProject
```

Returns a JSON object with:
- `completed` — tasks with `status=done` whose `updated_at` falls in the window, broken down by type
- `created` — tasks created in the window, by type
- `current` — snapshot of all tasks by status and type
- `backlogDelta` — `created.total − completed.total` (positive = backlog growing)
- `throughputPerDay` — `completed.total / periodDays`

All `byType` and `byStatus` maps include every key with `0` for missing buckets — safe to read without existence checks.

**List completed tasks in a rolling window:**
```
tayto analytic completed --since 24h
tayto analytic completed --since 7d
tayto analytic completed --since 2w -p MyProject
```

Duration format: `<positive integer><unit>` where unit is `m` (minutes), `h` (hours), `d` (days), or `w` (weeks). Maximum: `365d`. Results are ordered by `updated_at DESC`.

> **Caveat:** "completed in window" is approximated by `status=done AND updated_at >= windowStart`. Because any edit bumps `updated_at`, a done task edited later will reappear in the window. A proper `completed_at` column is a known future improvement.

---

## Tips

- Always `tayto task show <id>` before modifying a task — read what's there first.
- Use `tayto dep graph <id>` to visualize the full dependency tree when the user asks about sequencing or blockers.
- When a task is too broad, break it down with `breakdown` rather than trying to tackle it whole.
- Export the backlog to JSON when the user needs a snapshot or wants to import/migrate:
  ```
  tayto task export -o /tmp/backlog.json
  ```
- The `search` command uses FTS5 full-text search, so it handles partial words and multi-term queries well.
- Use `tayto analytic summary --period day` at the start of a scheduled agent session to get the current productivity picture before making recommendations.
