import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult, printError } from '../../output.js';
import { withProject } from '../../helpers/project.js';

export function registerAnalyticCompleted(parent: Command, container: Container): void {
  parent
    .command('completed')
    .description('Tasks completed within a rolling window')
    .option('-p, --project <project>', 'Project id or name')
    .requiredOption('--since <duration>', 'Window length, e.g. 24h, 7d, 2w')
    .action((opts: { project?: string; since: string }) => {
      const proj = withProject(container, opts.project);
      if (!proj.ok) return printError(proj.error);
      handleResult(container.analyticService.listCompleted({ since: opts.since }, proj.value));
    });
}
