import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';

export function registerTaskList(parent: Command, container: Container): void {
  parent
    .command('list')
    .description('List tasks with optional filters')
    .option('-p, --project <project>', 'Filter by project id or name')
    .option('-s, --status <status>', 'Filter by status')
    .option('-t, --type <type>', 'Filter by type')
    .option('--priority <priority>', 'Filter by priority')
    .option('--parent <parentId>', 'Filter by parent task id')
    .option('--search <text>', 'Search in name, description, and notes')
    .action(
      (opts: {
        project?: string;
        status?: string;
        type?: string;
        priority?: string;
        parent?: string;
        search?: string;
      }) => {
        const result = container.taskService.listTasks({
          projectId: opts.project,
          status: opts.status,
          type: opts.type,
          priority: opts.priority ? parseInt(opts.priority, 10) : undefined,
          parentId: opts.parent,
          search: opts.search,
        });
        handleResult(result);
      },
    );
}
