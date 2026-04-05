import { useEffect, useRef } from 'react';
import { watchFile, unwatchFile } from 'node:fs';
import { logger } from '../logging/logger.js';

const POLL_INTERVAL_MS = 1000;
const DEBOUNCE_MS = 200;

/**
 * Watches the SQLite database file (and its WAL journal) for external
 * modifications.  When a change is detected the supplied `onRefetch`
 * callback fires – debounced so rapid successive writes only trigger a
 * single refetch.
 *
 * Uses `fs.watchFile` (stat-polling) rather than `fs.watch` because the
 * latter is unreliable for SQLite WAL-mode databases on some platforms.
 */
export function useAutoRefetch(dbPath: string, onRefetch: () => void): void {
  // Keep a stable reference to the latest callback so the watcher
  // closure never goes stale while avoiding re-subscribing on every
  // render.
  const callbackRef = useRef(onRefetch);
  callbackRef.current = onRefetch;

  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const handleChange = (): void => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        logger.info('useAutoRefetch: external db change detected, refetching');
        callbackRef.current();
      }, DEBOUNCE_MS);
    };

    const walPath = `${dbPath}-wal`;

    // `watchFile` emits (curr, prev) stat objects; fire when mtime changes.
    const listener = (curr: { mtimeMs: number }, prev: { mtimeMs: number }): void => {
      if (curr.mtimeMs !== prev.mtimeMs) {
        handleChange();
      }
    };

    watchFile(dbPath, { interval: POLL_INTERVAL_MS }, listener);
    watchFile(walPath, { interval: POLL_INTERVAL_MS }, listener);

    logger.info(`useAutoRefetch: watching ${dbPath} (poll ${POLL_INTERVAL_MS}ms)`);

    return () => {
      unwatchFile(dbPath, listener);
      unwatchFile(walPath, listener);
      if (debounceTimer) clearTimeout(debounceTimer);
      logger.info('useAutoRefetch: stopped watching');
    };
  }, [dbPath]);
}
