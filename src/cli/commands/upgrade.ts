import { Command } from 'commander';
import type { Container } from '../container.js';
import { printSuccess, printError } from '../output.js';
import { APP_VERSION } from '../../version.js';
import { presentUpdateServiceError } from '../../service/errors.js';

export function registerUpgrade(program: Command, container: Container): void {
  program
    .command('upgrade')
    .description('Check for updates and upgrade to the latest version')
    .action(async () => {
      const checkResult = await container.updateService.checkForUpdate(APP_VERSION);
      if (!checkResult.ok) {
        printError(presentUpdateServiceError(checkResult.error));
        return;
      }

      if (!checkResult.value.updateAvailable) {
        printSuccess({
          message: 'Already up to date',
          currentVersion: checkResult.value.currentVersion,
        });
        return;
      }

      process.stderr.write(
        `Upgrading from ${checkResult.value.currentVersion} to ${checkResult.value.latestVersion}...\n`,
      );

      const upgradeResult = container.updateService.performUpgrade(APP_VERSION);
      if (!upgradeResult.ok) {
        printError(presentUpdateServiceError(upgradeResult.error));
        return;
      }

      printSuccess({
        message: 'Upgrade complete',
        previousVersion: checkResult.value.currentVersion,
        installedVersion: upgradeResult.value.installedVersion,
      });
    });
}
