import { describe, it, expect } from 'vitest';
import { GitRemote } from '../../src/types/git-remote.js';

describe('GitRemote', () => {
  describe('parse / normalization', () => {
    it('normalizes SSH URL to host/owner/repo', () => {
      expect(GitRemote.parse('git@github.com:org/repo.git').value).toBe('github.com/org/repo');
    });

    it('normalizes SSH URL without .git suffix', () => {
      expect(GitRemote.parse('git@github.com:org/repo').value).toBe('github.com/org/repo');
    });

    it('normalizes HTTPS URL with .git suffix', () => {
      expect(GitRemote.parse('https://github.com/org/repo.git').value).toBe('github.com/org/repo');
    });

    it('normalizes HTTPS URL without .git suffix', () => {
      expect(GitRemote.parse('https://github.com/org/repo').value).toBe('github.com/org/repo');
    });

    it('SSH and HTTPS variants of the same repo produce equal values', () => {
      const ssh = GitRemote.parse('git@github.com:org/repo.git');
      const https = GitRemote.parse('https://github.com/org/repo.git');
      const httpsNoGit = GitRemote.parse('https://github.com/org/repo');
      expect(ssh.value).toBe(https.value);
      expect(ssh.value).toBe(httpsNoGit.value);
    });

    it('is case-insensitive', () => {
      expect(GitRemote.parse('git@GitHub.com:Org/Repo.git').value).toBe('github.com/org/repo');
      expect(GitRemote.parse('https://GitHub.com/Org/Repo.git').value).toBe('github.com/org/repo');
    });

    it('handles non-GitHub SSH remotes', () => {
      expect(GitRemote.parse('git@gitlab.com:group/project.git').value).toBe(
        'gitlab.com/group/project',
      );
    });

    it('returns lowercased input for unrecognized formats', () => {
      expect(GitRemote.parse('not-a-url').value).toBe('not-a-url');
    });

    it('trims leading and trailing whitespace', () => {
      expect(GitRemote.parse('  git@github.com:org/repo.git  ').value).toBe('github.com/org/repo');
    });
  });

  describe('equals', () => {
    it('two GitRemotes for the same repo are equal', () => {
      const a = GitRemote.parse('git@github.com:org/repo.git');
      const b = GitRemote.parse('https://github.com/org/repo');
      expect(a.equals(b)).toBe(true);
    });

    it('two GitRemotes for different repos are not equal', () => {
      const a = GitRemote.parse('git@github.com:org/alpha.git');
      const b = GitRemote.parse('git@github.com:org/beta.git');
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('toString', () => {
    it('returns the normalized value', () => {
      const r = GitRemote.parse('git@github.com:org/repo.git');
      expect(r.toString()).toBe('github.com/org/repo');
      expect(`${r}`).toBe('github.com/org/repo');
    });
  });
});
