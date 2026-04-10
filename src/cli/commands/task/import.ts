import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult, printError } from '../../output.js';
import { parseFieldMapping } from '../../../types/portability.js';
import { AppError } from '../../../errors/app-error.js';
import { withProject } from '../../helpers/project.js';

export function registerTaskImport(parent: Command, container: Container): void {
  parent
    .command('import')
    .description('Import tasks from JSON file')
    .requiredOption('-f, --file <file>', 'Input JSON file path')
    .option('-p, --project <project>', 'Target project id or name')
    .option(
      '--map <mapping>',
      'Field mapping as comma-separated source:target pairs (e.g. "title:name,summary:description")',
    )
    .action((opts: { file: string; project?: string; map?: string }) => {
      let fileData: unknown;
      try {
        const raw = readFileSync(opts.file, 'utf-8');
        fileData = JSON.parse(raw);
      } catch (e) {
        return printError(
          new AppError(
            'VALIDATION',
            `Failed to read or parse file: ${opts.file}${e instanceof Error ? ` - ${e.message}` : ''}`,
          ),
        );
      }

      const fieldMapping = opts.map ? parseFieldMapping(opts.map) : undefined;

      const projectResult = withProject(container, opts.project);
      if (!projectResult.ok) return printError(projectResult.error);
      const result = container.portabilityService.importTasks(
        fileData,
        projectResult.value,
        fieldMapping,
      );
      handleResult(result);
    });
}
