// @ts-check
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ReleaseError } from '../../src/release/errors.js';
import {
  githubRepo,
  notesPath,
  releaseNotes,
  retryCommand,
} from '../../src/release/github-release.js';
import { cleanup, createProject, git } from './helpers/project.js';

afterEach(cleanup);

/**
 * @param {string} url
 * @returns {string}
 */
function repoFor(url) {
  const { root } = createProject();
  git(root, 'config', 'remote.origin.url', url);
  return githubRepo('origin', root);
}

describe('githubRepo', () => {
  it.each([
    'https://github.com/acme/gas-lib.git',
    'https://github.com/acme/gas-lib',
    'git@github.com:acme/gas-lib.git',
    'git@github.com:acme/gas-lib',
    'ssh://git@github.com/acme/gas-lib.git',
    'ssh://git@github.com:22/acme/gas-lib.git',
    'https://user@github.com/acme/gas-lib.git',
    'https://x-access-token:TOKEN@github.com/acme/gas-lib',
  ])('parses %s', (url) => {
    expect(repoFor(url)).toBe('acme/gas-lib');
  });

  it.each([
    'https://gitlab.com/acme/gas-lib.git',
    'https://github.com.evil.example/acme/gas-lib.git',
    'git@example.com:acme/gas-lib.git',
    'https://github.com/ac;me/gas-lib.git',
    'git@github.com:acme/$(gas-lib)',
  ])('rejects %s', (url) => {
    expect(() => repoFor(url)).toThrow(ReleaseError);
    expect(() => repoFor(url)).toThrow(/is not a GitHub repository/);
  });

  describe('SSH host aliases', () => {
    const originalPath = process.env.PATH;
    /** @type {string} */
    let bin;

    afterEach(() => {
      process.env.PATH = originalPath;
      rmSync(bin, { recursive: true, force: true });
    });

    /** Puts an `ssh` stub on PATH that maps the host `gh-alias` to github.com. */
    function stubSsh() {
      bin = mkdtempSync(join(tmpdir(), 'fake-ssh-'));
      const ssh = join(bin, 'ssh');
      writeFileSync(
        ssh,
        '#!/bin/sh\n[ "$2" = gh-alias ] && echo "hostname github.com" || echo "hostname $2"\n',
      );
      chmodSync(ssh, 0o755);
      process.env.PATH = `${bin}${delimiter}${originalPath}`;
    }

    it.each(['gh-alias:acme/gas-lib.git', 'git@gh-alias:acme/gas-lib'])(
      'resolves %s through ssh -G',
      (url) => {
        stubSsh();
        expect(repoFor(url)).toBe('acme/gas-lib');
      },
    );

    it.each(['other-alias:acme/gas-lib.git', '-oFoo:acme/gas-lib'])(
      'rejects %s',
      (url) => {
        stubSsh();
        expect(() => repoFor(url)).toThrow(/is not a GitHub repository/);
      },
    );
  });
});

describe('releaseNotes', () => {
  const changelog = [
    '# Changelog',
    '',
    '## [Unreleased]',
    '',
    '- later',
    '',
    '---',
    '',
    '## [1.1.0] - 2026-02-01',
    '',
    '### Added',
    '',
    '- newer',
    '',
    '---',
    '',
    '## [v1.0.0] - 2026-01-01',
    '',
    '### Added',
    '',
    '- first',
    '',
    '---',
    '',
  ].join('\n');

  it('extracts the section among several, without heading or trailing rule', () => {
    const { root } = createProject({ files: { 'CHANGELOG.md': changelog } });
    expect(releaseNotes(root, '1.1.0')).toBe('### Added\n\n- newer');
  });

  it('accepts the [vX.Y.Z] heading form', () => {
    const { root } = createProject({ files: { 'CHANGELOG.md': changelog } });
    expect(releaseNotes(root, '1.0.0')).toBe('### Added\n\n- first');
  });

  it('drops trailing link definitions from the last section', () => {
    const { root } = createProject({
      files: {
        'CHANGELOG.md': `${changelog}\n[1.0.0]: https://example.com/1.0.0\n[Unreleased]: https://example.com/u\n`,
      },
    });
    expect(releaseNotes(root, '1.0.0')).toBe('### Added\n\n- first');
  });

  it('falls back to the tag annotation when the section is missing', () => {
    const { root } = createProject({ files: { 'CHANGELOG.md': changelog } });
    git(root, 'tag', '-a', 'v2.0.0', '-m', 'Annotated notes');
    expect(releaseNotes(root, '2.0.0')).toBe('Annotated notes');
  });

  it('falls back to the tag name without a section or annotation', () => {
    const { root } = createProject();
    expect(releaseNotes(root, '1.0.0')).toBe('v1.0.0');
  });
});

describe('retry helpers', () => {
  it('builds the notes path and retry command', () => {
    expect(notesPath('v1.0.0')).toBe('.worktrees/github-release-v1.0.0.md');
    expect(retryCommand('acme/gas-lib', 'v1.0.0')).toBe(
      'gh release create v1.0.0 -R acme/gas-lib --verify-tag --title v1.0.0 --notes-file .worktrees/github-release-v1.0.0.md',
    );
  });
});
