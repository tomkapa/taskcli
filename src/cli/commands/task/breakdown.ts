import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult, printError } from '../../output.js';
import { AppError } from '../../../errors/app-error.js';

export function registerTaskBreakdown(parent: Command, container: Container): void {
  parent
    .command('breakdown <parentId>')
    .description('Create subtasks from a JSON file')
    .requiredOption('-f, --file <path>', 'JSON file with array of subtask definitions')
    .action((parentId: string, opts: { file: string }) => {
      let content: string;
      try {
        content = readFileSync(opts.file, 'utf-8');
      } catch (e) {
        return printError(
          new AppError('VALIDATION', `Failed to read subtasks file: ${opts.file}`, e),
        );
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch (e) {
        return printError(
          new AppError('VALIDATION', `Invalid JSON in subtasks file: ${opts.file}`, e),
        );
      }

      if (!Array.isArray(parsed)) {
        return printError(new AppError('VALIDATION', 'File must contain a JSON array of subtasks'));
      }

      handleResult(container.taskService.breakdownTask(parentId, parsed));
    });
}
