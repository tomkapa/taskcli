import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { UpdateServiceImpl, isNewerVersion } from '../../src/service/update.service.js';
import type { FetchFn, ExecFn } from '../../src/service/update.service.js';

describe('isNewerVersion', () => {
  it('returns true when a is newer major', () => {
    expect(isNewerVersion('2.0.0', '1.0.0')).toBe(true);
  });

  it('returns true when a is newer minor', () => {
    expect(isNewerVersion('1.2.0', '1.1.0')).toBe(true);
  });

  it('returns true when a is newer patch', () => {
    expect(isNewerVersion('1.0.2', '1.0.1')).toBe(true);
  });

  it('returns false when versions are equal', () => {
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
  });

  it('returns false when a is older', () => {
    expect(isNewerVersion('1.0.0', '2.0.0')).toBe(false);
  });

  it('handles v prefix', () => {
    expect(isNewerVersion('v2.0.0', 'v1.0.0')).toBe(true);
  });

  it('handles mixed v prefix', () => {
    expect(isNewerVersion('v2.0.0', '1.0.0')).toBe(true);
  });
});

describe('UpdateServiceImpl.checkForUpdate', () => {
  let testDir: string;
  let cachePath: string;

  function mockFetch(version: string): FetchFn {
    return vi.fn<FetchFn>().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version }),
    } as Response);
  }

  function failFetch(message: string): FetchFn {
    return vi.fn<FetchFn>().mockRejectedValue(new Error(message));
  }

  beforeEach(() => {
    testDir = join(tmpdir(), `tayto-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    cachePath = join(testDir, 'update-check.json');
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('fetches latest version from registry when no cache exists', async () => {
    const fetch = mockFetch('2.0.0');
    const service = new UpdateServiceImpl(cachePath, fetch);
    const result = await service.checkForUpdate('1.0.0');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.currentVersion).toBe('1.0.0');
    expect(result.value.latestVersion).toBe('2.0.0');
    expect(result.value.updateAvailable).toBe(true);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('returns cached result when cache is fresh', async () => {
    const cache = { checkedAt: Date.now(), latestVersion: '2.0.0' };
    writeFileSync(cachePath, JSON.stringify(cache), 'utf-8');

    const fetch = mockFetch('3.0.0');
    const service = new UpdateServiceImpl(cachePath, fetch);
    const result = await service.checkForUpdate('1.0.0');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.latestVersion).toBe('2.0.0');
    expect(result.value.updateAvailable).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('fetches when cache is stale (older than 24h)', async () => {
    const staleTimestamp = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
    const cache = { checkedAt: staleTimestamp, latestVersion: '1.5.0' };
    writeFileSync(cachePath, JSON.stringify(cache), 'utf-8');

    const fetch = mockFetch('2.0.0');
    const service = new UpdateServiceImpl(cachePath, fetch);
    const result = await service.checkForUpdate('1.0.0');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.latestVersion).toBe('2.0.0');
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('reports no update when already on latest', async () => {
    const fetch = mockFetch('1.0.0');
    const service = new UpdateServiceImpl(cachePath, fetch);
    const result = await service.checkForUpdate('1.0.0');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.updateAvailable).toBe(false);
  });

  it('returns err on fetch failure', async () => {
    const fetch = failFetch('network error');
    const service = new UpdateServiceImpl(cachePath, fetch);
    const result = await service.checkForUpdate('1.0.0');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UPGRADE_CHECK');
    expect(result.error.message).toContain('network error');
  });

  it('returns err on non-OK HTTP response', async () => {
    const fetch = vi.fn<FetchFn>().mockResolvedValue({
      ok: false,
      status: 404,
    } as Response);
    const service = new UpdateServiceImpl(cachePath, fetch);
    const result = await service.checkForUpdate('1.0.0');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UPGRADE_CHECK');
    expect(result.error.message).toContain('404');
  });

  it('returns err on unexpected response format', async () => {
    const fetch = vi.fn<FetchFn>().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ name: '@tomkapa/tayto' }),
    } as Response);
    const service = new UpdateServiceImpl(cachePath, fetch);
    const result = await service.checkForUpdate('1.0.0');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UPGRADE_CHECK');
    expect(result.error.message).toContain('Unexpected response');
  });

  it('handles corrupt cache file gracefully', async () => {
    writeFileSync(cachePath, 'not valid json!!!', 'utf-8');

    const fetch = mockFetch('2.0.0');
    const service = new UpdateServiceImpl(cachePath, fetch);
    const result = await service.checkForUpdate('1.0.0');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.latestVersion).toBe('2.0.0');
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('handles cache with missing fields gracefully', async () => {
    writeFileSync(cachePath, JSON.stringify({ checkedAt: Date.now() }), 'utf-8');

    const fetch = mockFetch('2.0.0');
    const service = new UpdateServiceImpl(cachePath, fetch);
    const result = await service.checkForUpdate('1.0.0');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.latestVersion).toBe('2.0.0');
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('writes cache after successful fetch', async () => {
    const fetch = mockFetch('2.0.0');
    const service = new UpdateServiceImpl(cachePath, fetch);
    await service.checkForUpdate('1.0.0');

    // Second call should use cache
    const fetch2 = mockFetch('3.0.0');
    const service2 = new UpdateServiceImpl(cachePath, fetch2);
    const result = await service2.checkForUpdate('1.0.0');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.latestVersion).toBe('2.0.0');
    expect(fetch2).not.toHaveBeenCalled();
  });
});

describe('UpdateServiceImpl.performUpgrade', () => {
  let testDir: string;
  let cachePath: string;

  function mockFetch(version: string): FetchFn {
    return vi.fn<FetchFn>().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version }),
    } as Response);
  }

  beforeEach(() => {
    testDir = join(tmpdir(), `tayto-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(testDir, { recursive: true });
    cachePath = join(testDir, 'update-check.json');
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('calls npm install and returns ok on success', () => {
    const exec = vi.fn<ExecFn>();
    const cache = { checkedAt: Date.now(), latestVersion: '2.0.0' };
    writeFileSync(cachePath, JSON.stringify(cache), 'utf-8');

    const service = new UpdateServiceImpl(cachePath, mockFetch('2.0.0'), exec);
    const result = service.performUpgrade('1.0.0');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.installedVersion).toBe('2.0.0');
    expect(exec).toHaveBeenCalledWith('npm', ['install', '-g', '@tomkapa/tayto@latest']);
  });

  it('returns err when npm command fails', () => {
    const exec = vi.fn<ExecFn>().mockImplementation(() => {
      throw new Error('npm not found');
    });

    const service = new UpdateServiceImpl(cachePath, mockFetch('2.0.0'), exec);
    const result = service.performUpgrade('1.0.0');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('UPGRADE_CHECK');
    expect(result.error.message).toContain('npm not found');
  });

  it('invalidates cache after successful upgrade', async () => {
    const exec = vi.fn<ExecFn>();
    const cache = { checkedAt: Date.now(), latestVersion: '2.0.0' };
    writeFileSync(cachePath, JSON.stringify(cache), 'utf-8');

    const service = new UpdateServiceImpl(cachePath, mockFetch('2.0.0'), exec);
    service.performUpgrade('1.0.0');

    // The cache should be invalidated (checkedAt = 0), so a new check must re-fetch
    const fetch2 = vi.fn<FetchFn>().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ version: '2.0.0' }),
    } as Response);
    const service2 = new UpdateServiceImpl(cachePath, fetch2, exec);

    await service2.checkForUpdate('1.0.0');
    expect(fetch2).toHaveBeenCalled();
  });
});
