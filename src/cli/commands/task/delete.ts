import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';

export function registerTaskDelete(parent: Command, container: Container): void {
  parent
    .command('delete <id>')
    .description('Delete a task')
    .action((id: string) => {
      const result = container.taskService.deleteTask(id);
      handleResult(result);
    });
}
