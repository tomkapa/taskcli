import { writeFileSync } from 'node:fs';
import { Command } from 'commander';
import type { Container } from '../../container.js';
import { printSuccess, printError } from '../../output.js';
import { AppError } from '../../../errors/app-error.js';

export function registerTaskExport(parent: Command, container: Container): void {
  parent
    .command('export')
    .description('Export tasks to JSON file')
    .option('-p, --project <project>', 'Project id or name')
    .option('-o, --output <file>', 'Output file path (defaults to stdout)')
    .action((opts: { project?: string; output?: string }) => {
      const result = container.portabilityService.exportTasks(opts.project);
      if (!result.ok) {
        return printError(result.error);
      }

      if (opts.output) {
        try {
          writeFileSync(opts.output, JSON.stringify(result.value, null, 2) + '\n', 'utf-8');
        } catch (e) {
          return printError(new AppError('UNKNOWN', `Failed to write file: ${opts.output}`, e));
        }
        printSuccess({
          file: opts.output,
          tasks: result.value.tasks.length,
          dependencies: result.value.dependencies.length,
        });
      } else {
        printSuccess(result.value);
      }
    });
}
