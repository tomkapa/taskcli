import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';

export function registerTaskSearch(parent: Command, container: Container): void {
  parent
    .command('search <query>')
    .description('Full-text search tasks with relevance ranking (FTS5)')
    .option('-p, --project <project>', 'Limit search to a project')
    .action((query: string, opts: { project?: string }) => {
      const result = container.taskService.searchTasks(query, opts.project);
      handleResult(result);
    });
}
