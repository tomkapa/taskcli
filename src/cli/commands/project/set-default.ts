import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult, printError } from '../../output.js';
import { presentProjectServiceError } from '../../../service/errors.js';

export function registerProjectSetDefault(parent: Command, container: Container): void {
  parent
    .command('set-default <idOrKeyOrName>')
    .description('Set a project as the default (lookup by id, key, or name)')
    .action((idOrKeyOrName: string) => {
      const resolved = container.projectService.resolveProject(idOrKeyOrName);
      if (!resolved.ok) return printError(presentProjectServiceError(resolved.error));
      const result = container.projectService.updateProject(resolved.value.id, {
        isDefault: true,
      });
      handleResult(result, presentProjectServiceError);
    });
}
