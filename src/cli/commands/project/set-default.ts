import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';

export function registerProjectSetDefault(parent: Command, container: Container): void {
  parent
    .command('set-default <idOrKeyOrName>')
    .description('Set a project as the default (lookup by id, key, or name)')
    .action((idOrKeyOrName: string) => {
      const resolved = container.projectService.resolveProject(idOrKeyOrName);
      if (!resolved.ok) {
        handleResult(resolved);
        return;
      }
      const result = container.projectService.updateProject(resolved.value.id, {
        isDefault: true,
      });
      handleResult(result);
    });
}
