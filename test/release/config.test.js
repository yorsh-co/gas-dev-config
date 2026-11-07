// @ts-check
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, createProject, git, runRelease } from './helpers/project.js';

afterEach(cleanup);

describe('strict config validation', () => {
  it.each([
    [
      { remtoe: 'origin' },
      'gasDevConfig.release.remtoe is not a known option.',
    ],
    [
      { targets: [{ branch: 'a' }, { branch: 'b', pakageJson: false }] },
      'gasDevConfig.release.targets[1].pakageJson is not a known option.',
    ],
    [
      {
        targets: [
          { branch: 'a', include: [{ from: 'dist', to: 'x', hids: [] }] },
        ],
      },
      'gasDevConfig.release.targets[0].include[0].hids is not a known option.',
    ],
    [
      { targets: [] },
      'gasDevConfig.release.targets must be a non-empty array.',
    ],
    [
      { githubRelease: 'yes' },
      'gasDevConfig.release.githubRelease must be a boolean.',
    ],
    [
      { githubRelese: true },
      'gasDevConfig.release.githubRelese is not a known option.',
    ],
  ])('rejects %j', (config, message) => {
    const { root, origin } = createProject({ config });

    const result = runRelease(root);

    expect(result.status).toBe(1);
    expect(result.stderr).toBe(`gas-dev-config: ${message}\n`);
    expect(git(origin, 'branch', '--list')).not.toContain('dist');
  });
});
