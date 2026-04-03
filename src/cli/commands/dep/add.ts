import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';
import { UIDependencyType, DependencyType } from '../../../types/enums.js';

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
      // blocked-by means taskId is blocked by dependsOnId, i.e. dependsOnId depends on taskId.
      const isBlockedBy = opts.type === UIDependencyType.BlockedBy;
      const result = container.dependencyService.addDependency({
        taskId: isBlockedBy ? dependsOnId : taskId,
        dependsOnId: isBlockedBy ? taskId : dependsOnId,
        type: isBlockedBy ? DependencyType.Blocks : opts.type,
      });
      handleResult(result);
    });
}
