import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';

export function registerProjectDelete(parent: Command, container: Container): void {
  parent
    .command('delete <id>')
    .description('Delete a project')
    .action((id: string) => {
      const result = container.projectService.deleteProject(id);
      handleResult(result);
    });
}
