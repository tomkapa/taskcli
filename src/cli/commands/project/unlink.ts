import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';
import { presentProjectServiceError } from '../../../service/errors.js';

export function registerProjectUnlink(parent: Command, container: Container): void {
  parent
    .command('unlink <idOrKeyOrName>')
    .description('Remove git remote link from a project')
    .action((idOrKeyOrName: string) => {
      const result = container.projectService.unlinkGitRemote(idOrKeyOrName);
      handleResult(result, presentProjectServiceError);
    });
}
