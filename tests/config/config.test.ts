import { describe, it, expect, afterEach, vi } from 'vitest';
import { loadConfig } from '../../src/config/index.js';

describe('loadConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('includes updateCachePath derived from data dir', () => {
    const config = loadConfig();
    expect(config.updateCachePath).toContain('update-check.json');
  });

  it('noUpdateCheck defaults to false', () => {
    const config = loadConfig();
    expect(config.noUpdateCheck).toBe(false);
  });

  it('noUpdateCheck is true when TAYTO_NO_UPDATE_CHECK=1', () => {
    vi.stubEnv('TAYTO_NO_UPDATE_CHECK', '1');
    const config = loadConfig();
    expect(config.noUpdateCheck).toBe(true);
  });

  it('noUpdateCheck is false for other values of TAYTO_NO_UPDATE_CHECK', () => {
    vi.stubEnv('TAYTO_NO_UPDATE_CHECK', 'true');
    const config = loadConfig();
    expect(config.noUpdateCheck).toBe(false);
  });
});
