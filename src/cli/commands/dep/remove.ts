import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';

export function registerDepRemove(parent: Command, container: Container): void {
  parent
    .command('remove <taskId> <dependsOnId>')
    .description('Remove a dependency')
    .action((taskId: string, dependsOnId: string) => {
      const result = container.dependencyService.removeDependency({
        taskId,
        dependsOnId,
      });
      handleResult(result);
    });
}
