import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';

export function registerDepAdd(parent: Command, container: Container): void {
  parent
    .command('add <taskId> <dependsOnId>')
    .description('Add a dependency (taskId depends on dependsOnId)')
    .option(
      '-t, --type <type>',
      'Dependency type: blocks, relates-to, duplicates, blocked-by',
      'blocks',
    )
    .action((taskId: string, dependsOnId: string, opts: { type?: string }) => {
      const result = container.dependencyService.addDependency({
        taskId,
        dependsOnId,
        type: opts.type,
      });
      handleResult(result);
    });
}
