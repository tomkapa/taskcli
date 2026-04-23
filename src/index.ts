import { loadConfig } from './config/index.js';
import { createDatabase } from './db/connection.js';
import { runMigrations } from './db/migrator.js';
import { initTelemetry, shutdownTelemetry } from './logging/telemetry.js';
import { logger } from './logging/logger.js';
import { createContainer } from './cli/container.js';
import type { Container } from './cli/container.js';
import { createSqliteRepositorySet } from './repository/index.js';
import { buildCLI } from './cli/index.js';
import { APP_VERSION } from './version.js';
import type { UpdateCheckResult } from './service/update.service.js';
import { maybeSendHeartbeat } from './telemetry/heartbeat.js';

async function checkForUpdateQuietly(
  container: Container,
  currentVersion: string,
): Promise<UpdateCheckResult | null> {
  let timerId: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      container.updateService.checkForUpdate(currentVersion),
      new Promise<null>((resolve) => {
        timerId = setTimeout(() => {
          resolve(null);
        }, 2000);
      }),
    ]);
    clearTimeout(timerId);
    if (result !== null && result.ok) {
      return result.value;
    }
    return null;
  } catch {
    clearTimeout(timerId);
    return null;
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  logger.init(config.logDir);
  initTelemetry(config);

  maybeSendHeartbeat({ statePath: config.telemetryStatePath, version: APP_VERSION });

  const db = createDatabase(config.dbPath);
  runMigrations(db);

  const repos = createSqliteRepositorySet(db);
  const container = createContainer(repos, {
    dbPath: config.dbPath,
    updateCachePath: config.updateCachePath,
    dismissedGitRemotesPath: config.dismissedGitRemotesPath,
  });

  const args = process.argv.slice(2);
  const isUpgradeCommand = args[0] === 'upgrade';

  let updateCheck: UpdateCheckResult | null = null;
  if (!config.noUpdateCheck && !isUpgradeCommand) {
    updateCheck = await checkForUpdateQuietly(container, APP_VERSION);
  }

  if (args.length === 0) {
    const { launchTUI } = await import('./tui/index.js');
    await launchTUI(
      container,
      undefined,
      updateCheck?.updateAvailable ? updateCheck.latestVersion : undefined,
    );
  } else {
    if (updateCheck?.updateAvailable) {
      process.stderr.write(
        `\x1b[33m[tayto]\x1b[0m Update available: ${updateCheck.currentVersion} → ${updateCheck.latestVersion}. Run: tayto upgrade\n`,
      );
    }
    const program = buildCLI(container);
    await program.parseAsync(process.argv);
  }

  db.close();
  await shutdownTelemetry();
}

main().catch((e: unknown) => {
  // Top-level crash handler: assertion failures and unexpected rejections
  // land here. Present a best-effort `{code, message}` and exit non-zero.
  const message = e instanceof Error ? e.message : 'Unknown error';
  process.stderr.write(
    JSON.stringify({ ok: false, error: { code: 'UNKNOWN', message } }, null, 2) + '\n',
  );
  process.exit(1);
});
