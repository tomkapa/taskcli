---
name: implement-task
description: >
  Picks the highest-priority todo task from tayto, moves it to in-progress, and
  implements it in the current project based on the task's technical notes. Use this
  skill when the user says "implement the next task", "work on the next todo",
  "pick up the next task", "start the next item", "build the next feature", or any
  variation of wanting to implement the top todo item. Also trigger on /implement-task.
  Use proactively when the user asks "what should I work on" and there are todo tasks
  ready.
---

# Implement Task Skill

Pick the next ready task from the backlog, then build it. This skill assumes tasks
have already been enriched with self-contained technical notes (via the `enrich-task`
skill or manually). It reads those notes and implements the feature in the current
working directory.

---

## Workflow

### Step 1: Find the next ready task

List level-2 todo tasks sorted by rank:

```bash
tayto task list -s todo -l 2
```

Pick the one with the **lowest rank number** (highest priority).

If there are no todo tasks, tell the user. Suggest running the `enrich-task` workflow
to promote backlog tasks.

### Step 2: Read the task fully

```bash
tayto task show <id>
```

Read the full description, technical notes, and additional requirements. The technical
notes are your primary implementation guide — they contain architecture decisions,
pseudocode, step-by-step instructions, package lists, and acceptance criteria.

### Step 3: Check dependencies

```bash
tayto dep list <id>
```

For each dependency, check its status:

```bash
tayto task show <dep-id>
```

If any dependency is NOT `done`, stop and tell the user:
- Which dependency is blocking
- What its current status is
- Suggest implementing or enriching the blocker first

### Step 4: Move to in-progress

```bash
tayto task update <id> -s in-progress
```

### Step 5: Implement

Follow the technical notes step by step. Key principles:

- **Build exactly what the notes describe.** The technical notes define the scope — don't
  add features or patterns not mentioned. If you think something is missing, note it but
  don't add it unasked.

- **Use the recommended packages.** The "Key Packages" section in the notes lists the
  dependencies to install. Use them rather than alternatives unless there's a clear reason.

- **Match the directory structure.** If the notes specify a directory layout, follow it.
  This ensures consistency across tasks that build on each other.

- **Write working code.** Every file you create should be syntactically valid and
  functional. If the task has acceptance criteria ("What Done Looks Like"), verify each
  one.

- **Install dependencies.** If the implementation needs new packages, install them.

- **Verify the implementation.** After writing the code, run it to confirm it works.
  Adapt the verification commands to what makes sense for the task. The acceptance
  criteria in the technical notes tell you what to check.

### Step 6: Mark done

After implementation is verified:

```bash
tayto task update <id> -s done --append-notes "Implemented. [Brief summary of what was built and any decisions made]"
```

### Step 7: Report

Tell the user:
- Which task was implemented (ID and name)
- What was built (brief summary)
- Any decisions you made that weren't specified in the notes
- How to run/verify the implementation
- What the natural next task is (peek at the next todo item)

---

## Handling Problems

### Missing technical notes
If a todo task has empty or minimal technical notes, don't guess. Tell the user the
task needs enrichment first and suggest running the `enrich-task` workflow.

### Technical notes are unclear
If a step in the technical notes is ambiguous, make a reasonable choice, implement it,
and document the decision in the done notes. Don't block on ambiguity — make progress
and note what you assumed.

### Build errors
If the code doesn't compile or run:
1. Read the error carefully
2. Fix it
3. Re-verify
4. If you can't fix it after a reasonable attempt, tell the user what's broken and why

### Scope creep
If you notice during implementation that something is missing or should be different,
don't expand scope. Instead:
1. Implement what the notes say
2. After marking done, mention what you think should be added
3. Suggest creating a new task for it

---

## Do NOT

- **Do not touch git.** No commits, no staging, no branching. The user handles git.
- **Do not modify files outside the current project.** Don't edit tayto tasks beyond
  status updates and appending notes.
- **Do not add unrequested features.** The technical notes define the scope.
- **Do not skip verification.** Always run the code before marking done.
