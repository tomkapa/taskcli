import { describe, it, expect } from 'vitest';
import { parseDuration } from '../../src/utils/duration.js';

describe('parseDuration', () => {
  describe('valid inputs', () => {
    it('parses minutes', () => {
      const r = parseDuration('30m');
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value).toBe(30 * 60 * 1000);
    });

    it('parses hours', () => {
      const r = parseDuration('24h');
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value).toBe(24 * 60 * 60 * 1000);
    });

    it('parses days', () => {
      const r = parseDuration('7d');
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value).toBe(7 * 24 * 60 * 60 * 1000);
    });

    it('parses weeks', () => {
      const r = parseDuration('2w');
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value).toBe(2 * 7 * 24 * 60 * 60 * 1000);
    });

    it('parses single day', () => {
      const r = parseDuration('1d');
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value).toBe(24 * 60 * 60 * 1000);
    });

    it('parses 365 days (max allowed)', () => {
      const r = parseDuration('365d');
      expect(r.ok).toBe(true);
    });
  });

  describe('invalid inputs', () => {
    it('rejects empty string', () => {
      const r = parseDuration('');
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.kind).toBe('validation');
    });

    it('rejects missing unit (bare number)', () => {
      const r = parseDuration('5');
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.kind).toBe('validation');
    });

    it('rejects unsupported unit x', () => {
      const r = parseDuration('5x');
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.kind).toBe('validation');
    });

    it('rejects unsupported unit y', () => {
      const r = parseDuration('5y');
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.kind).toBe('validation');
    });

    it('rejects zero value', () => {
      const r = parseDuration('0d');
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.kind).toBe('validation');
    });

    it('rejects negative value', () => {
      const r = parseDuration('-1d');
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.kind).toBe('validation');
    });

    it('rejects decimal value', () => {
      const r = parseDuration('1.5d');
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.kind).toBe('validation');
    });

    it('rejects value exceeding 365 days', () => {
      const r = parseDuration('500d');
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.kind).toBe('validation');
      expect(r.error.message).toContain('500d');
    });

    it('rejects 366 days', () => {
      const r = parseDuration('366d');
      expect(r.ok).toBe(false);
    });

    it('echoes the offending input in error message', () => {
      const r = parseDuration('999d');
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.error.message).toContain('999d');
    });
  });
});
