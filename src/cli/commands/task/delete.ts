import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult, printError } from '../../output.js';
import { parseTaskIdArg } from '../../helpers/ids.js';
import { presentTaskServiceError, presentCliError } from '../../../service/errors.js';

export function registerTaskDelete(parent: Command, container: Container): void {
  parent
    .command('delete <id>')
    .description('Delete a task')
    .action((rawId: string) => {
      const parsed = parseTaskIdArg(rawId);
      if (!parsed.ok) return printError(presentCliError(parsed.error));
      handleResult(container.taskService.deleteTask(parsed.value), presentTaskServiceError);
    });
}
