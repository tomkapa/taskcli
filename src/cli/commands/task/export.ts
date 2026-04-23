import { writeFileSync } from 'node:fs';
import { Command } from 'commander';
import type { Container } from '../../container.js';
import { printSuccess, printError } from '../../output.js';
import { withProject } from '../../helpers/project.js';
import {
  CliErr,
  presentCliError,
  presentPortabilityServiceError,
  presentProjectServiceError,
} from '../../../service/errors.js';

export function registerTaskExport(parent: Command, container: Container): void {
  parent
    .command('export')
    .description('Export tasks to JSON file')
    .option('-p, --project <project>', 'Project id or name')
    .option('-o, --output <file>', 'Output file path (defaults to stdout)')
    .action((opts: { project?: string; output?: string }) => {
      const projectResult = withProject(container, opts.project);
      if (!projectResult.ok) {
        return printError(presentProjectServiceError(projectResult.error));
      }
      const result = container.portabilityService.exportTasks(projectResult.value);
      if (!result.ok) {
        return printError(presentPortabilityServiceError(result.error));
      }

      if (opts.output) {
        try {
          writeFileSync(opts.output, JSON.stringify(result.value, null, 2) + '\n', 'utf-8');
        } catch {
          return printError(presentCliError(CliErr.io(`Failed to write file: ${opts.output}`)));
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
