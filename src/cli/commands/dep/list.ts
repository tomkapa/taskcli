import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';

export function registerDepList(parent: Command, container: Container): void {
  parent
    .command('list <taskId>')
    .description('List direct dependencies of a task')
    .option('--blockers', 'Show tasks that block this task')
    .option('--dependents', 'Show tasks that depend on this task')
    .option('--transitive', 'Show all transitive blockers (deep)')
    .action(
      (
        taskId: string,
        opts: { blockers?: boolean; dependents?: boolean; transitive?: boolean },
      ) => {
        if (opts.transitive) {
          handleResult(container.dependencyService.getTransitiveDeps(taskId));
        } else if (opts.dependents) {
          handleResult(container.dependencyService.listDependents(taskId));
        } else if (opts.blockers) {
          handleResult(container.dependencyService.listBlockers(taskId));
        } else {
          // Default: show all dependency edges
          handleResult(container.dependencyService.listAllDeps(taskId));
        }
      },
    );
}
