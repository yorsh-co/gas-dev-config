import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
);

describe('package', () => {
  it('is the gas-dev-config ESM package', () => {
    expect(pkg.name).toBe('gas-dev-config');
    expect(pkg.type).toBe('module');
  });

  it('exports exactly the documented ci API', async () => {
    const entry = await import('gas-dev-config/ci');
    expect(Object.keys(entry).sort()).toEqual(['DeployError']);
  });

  it('exports exactly the documented bundle API', async () => {
    const entry = await import('gas-dev-config/bundle');
    expect(Object.keys(entry).sort()).toEqual([
      'BundleError',
      'bundle',
      'loadConfig',
    ]);
  });

  it('packs src but nothing from test, docs or .github', () => {
    const out = execFileSync('npm', ['pack', '--dry-run', '--json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const paths = JSON.parse(out)[0].files.map(
      (/** @type {{ path: string }} */ f) => f.path,
    );
    expect(paths).toContain('src/ci/index.js');
    expect(paths).toContain('src/bundle/index.js');
    expect(paths).toContain('src/ci/types.d.ts');
    for (const p of paths) expect(p).not.toMatch(/^(test|docs|\.github)\//);
  });
});
