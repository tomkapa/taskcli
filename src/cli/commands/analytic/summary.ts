import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult, printError } from '../../output.js';
import { withProject } from '../../helpers/project.js';
import {
  presentAnalyticServiceError,
  presentProjectServiceError,
} from '../../../service/errors.js';

export function registerAnalyticSummary(parent: Command, container: Container): void {
  parent
    .command('summary')
    .description('Productivity summary over a rolling period')
    .option('-p, --project <project>', 'Project id or name')
    .requiredOption('--period <period>', 'Period: day | week')
    .action((opts: { project?: string; period: string }) => {
      const proj = withProject(container, opts.project);
      if (!proj.ok) return printError(presentProjectServiceError(proj.error));
      handleResult(
        container.analyticService.summary({ period: opts.period }, proj.value),
        presentAnalyticServiceError,
      );
    });
}
