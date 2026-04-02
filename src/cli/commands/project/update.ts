import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';

export function registerProjectUpdate(parent: Command, container: Container): void {
  parent
    .command('update <id>')
    .description('Update a project')
    .option('-n, --name <name>', 'Project name')
    .option('-d, --description <description>', 'Project description')
    .option('--default', 'Set as default project')
    .action((id: string, opts: { name?: string; description?: string; default?: boolean }) => {
      const result = container.projectService.updateProject(id, {
        name: opts.name,
        description: opts.description,
        isDefault: opts.default,
      });
      handleResult(result);
    });
}
