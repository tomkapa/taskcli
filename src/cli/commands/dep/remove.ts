import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';
import { presentDependencyServiceError } from '../../../service/errors.js';

export function registerDepRemove(parent: Command, container: Container): void {
  parent
    .command('remove <taskId> <dependsOnId>')
    .description('Remove a dependency')
    .action((rawTaskId: string, rawDependsOnId: string) => {
      const result = container.dependencyService.removeDependency({
        taskId: rawTaskId,
        dependsOnId: rawDependsOnId,
      });
      handleResult(result, presentDependencyServiceError);
    });
}
