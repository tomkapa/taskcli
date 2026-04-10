---
name: enrich-task
description: >
  Enriches the next backlog task with implementation-ready technical notes by researching
  the codebase, then promotes it to todo. Use this skill when the user says
  "enrich the next task", "prepare the next backlog item", "research and promote the next
  task", "populate technical notes", "what's next to enrich", or any variation of moving
  a backlog task to todo with research. Also trigger when the user runs /enrich-task or
  asks to "get the next task ready for implementation". This skill should be used
  proactively when the user is working through a backlog and needs tasks prepared for
  implementation.
---

# Enrich Task Skill

This skill defines the workflow for taking the next unready backlog task, researching the codebase for relevant patterns, writing self-contained technical notes, splitting out future enhancements as tech-debt, and promoting the task to `todo`.

---

## Workflow

### Step 1: Find the next task

List level-2 backlog tasks and pick the highest-ranked (lowest rank number) one:

```bash
tayto task list -s backlog -l 2
```

If there are no backlog level-2 tasks, tell the user. Don't look at `todo` tasks — those are already enriched.

Show the task to read its full context:

```bash
tayto task show <id>
```

Check dependencies — if this task is blocked by incomplete work, tell the user and suggest they enrich the blocker first instead:

```bash
tayto dep list <id>
```

### Step 2: Challenge the task before enriching it

**Do not skip this step. Do not treat it as a formality.** The single biggest failure mode of this skill is blindly enriching tasks that shouldn't be built, or shouldn't be built *yet*, because they look routine in the backlog.

Before running deep research or drafting notes, pause and answer each of the following questions explicitly. Write your answers in your reasoning so the user can see you considered them.

1. **Is this task necessary for the project?**
   Does the project actually need this feature to meet its goals? Ask: if the project shipped without this feature, what breaks? If the honest answer is "nothing load-bearing," that's a red flag.

2. **If it is necessary, is this the right phase?**
   Does the task depend on design decisions the project hasn't made yet? Does it pull in complexity the project isn't ready to handle? Is there a simpler earlier version that should be built first? A task can be both necessary *and* premature — phase matters as much as priority.

3. **What does this task break, disable, or constrain?**
   Does it turn off existing behaviors users currently rely on? Does it commit the project to a specific architectural direction? Does it introduce state that other features will have to route around?

4. **What does this task *force* you to build afterward?**
   Enumerate the companion tasks. A feature that implicitly requires N other features is not a leaf task — it's the root of a cluster. If the cluster contains work the user hasn't explicitly committed to, that's a signal to surface the cluster now, not after the root task has shipped.

5. **Is the complexity proportional to the value?**
   Does this task deliver meaningful value, or is most of its difficulty in edge cases the project will never hit? If 10% of the task delivers the core value and 90% handles edge cases, the task may need to be *shrunk* before enrichment, not just split.

6. **Is the decision to do this task, in this phase, at this scope, obvious?**
   If yes -> proceed to Step 3. If no -> **STOP and ask the human immediately**. Do not guess. Do not pick for them.

#### When to stop and ask (bias hard toward stopping)

The bar for asking is low. **If any of the following are true, stop and ask**:

- The task's necessity isn't obvious from its description alone.
- The task has significant ripple effects — it breaks existing behaviors, forces companion work, or shapes architecture in ways the user may not have considered.
- The "minimal scope" still looks heavy.
- You'd need to make a non-trivial design judgment to scope it correctly.
- A cheaper alternative exists (skip, defer, inline version, scope down) that the user may not have considered.
- You're uncertain which phase of the project this fits.
- You notice this task is the root of a cluster the user hasn't committed to.

A 30-second check with the user is much cheaper than a wrong enrichment they have to unwind later. **When in doubt, ask.** Wrong enrichments are the expensive failure mode; "wasting" a single message to confirm direction is the cheap one.

#### How to ask

Do **not** ask "should I enrich this task?" — that's too vague and pushes the judgment back to the user without giving them anything to work with. Frame the question concretely so they can make an informed call:

1. **State the concern** — the specific issue you noticed, in one sentence.
2. **Explain the consequence** — what happens if the task is enriched and built as-is: companion tasks that become mandatory, behaviors that break, architectural commitments that get locked in.
3. **List 2-4 concrete alternatives** — "skip entirely", "defer to phase X", "scope down to Y", "replace with simpler task Z". Include the trade-offs of each.
4. **Offer a recommendation** — don't leave the user without a steer. Suggest the option you'd take and why, while making clear they decide.
5. **Ask for explicit approval** — "want me to proceed with [recommendation], or take a different route?"

Example framing:

> **Before I enrich this, I want to flag something.** TASK-XXX ([task name]) looks like a feature task, but enabling it *breaks [existing behavior]* which your users currently have for free. That forces TASK-YYY as a mandatory companion — you can't enable one without the other.
>
> **Consequence:** enriching this task commits the project to [architectural direction] rather than [simpler alternative]. That's a [N]-task cluster, not a leaf feature.
>
> **Options:**
> 1. **Skip this cluster entirely.** [What you gain, what you give up.]
> 2. **Defer to a later phase.** Keep in backlog, revisit when [concrete trigger].
> 3. **Enrich now.** Commit to [direction] and build the full cluster.
>
> **Recommendation:** option 1 or 2 — [one-sentence reason]. What would you like to do?

#### If the user chooses to proceed

Stay interactive during the enrichment. Do **not** dump the full deliverable at the end as a fait accompli. Surface decisions as they come up:

