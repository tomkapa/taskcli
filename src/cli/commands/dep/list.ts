import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult, printError } from '../../output.js';
import { parseTaskIdArg } from '../../helpers/ids.js';
import {
  presentCliError,
  presentDependencyServiceError,
} from '../../../service/errors.js';

export function registerDepList(parent: Command, container: Container): void {
  parent
    .command('list <taskId>')
    .description('List direct dependencies of a task')
    .option('--blockers', 'Show tasks that block this task')
    .option('--dependents', 'Show tasks that depend on this task')
    .option('--transitive', 'Show all transitive blockers (deep)')
    .action(
      (
        rawTaskId: string,
        opts: { blockers?: boolean; dependents?: boolean; transitive?: boolean },
      ) => {
        const parsed = parseTaskIdArg(rawTaskId);
        if (!parsed.ok) return printError(presentCliError(parsed.error));
        const id = parsed.value;
        if (opts.transitive) {
          handleResult(
            container.dependencyService.getTransitiveDeps(id),
            presentDependencyServiceError,
          );
        } else if (opts.dependents) {
          handleResult(
            container.dependencyService.listDependents(id),
            presentDependencyServiceError,
          );
        } else if (opts.blockers) {
          handleResult(
            container.dependencyService.listBlockers(id),
            presentDependencyServiceError,
          );
        } else {
          handleResult(
            container.dependencyService.listAllDeps(id),
            presentDependencyServiceError,
          );
        }
      },
    );
}
