import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { openInEditor } from '../../src/tui/editor.js';
import * as childProcess from 'node:child_process';

vi.mock('node:child_process', () => ({
  spawnSync: vi.fn(),
}));

describe('openInEditor', () => {
  const spawnSyncMock = vi.mocked(childProcess.spawnSync);

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns edited content when editor exits successfully', () => {
    // Mock the editor: read the temp file, modify it, exit 0
    spawnSyncMock.mockImplementation((_cmd, args) => {
      const filepath = (args as string[])[0];
      if (filepath) {
        // Simulate editor writing new content
        const fs = require('node:fs') as typeof import('node:fs');
        fs.writeFileSync(filepath, 'edited content');
      }
      return { status: 0 } as ReturnType<typeof childProcess.spawnSync>;
    });

    const result = openInEditor('original content', 'test.md');
    expect(result).toBe('edited content');
  });

  it('returns null when editor exits with non-zero', () => {
    spawnSyncMock.mockReturnValue({
      status: 1,
    } as ReturnType<typeof childProcess.spawnSync>);

    const result = openInEditor('content', 'test.md');
    expect(result).toBeNull();
  });

  it('passes content to temp file', () => {
    let writtenContent = '';
    spawnSyncMock.mockImplementation((_cmd, args) => {
      const filepath = (args as string[])[0];
      if (filepath) {
        const fs = require('node:fs') as typeof import('node:fs');
        writtenContent = fs.readFileSync(filepath, 'utf-8');
      }
      return { status: 0 } as ReturnType<typeof childProcess.spawnSync>;
    });

    openInEditor('my markdown content', 'test.md');
    expect(writtenContent).toBe('my markdown content');
  });

  it('uses $EDITOR env variable', () => {
    const origEditor = process.env['EDITOR'];
    process.env['EDITOR'] = 'nano';

    spawnSyncMock.mockReturnValue({
      status: 0,
    } as ReturnType<typeof childProcess.spawnSync>);

    openInEditor('content', 'test.md');
    expect(spawnSyncMock).toHaveBeenCalledWith('nano', expect.any(Array), expect.any(Object));

    if (origEditor !== undefined) {
      process.env['EDITOR'] = origEditor;
    } else {
      delete process.env['EDITOR'];
    }
  });
});
