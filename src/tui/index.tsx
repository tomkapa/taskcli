import { render } from 'ink';
import type { Container } from '../cli/container.js';
import { App } from './components/App.js';

export async function launchTUI(
  container: Container,
  initialProject?: string,
  latestVersion?: string,
): Promise<void> {
  const instance = render(
    <App container={container} initialProject={initialProject} latestVersion={latestVersion} />,
    {
      exitOnCtrlC: true,
    },
  );

  await instance.waitUntilExit();
}