- "The codebase uses pattern X for this — it's sophisticated but may be overkill here. Split it out as tech-debt?"
- "There's a workaround for a specific edge case. Skip it for the initial version?"
- "This sub-feature is tangled with another system. I can either rip that dependency out or scope this task to assume the other system exists. Preference?"

Enrichment is a conversation, not a batch job.

---

### Step 3: Research the codebase

Search the current working directory for code related to the task. Use a combination of:

- **Glob** to find relevant files by name patterns
- **Grep** to search for related functions, types, patterns
- **Read** to study the key files you find

Focus on understanding:
1. **Architecture** — How is the feature area structured? What are the layers?
2. **Key patterns** — What design patterns does the codebase use? Why?
3. **Dependencies** — What does the feature depend on? What depends on it?
4. **Non-obvious decisions** — What's surprising or counterintuitive? These are the most valuable things to document.

### Step 4: Write self-contained technical notes

Update the task's technical notes with implementation guidance. The notes must be:

- **Self-contained** — Someone reading these notes should be able to implement the feature with only the notes and project context.
- **Educational** — Explain the "why" behind architectural decisions, not just the "what".
- **Actionable** — Include enough detail (pseudocode, type signatures, package recommendations) to implement.
- **Minimal** — Only describe what's needed for THIS task. If you discover enhancements that belong in a later phase, split them out (see Step 5).

#### Technical notes structure

Use this structure (adapt as needed):

```markdown
## Goal
One-sentence summary of what this task achieves and why it matters.

## Architecture
Key design decisions and why they were made. Focus on the transferable
pattern, not implementation-specific quirks.

## Implementation Steps
### 1. [Step name]
Description, pseudocode, or code patterns.
### 2. [Step name]
...

## What "Done" Looks Like
Concrete acceptance criteria — observable behaviors, not internal state.

## Key Packages
External dependencies needed, with brief rationale for each.

## What This Does NOT Include
Explicit scope boundaries. Reference the tech-debt tasks created in Step 5.
```

### Step 5: Split enhancements into tech-debt tasks

While researching, you'll often discover sophisticated patterns that aren't necessary for the current step. For each such enhancement:

1. Ask yourself: "Is this essential for THIS task's acceptance criteria, or is it an optimization/enhancement that can come later?"
2. If it can come later, **search for existing similar tasks first** before creating a new one:

```bash
tayto task search "<keywords describing the enhancement>"
```

If a matching task already exists (same concept, even if worded differently), skip creation — optionally update its technical notes if you have new information. Only create a new tech-debt task if no similar task is found:

```bash
tayto task create \
  -n "[Short descriptive name]" \
  -t tech-debt \
  --parent <same-epic-as-current-task> \
  -d "[One-sentence description]" \
  --technical-notes "[Self-contained explanation of the pattern, why it exists, when to do it, and enough detail to implement later]"
```

**IMPORTANT — Task naming rule:** The `-n` value MUST be a plain descriptive name with **no prefix of any kind**. Do NOT prepend `F-`, `F-XXX`, `TD`, `TD-`, `BUG-`, `[Feature]`, `[Tech Debt]`, ticket-style codes, numeric IDs, or any other tag/category marker. The task `type` (`-t feature`, `-t tech-debt`, `-t bug`, etc.) already distinguishes the kind of task — duplicating that in the name is noise.

- Good: `-n "Stream agent responses to multiple consumers"`
- Good: `-n "Cache compiled prompt templates"`
- Bad: `-n "TD-001: Cache compiled prompt templates"`
- Bad: `-n "F-Stream agent responses"`
- Bad: `-n "[Tech Debt] Cache compiled prompt templates"`

This same rule applies anywhere you create or rename a task in this workflow, not just tech-debt creation.

After creating each tech-debt task, add a dependency so it's blocked by the original task being enriched:

```bash
tayto dep add <new-tech-debt-id> <original-task-id>
```

This ensures the tech-debt enhancement won't be picked up until the original feature task is complete.

Common things to split out:
- Performance optimizations (caching, parallel loading, lazy imports)
- Advanced rendering or UI features
- Security hardening beyond the basics
- Enterprise features (managed settings, policy limits)
- Monitoring/telemetry integration

### Step 6: Promote the task

Update the task status to `todo` and set the enriched technical notes:

```bash
tayto task update <id> -s todo --technical-notes "<notes>"
```

### Step 7: Report back

Tell the user:
- Which task was enriched (ID and name)
- Brief summary of what you found in the research
- How many tech-debt tasks were created and what they cover
- The task is now ready for implementation

---

## Principles

- **Challenge before enriching.** A task's existence in the backlog is not proof it should be built, or built now, or built at this scope. Before doing any research, explicitly answer: is this necessary? is this the right phase? what does it break or force? If the answer isn't obviously yes, *stop and ask the human* — don't guess direction for them. Wrong enrichments are expensive; 30-second check-ins are cheap.
- **Stay in conversation during enrichment.** When the user chooses to proceed, surface scoping decisions as you hit them ("split this out?", "skip this workaround?", "include all paths or just the primary one?"). Enrichment is a dialogue, not a batch job delivered at the end.
- **Teach, don't dump.** The notes should help someone understand how to build the feature, not overwhelm them with complexity.
- **Minimal viable scope.** Each task should describe the simplest version that works. Advanced patterns belong in follow-up tasks.
- **Self-contained.** Every task should be implementable by reading only its own notes + the notes of its dependencies. No external references required.
- **Explain the why.** "Use an async generator for the agent loop" is useless without "because it enables streaming to multiple consumers without callbacks."
