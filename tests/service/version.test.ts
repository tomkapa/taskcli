import { describe, it, expect } from 'vitest';
import { APP_VERSION } from '../../src/version.js';

describe('APP_VERSION', () => {
  it('is a string', () => {
    expect(typeof APP_VERSION).toBe('string');
  });

  it('falls back to dev version when not injected by tsup', () => {
    // In test environment, tsup define is not active, so we get the fallback
    expect(APP_VERSION).toBe('0.0.0-dev');
  });
});
