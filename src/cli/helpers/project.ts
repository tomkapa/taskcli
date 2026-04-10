import type { Result } from '../../types/common.js';
import type { Project } from '../../types/project.js';
import type { Container } from '../container.js';

export function withProject(container: Container, projectIdOrName?: string): Result<Project> {
  return container.projectService.resolveProject(projectIdOrName);
}
