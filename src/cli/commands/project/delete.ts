import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';

export function registerProjectDelete(parent: Command, container: Container): void {
  parent
    .command('delete <idOrKeyOrName>')
    .description('Delete a project (lookup by id, key, or name)')
    .action((idOrKeyOrName: string) => {
      const resolved = container.projectService.resolveProject(idOrKeyOrName);
      if (!resolved.ok) {
        handleResult(resolved);
        return;
      }
      const result = container.projectService.deleteProject(resolved.value.id);
      handleResult(result);
    });
}
