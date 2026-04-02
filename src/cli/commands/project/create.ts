import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';

export function registerProjectCreate(parent: Command, container: Container): void {
  parent
    .command('create')
    .description('Create a new project')
    .requiredOption('-n, --name <name>', 'Project name')
    .option('-d, --description <description>', 'Project description')
    .option('--default', 'Set as default project')
    .action((opts: { name: string; description?: string; default?: boolean }) => {
      const result = container.projectService.createProject({
        name: opts.name,
        description: opts.description,
        isDefault: opts.default,
      });
      handleResult(result);
    });
}
