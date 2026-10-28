import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { REPO_ROOT } from './support.js';

const BIN = join(REPO_ROOT, 'bin', 'gas-dev-config.js');
const TEMPLATES = join(REPO_ROOT, 'templates');

/** @type {string[]} */
const dirs = [];

afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

/**
 * Creates a project that matches a preset's templates exactly.
 *
 * @param {'gas' | 'node'} preset
 * @param {Record<string, unknown>} [pkgExtra] Extra package.json fields.
 * @returns {string} Project directory.
 */
function createCleanProject(preset, pkgExtra = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'gas-dev-config-check-'));
  dirs.push(dir);
  const read = (/** @type {string} */ f) =>
    readFileSync(join(TEMPLATES, preset, f), 'utf8');
  writeFileSync(join(dir, '.gitignore'), read('gitignore'));
  writeFileSync(join(dir, '.prettierignore'), read('prettierignore'));
  mkdirSync(join(dir, '.github'));
  writeFileSync(
    join(dir, '.github', 'dependabot.yml'),
    read('.github/dependabot.yml'),
  );
  const { required, present } = JSON.parse(read('scripts.json'));
  const scripts = { ...required };
  for (const name of present) scripts[name] = 'true';
  writePackage(dir, { name: 'consumer', scripts, ...pkgExtra });
  return dir;
}

/**
 * @param {string} dir
 * @param {Record<string, unknown>} pkg
 */
function writePackage(dir, pkg) {
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg, null, 2));
}

/**
 * @param {string} dir
 * @returns {Record<string, any>}
 */
function readPackage(dir) {
  return JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
}

/**
 * @param {string} cwd
 * @param {string[]} args
 */
function run(cwd, args) {
  const result = spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    encoding: 'utf8',
  });
  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

