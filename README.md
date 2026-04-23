<div align="center">

![Tayto - Task management for solo developers and AI agents](banner.png)

[![npm](https://img.shields.io/npm/v/@tomkapa/tayto)](https://www.npmjs.com/package/@tomkapa/tayto)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](https://nodejs.org)

**Stop losing tasks between AI sessions. Stop drowning in Jira fields you don't need.**

A local-first task manager built for solo developers who work with AI coding agents.
CLI for agents. TUI for humans. One SQLite database. Zero configuration.

[Install](#install) &bull; [Workflow](#workflow) &bull; [Agent Integration](#works-with-every-coding-agent) &bull; [Claude Code Skills](#claude-code-skills)

</div>

---

## Why Tayto

Every project management tool out there assumes you're on a team. They want you to configure sprints, assign story points, set due dates, and fill out fifteen fields before you can track a single task.

If you're a solo dev shipping with AI agents like Claude Code, you need something different:

- **You forget things.** A quick idea during a coding session, a tech debt note from an AI-generated feature, a bug you noticed but can't fix right now. Without a fast capture tool, these vanish.
- **AI generates work faster than you can track it.** Your agent builds five features in an afternoon. Each one leaves behind edge cases, missing tests, and shortcuts. That debt is invisible until it bites you.
- **Priority fields are a lie.** When you're the only one executing, all that matters is order: what's first, what's next. Row 1 in the task list is what you do now. That's it.
- **Your AI agent can't use Jira.** It needs a CLI that speaks JSON. Your existing tools weren't built for this.

Tayto solves exactly this: a **CLI for agents** and a **TUI for humans**, sharing the same local SQLite database. No server. No login. No internet required.

---

## Install

```bash
npm install -g @tomkapa/tayto
```

**Requires:** Node.js >= 22

---

## Demo

![Demo](https://raw.githubusercontent.com/tomkapa/taskcli/main/demo.gif)

---

## Workflow

![Workflow](workflow.png)

**1. Capture** &mdash; AI generates tasks from feature plans, records tech debt, logs bugs.

**2. Prioritize** &mdash; You drag tasks into execution order. No story points. Just: what's first?

**3. Enrich** &mdash; AI researches the codebase and writes implementation-ready technical notes.

**4. Review** &mdash; You read the plan. Approve, adjust, or send it back.

**5. Execute** &mdash; AI implements the top `todo` task. You review the code. Cycle repeats.

---

## Works With Every Coding Agent

Tayto's CLI outputs structured JSON to stdout &mdash; any agent with shell access can manage your tasks.

```jsonc
// Every command returns a consistent envelope
{ "ok": true, "data": { ... } }
```

<table>
<tr>
<td align="center" width="150">
<img src="https://cdn.simpleicons.org/anthropic/D97757" width="40" height="40" alt="Claude Code"><br>
<b>Claude Code</b><br>
<sub>First-class skills</sub>
</td>
<td align="center" width="150">
<img src="https://cdn.simpleicons.org/cursor/000000" width="40" height="40" alt="Cursor"><br>
<b>Cursor</b><br>
<sub>Agent mode / terminal</sub>
</td>
<td align="center" width="150">
<img src="https://cdn.simpleicons.org/windsurf/0066FF" width="40" height="40" alt="Windsurf"><br>
<b>Windsurf</b><br>
<sub>Cascade / terminal</sub>
</td>
<td align="center" width="150">
<img src="https://cdn.simpleicons.org/github/181717" width="40" height="40" alt="GitHub Copilot"><br>
<b>GitHub Copilot</b><br>
<sub>Agent mode / terminal</sub>
</td>
<td align="center" width="150">
<img src="https://cdn.simpleicons.org/cline/5A9" width="40" height="40" alt="Cline"><br>
<b>Cline</b><br>
<sub>VS Code agent</sub>
</td>
</tr>
</table>

No plugins. No API keys. Just install Tayto and your agent can `tayto task list`, `tayto task create`, and `tayto task update` out of the box.

---

## Claude Code Skills

Tayto ships with [Claude Code skills](https://docs.anthropic.com/en/docs/claude-code/skills) for the full AI-assisted workflow &mdash; no prompt engineering required.

### `/tayto`

Manage projects and tasks directly from conversation. Create tasks, search the backlog, re-rank priorities, manage dependencies &mdash; all without leaving Claude Code.

### `/enrich-task`

Picks the next backlog task, researches the codebase for relevant patterns and architecture, then writes self-contained technical notes with implementation steps, acceptance criteria, and package recommendations. Splits out future enhancements as tech-debt tasks automatically.

### `/implement-task`

Picks the highest-priority `todo` task, reads its technical notes, checks dependencies, then implements the feature step by step. Verifies the implementation against acceptance criteria before marking done.

### Adding skills to your project

Install from the community registry:

```bash
npx skills add tomkapa/tayto
```

Or from the Claude Code marketplace:

```bash
/plugin marketplace add tomkapa/tayto
/plugin install tayto
```

---

## Analytics

Two read-only commands expose productivity metrics over a rolling time window. Designed to be consumed by a scheduled agent (e.g. Claude Cowork) at a set interval.

### `tayto analytic summary`

Returns a JSON productivity summary for the given period.

```
tayto analytic summary --period <day|week> [-p <project>]
```

**Sample output:**

```json
{
  "ok": true,
  "data": {
    "period": "day",
    "windowStart": "2026-04-22T06:00:00.000Z",
    "windowEnd": "2026-04-23T06:00:00.000Z",
    "completed": { "total": 3, "byType": { "story": 2, "bug": 1, "tech-debt": 0, "release": 0 } },
    "created":   { "total": 5, "byType": { "story": 4, "bug": 1, "tech-debt": 0, "release": 0 } },
    "current":   { "total": 12, "byStatus": { "backlog": 5, "todo": 3, "in-progress": 2, "review": 1, "done": 1, "cancelled": 0 }, "byType": { ... } },
    "backlogDelta": 2,
    "throughputPerDay": 3
  }
}
```

- `backlogDelta` = `created.total − completed.total` (positive means backlog is growing)
- `throughputPerDay` = `completed.total / periodDays`
- All `byType` and `byStatus` maps always include every key (zero-filled) for stable agent parsing

> **Caveat:** `completed` counts tasks whose `updated_at` falls within the window. Because any edit bumps `updated_at`, a done task edited later will reappear. A proper `completed_at` column is tracked as a separate tech-debt item.

### `tayto analytic completed`

Returns the raw list of completed tasks within a rolling window.

```
tayto analytic completed --since <duration> [-p <project>]
```

Duration format: `<positive integer><unit>` where unit is `m` (minutes), `h` (hours), `d` (days), or `w` (weeks). Examples: `24h`, `7d`, `2w`. Maximum: `365d`.

**Sample output:**

```json
{
  "ok": true,
  "data": [
    { "id": "PROJ-12", "name": "Fix auth bug", "type": "bug", "status": "done", "updatedAt": "2026-04-23T05:12:00.000Z", ... }
  ]
}
```

Results are ordered by `updated_at DESC`. Invalid `--since` values return a VALIDATION error on stderr with exit code 1.

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `TASK_DB_PATH` | `~/.task/data.db` | SQLite database path |
| `TASK_DATA_DIR` | `~/.task` | Data directory |
| `TASK_LOG_LEVEL` | `info` | `debug` / `info` / `warn` / `error` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | &mdash; | OpenTelemetry collector |

Database is created automatically on first run. All data stays on your machine.

---

## License

MIT
