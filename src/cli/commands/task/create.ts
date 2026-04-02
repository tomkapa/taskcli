import { Command } from 'commander';
import type { Container } from '../../container.js';
import { handleResult } from '../../output.js';

export function registerTaskCreate(parent: Command, container: Container): void {
  parent
    .command('create')
    .description('Create a new task')
    .requiredOption('-n, --name <name>', 'Task name')
    .option('-p, --project <project>', 'Project id or name')
    .option('-d, --description <description>', 'Task description')
    .option('-t, --type <type>', 'Task type: story, tech-debt, bug', 'story')
    .option('-s, --status <status>', 'Task status', 'backlog')
    .option('--priority <priority>', 'Priority 1-5 (1=critical)', '3')
    .option('--parent <parentId>', 'Parent task id for subtask')
    .option('--technical-notes <notes>', 'Technical notes (markdown)')
    .option('--additional-requirements <requirements>', 'Additional requirements (markdown)')
    .action(
      (opts: {
        name: string;
        project?: string;
        description?: string;
        type?: string;
        status?: string;
        priority?: string;
        parent?: string;
        technicalNotes?: string;
        additionalRequirements?: string;
      }) => {
        const result = container.taskService.createTask(
          {
            name: opts.name,
            description: opts.description,
            type: opts.type,
            status: opts.status,
            priority: opts.priority ? parseInt(opts.priority, 10) : undefined,
            parentId: opts.parent,
            technicalNotes: opts.technicalNotes,
            additionalRequirements: opts.additionalRequirements,
          },
          opts.project,
        );
        handleResult(result);
      },
    );
}
