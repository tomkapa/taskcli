import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult, printError } from '../../output.js';
import { parseTaskIdArg } from '../../helpers/ids.js';
import {
  presentCliError,
  presentDependencyServiceError,
} from '../../../service/errors.js';

export function registerDepGraph(parent: Command, container: Container): void {
  parent
    .command('graph <taskId>')
    .description('Build full dependency graph centered on a task (outputs Mermaid)')
    .action((rawTaskId: string) => {
      const parsed = parseTaskIdArg(rawTaskId);
      if (!parsed.ok) return printError(presentCliError(parsed.error));
      handleResult(
        container.dependencyService.buildGraph(parsed.value),
        presentDependencyServiceError,
      );
    });
}
