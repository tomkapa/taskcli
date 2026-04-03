# tayto CLI — Full Command Reference

Binary: `tayto`  
Version: 0.1.0

---

## project

```
tayto project create -n <name> [-k <key>] [-d <description>] [--default]
tayto project list
tayto project update <idOrKeyOrName> [-n <name>] [-k <key>] [-d <description>]
tayto project delete <idOrKeyOrName>
tayto project set-default <idOrKeyOrName>
```

- `--default` on create sets this project as the active default
- `<key>` is 2-10 alphanumeric chars (auto-derived from name if omitted)
- Lookup accepts id, key (e.g. `ABC`), or full name

---

## tayto task

```
tayto task create [-n <name>] [-p <project>] [-d <description>]
                 [-t story|tech-debt|bug] [-s <status>]
                 [--parent <parentId>] [--technical-notes <md>]
                 [--additional-requirements <md>]
                 [--depends-on <id>...]

tayto task list [-p <project>] [-s <status>] [-t <type>]
               [--parent <parentId>] [--search <text>]

tayto task show <id>

tayto task update <id> [-n <name>] [-d <description>] [-t <type>] [-s <status>]
                 [--parent <parentId>] [--technical-notes <md>]
                 [--additional-requirements <md>]
                 [--append-notes <md>] [--append-requirements <md>]

tayto task delete <id>

tayto task breakdown <parentId> -f <jsonFile>

tayto task rank <id> [--after <taskId>] [--before <taskId>]
               [--position <n>] [-p <project>]

tayto task search <query> [-p <project>]

tayto task export [-p <project>] [-o <outputFile>]
tayto task import [-p <project>] [-f <inputFile>]
```

**Status values**: `backlog`, `in-progress`, `done`, `cancelled`  
**Type values**: `story`, `tech-debt`, `bug`

The `list` command outputs tasks in rank order. Default status filter is `backlog`.

The `breakdown` command expects a JSON file containing an array of subtask objects:
```json
[
  { "name": "Subtask A", "description": "...", "type": "story" },
  { "name": "Subtask B", "description": "..." }
]
```

The `rank` command uses Jira-style relative positioning:
- `--after <id>` places task immediately after the given task
- `--before <id>` places task immediately before the given task
- `--position <n>` places at 1-based position in the list

---

## tayto dep

```
tayto dep add <taskId> <dependsOnId> [-t blocks|relates-to|duplicates|blocked-by]
tayto dep remove <taskId> <dependsOnId>
tayto dep list <taskId>
tayto dep graph <taskId>
```

- Default dependency type is `blocks` (taskId is blocked by dependsOnId)
- `dep graph` outputs a Mermaid diagram of the full dependency tree centered on taskId
