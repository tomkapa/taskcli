import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';

export function registerTaskList(parent: Command, container: Container): void {
  parent
    .command('list')
    .description('List tasks in rank order (defaults to backlog)')
    .option('-p, --project <project>', 'Filter by project id or name')
    .option('-s, --status <status>', 'Filter by status (default: backlog)')
    .option('-t, --type <type>', 'Filter by type')
    .option('--parent <parentId>', 'Filter by parent task id')
    .option('--search <text>', 'Search in name, description, and notes')
    .action(
      (opts: {
        project?: string;
        status?: string;
        type?: string;
        parent?: string;
        search?: string;
      }) => {
        const result = container.taskService.listTasks({
          projectId: opts.project,
          status: opts.status ?? 'backlog',
          type: opts.type,
          parentId: opts.parent,
          search: opts.search,
        });
        handleResult(result);
      },
    );
}
