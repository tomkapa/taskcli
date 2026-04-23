import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult, printError } from '../../output.js';
import { withProject } from '../../helpers/project.js';
import {
  presentProjectServiceError,
  presentTaskServiceError,
} from '../../../service/errors.js';

export function registerTaskSearch(parent: Command, container: Container): void {
  parent
    .command('search <query>')
    .description('Full-text search tasks with relevance ranking (FTS5)')
    .option('-p, --project <project>', 'Limit search to a project')
    .action((query: string, opts: { project?: string }) => {
      const projectResult = withProject(container, opts.project);
      if (!projectResult.ok) {
        return printError(presentProjectServiceError(projectResult.error));
      }
      const result = container.taskService.searchTasks(query, projectResult.value);
      handleResult(result, presentTaskServiceError);
    });
}
