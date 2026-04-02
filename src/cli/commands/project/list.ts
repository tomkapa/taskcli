import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';

export function registerProjectList(parent: Command, container: Container): void {
  parent
    .command('list')
    .description('List all projects')
    .action(() => {
      const result = container.projectService.listProjects();
      handleResult(result);
    });
}
