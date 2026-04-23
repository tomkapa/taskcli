import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult, printError } from '../../output.js';
import { presentProjectServiceError } from '../../../service/errors.js';

export function registerProjectDelete(parent: Command, container: Container): void {
  parent
    .command('delete <idOrKeyOrName>')
    .description('Delete a project (lookup by id, key, or name)')
    .action((idOrKeyOrName: string) => {
      const resolved = container.projectService.resolveProject(idOrKeyOrName);
      if (!resolved.ok) return printError(presentProjectServiceError(resolved.error));
      const result = container.projectService.deleteProject(resolved.value.id);
      handleResult(result, presentProjectServiceError);
    });
}
