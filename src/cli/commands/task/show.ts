import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';

export function registerTaskShow(parent: Command, container: Container): void {
  parent
    .command('show <id>')
    .description('Show task details')
    .action((id: string) => {
      const result = container.taskService.getTask(id);
      handleResult(result);
    });
}
