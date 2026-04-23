import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult, printError } from '../../output.js';
import { parseTaskIdArg } from '../../helpers/ids.js';
import {
  CliErr,
  presentCliError,
  presentTaskServiceError,
} from '../../../service/errors.js';

export function registerTaskBreakdown(parent: Command, container: Container): void {
  parent
    .command('breakdown <parentId>')
    .description('Create subtasks from a JSON file')
    .requiredOption('-f, --file <path>', 'JSON file with array of subtask definitions')
    .action((rawParentId: string, opts: { file: string }) => {
      let content: string;
      try {
        content = readFileSync(opts.file, 'utf-8');
      } catch {
        return printError(
          presentCliError(CliErr.validation(`Failed to read subtasks file: ${opts.file}`)),
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        return printError(
          presentCliError(CliErr.validation(`Invalid JSON in subtasks file: ${opts.file}`)),
        );
      }

      if (!Array.isArray(parsed)) {
        return printError(
          presentCliError(CliErr.validation('File must contain a JSON array of subtasks')),
        );
      }

      const parsedId = parseTaskIdArg(rawParentId);
      if (!parsedId.ok) return printError(presentCliError(parsedId.error));
      handleResult(
        container.taskService.breakdownTask(parsedId.value, parsed),
        presentTaskServiceError,
      );
    });
}
