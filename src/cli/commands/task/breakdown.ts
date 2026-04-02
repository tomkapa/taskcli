import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';
import { AppError } from '../../../errors/app-error.js';
import { printError } from '../../output.js';

export function registerTaskBreakdown(parent: Command, container: Container): void {
  parent
    .command('breakdown <parentId>')
    .description('Create subtasks from a JSON file')
    .requiredOption('-f, --file <path>', 'JSON file with array of subtask definitions')
    .action((parentId: string, opts: { file: string }) => {
      let subtasks: unknown[];
      try {
        const content = readFileSync(opts.file, 'utf-8');
        const parsed: unknown = JSON.parse(content);
        if (!Array.isArray(parsed)) {
          printError(new AppError('VALIDATION', 'File must contain a JSON array of subtasks'));
        }
        subtasks = parsed;
      } catch (e) {
        if (e instanceof AppError) throw e;
        printError(new AppError('VALIDATION', `Failed to read subtasks file: ${opts.file}`, e));
      }

      const result = container.taskService.breakdownTask(parentId, subtasks);
      handleResult(result);
    });
}