describe.each(['gas', 'node'])('check (%s preset)', (preset) => {
  const make = () =>
    createCleanProject(
      /** @type {'gas' | 'node'} */ (preset),
      preset === 'node' ? { gasDevConfig: { preset: 'node' } } : {},
    );

  it('passes on a project matching the templates', () => {
    const result = run(make(), ['check']);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('✓ Config check passed\n');
  });

  it('allows extra ignore lines', () => {
    const dir = make();
    writeFileSync(
      join(dir, '.prettierignore'),
      `# header\n\ndist/**/*.md\n${readFileSync(join(dir, '.prettierignore'), 'utf8')}`,
    );
    expect(run(dir, ['check']).status).toBe(0);
  });

  it('reports a missing .gitignore line', () => {
    const dir = make();
    const file = join(dir, '.gitignore');
    writeFileSync(
      file,
      readFileSync(file, 'utf8').replace('.worktrees/\n', ''),
    );
    const result = run(dir, ['check']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('.gitignore\n  missing line: .worktrees/');
    expect(result.stderr).toContain('1 issue(s) in 1 file(s)');
  });

  it('reports a missing .prettierignore file', () => {
    const dir = make();
    rmSync(join(dir, '.prettierignore'));
    const result = run(dir, ['check']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('.prettierignore\n  file is missing');
  });

  it('reports a different dependabot.yml', () => {
    const dir = make();
    writeFileSync(join(dir, '.github', 'dependabot.yml'), 'version: 2\n');
    const result = run(dir, ['check']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('.github/dependabot.yml\n  differs from');
  });

  it('ignores trailing whitespace differences in dependabot.yml', () => {
    const dir = make();
    const file = join(dir, '.github', 'dependabot.yml');
    writeFileSync(file, `${readFileSync(file, 'utf8').trimEnd()}  \n\n`);
    expect(run(dir, ['check']).status).toBe(0);
  });

  it('reports a wrong check script with expected and found values', () => {
    const dir = make();
    const pkg = readPackage(dir);
    pkg.scripts.check = 'npm run test';
    writePackage(dir, pkg);
    const result = run(dir, ['check']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('scripts.check differs; expected: npm run');
    expect(result.stderr).toContain('gas-dev-config check');
    expect(result.stderr).toContain('found: "npm run test"');
  });

  it('reports a missing required script', () => {
    const dir = make();
    const pkg = readPackage(dir);
    delete pkg.scripts.lint;
    writePackage(dir, pkg);
    const result = run(dir, ['check']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'scripts.lint is missing; expected: eslint',
    );
  });
});

describe('check (preset specifics)', () => {
  it('reports a missing typecheck script on the gas preset', () => {
    const dir = createCleanProject('gas');
    const pkg = readPackage(dir);
    delete pkg.scripts.typecheck;
    writePackage(dir, pkg);
    const result = run(dir, ['check']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('scripts.typecheck is missing\n');
  });

  it('reports a missing typecheck script on the node preset', () => {
    const dir = createCleanProject('node', {
      gasDevConfig: { preset: 'node' },
    });
    const pkg = readPackage(dir);
    delete pkg.scripts.typecheck;
    writePackage(dir, pkg);
    const result = run(dir, ['check']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'scripts.typecheck is missing; expected: tsc',
    );
  });

  it('defaults to the gas preset', () => {
    const dir = createCleanProject('gas');
    expect(readPackage(dir).gasDevConfig).toBeUndefined();
    expect(run(dir, ['check']).status).toBe(0);
  });

  it('accepts the local bin in this package itself', () => {
    const dir = createCleanProject('node', {
      gasDevConfig: { preset: 'node' },
    });
    const pkg = readPackage(dir);
    pkg.name = 'gas-dev-config';
    pkg.scripts.check = pkg.scripts.check.replace(
      'gas-dev-config check',
      'node bin/gas-dev-config.js check',
    );
    writePackage(dir, pkg);
    expect(run(dir, ['check']).status).toBe(0);
  });

  it('fails on an unknown preset', () => {
    const dir = createCleanProject('gas', { gasDevConfig: { preset: 'web' } });
    const result = run(dir, ['check']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('unknown preset "web"');
  });

  it('fails on an unknown gasDevConfig key', () => {
    const dir = createCleanProject('gas', { gasDevConfig: { presets: 'gas' } });
    const result = run(dir, ['check']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('unknown "gasDevConfig" key(s): presets');
    expect(result.stderr).toContain('(expected: preset, loadOrder, peers)');
  });

  it('fails when package.json is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gas-dev-config-check-'));
    dirs.push(dir);
    const result = run(dir, ['check']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('package.json not found');
  });
});

describe('check (loadOrder and peers)', () => {
  /**
   * @param {Record<string, unknown>} gasDevConfig
   * @param {'gas' | 'node'} [preset]
   * @param {string[]} [srcFiles] Files created under src/.
   */
  function make(gasDevConfig, preset = 'gas', srcFiles = ['a.ts', 'lib/b.ts']) {
    const dir = createCleanProject(preset, { gasDevConfig });
    for (const file of srcFiles) {
      mkdirSync(dirname(join(dir, 'src', file)), { recursive: true });
      writeFileSync(join(dir, 'src', file), '');
    }
    return dir;
  }

  it('passes with a valid loadOrder and peers', () => {
    const dir = make({
      loadOrder: ['a.ts', 'lib/b.ts'],
      peers: { 'gas-logger': '^1.2.0', 'gas.sheet_db': '>=1 <3' },
    });
    const result = run(dir, ['check']);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('✓ Config check passed\n');
  });

  it('reports a listed file that does not exist as drift', () => {
    const dir = make({ loadOrder: ['a.ts', 'missing.ts'] });
    const result = run(dir, ['check']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'package.json\n  gasDevConfig.loadOrder: src/missing.ts does not exist',
    );
    expect(result.stderr).toContain('1 issue(s) in 1 file(s)');
  });

  it.each([
    ['a non-array', 'a.ts', 'must be a non-empty array'],
    ['an empty array', [], 'must be a non-empty array'],
    ['a duplicate', ['a.ts', 'a.ts'], 'lists "a.ts" twice'],
    ['a declaration file', ['a.d.ts'], 'entry "a.d.ts" must be a .ts file'],
    ['a non-ts file', ['a.js'], 'entry "a.js" must be a .ts file'],
    ['an absolute path', ['/etc/a.ts'], 'entry "/etc/a.ts" must be relative'],
    ['a drive path', ['C:/a.ts'], 'entry "C:/a.ts" must be relative'],
    ['a backslash', ['lib\\b.ts'], 'entry "lib\\\\b.ts" must use "/"'],
    ['a parent segment', ['../a.ts'], 'entry "../a.ts" must not contain'],
    ['a dot segment', ['./a.ts'], 'entry "./a.ts" must not contain'],
    ['a non-string', ['a.ts', 1], 'entry 1 must be a non-empty string'],
    ['an empty string', [''], 'entry "" must be a non-empty string'],
  ])('rejects loadOrder with %s', (_name, loadOrder, message) => {
    const result = run(make({ loadOrder }), ['check']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('package.json: "gasDevConfig.loadOrder"');
    expect(result.stderr).toContain(message);
  });

  it.each([
    ['a non-object', ['gas-logger'], 'must be an object'],
    ['an uppercase name', { Gas: '1' }, 'invalid package name "Gas"'],
    ['a name with a slash', { 'a/b': '1' }, 'invalid package name "a/b"'],
    [
      'an empty range',
      { 'gas-logger': '' },
      '["gas-logger"] must be a non-empty',
    ],
    [
      'a non-string range',
      { 'gas-logger': 1 },
      '["gas-logger"] must be a non-empty',
    ],
  ])('rejects peers with %s', (_name, peers, message) => {
    const result = run(make({ peers }), ['check']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('package.json: "gasDevConfig.peers"');
    expect(result.stderr).toContain(message);
  });

  it.each([
    ['loadOrder', ['a.ts']],
    ['peers', { 'gas-logger': '^1.0.0' }],
  ])('rejects %s with the node preset', (key, value) => {
    const dir = make({ preset: 'node', [key]: value }, 'node');
    const result = run(dir, ['check']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      `package.json: "gasDevConfig.${key}" requires the gas preset`,
    );
  });
});

describe('CLI usage', () => {
  it('exits 2 without a command', () => {
    const result = run(REPO_ROOT, []);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('missing command');
  });

  it('exits 2 on an unknown command', () => {
    const result = run(REPO_ROOT, ['sync']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('unknown command: sync');
  });

  it('exits 2 on an unknown option', () => {
    const result = run(REPO_ROOT, ['check', '--fix']);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain('Run gas-dev-config --help');
  });

  it('prints help', () => {
    const result = run(REPO_ROOT, ['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage: gas-dev-config check');
  });

  it('prints the version', () => {
    const { version } = JSON.parse(
      readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'),
    );
    const result = run(REPO_ROOT, ['--version']);
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(`${version}\n`);
  });
});
