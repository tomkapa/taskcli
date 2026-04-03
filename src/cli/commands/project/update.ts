import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';

export function registerProjectUpdate(parent: Command, container: Container): void {
  parent
    .command('update <idOrKeyOrName>')
    .description('Update a project (lookup by id, key, or name)')
    .option('-n, --name <name>', 'Project name')
    .option('-d, --description <description>', 'Project description')
    .option('--default', 'Set as default project')
    .action(
      (idOrKeyOrName: string, opts: { name?: string; description?: string; default?: boolean }) => {
        const resolved = container.projectService.resolveProject(idOrKeyOrName);
        if (!resolved.ok) {
          handleResult(resolved);
          return;
        }
        const result = container.projectService.updateProject(resolved.value.id, {
          name: opts.name,
          description: opts.description,
          isDefault: opts.default,
        });
        handleResult(result);
      },
    );
}
