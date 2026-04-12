/**
 * Value object representing a normalized git remote URL.
 * Accepts any common format (SSH or HTTPS, with or without .git suffix)
 * and stores the canonical `host/owner/repo` form.
 */
export class GitRemote {
  readonly value: string;

  private constructor(normalized: string) {
    this.value = normalized;
  }

  static parse(raw: string): GitRemote {
    return new GitRemote(GitRemote.normalize(raw));
  }

  private static normalize(url: string): string {
    const trimmed = url.trim();

    // SSH format: git@github.com:owner/repo.git or git@github.com:owner/repo
    const sshMatch = trimmed.match(/^git@([^:]+):(.+?)(?:\.git)?$/);
    if (sshMatch) {
      const [, host, path] = sshMatch;
      return `${host}/${path}`.toLowerCase();
    }

    // HTTPS/HTTP format: https://github.com/owner/repo.git or without .git
    try {
      const parsed = new URL(trimmed);
      const path = parsed.pathname.replace(/\.git$/, '').replace(/^\//, '');
      return `${parsed.host}/${path}`.toLowerCase();
    } catch {
      return trimmed.toLowerCase();
    }
  }

  equals(other: GitRemote): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
