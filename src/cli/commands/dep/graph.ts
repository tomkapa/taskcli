import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';

export function registerDepGraph(parent: Command, container: Container): void {
  parent
    .command('graph <taskId>')
    .description('Build full dependency graph centered on a task (outputs Mermaid)')
    .action((taskId: string) => {
      const result = container.dependencyService.buildGraph(taskId);
      handleResult(result);
    });
}
