import type { Result } from '../../types/common.js';
import type { Project } from '../../types/project.js';
import type { ProjectServiceError } from '../../service/errors.js';
import type { Container } from '../container.js';

export function withProject(
  container: Container,
  projectIdOrName?: string,
): Result<Project, ProjectServiceError> {
  return container.projectService.resolveProject(projectIdOrName);
}
