import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { REPO_ROOT } from './support.js';

const BIN = join(REPO_ROOT, 'bin', 'gas-dev-config.js');
const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/script.storage',
];

/** Fake clasp: logs argv and project state, then prints canned output. */
const FAKE_CLASP = `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const entry = { args, cwd: process.cwd() };
if (args[0] === 'clone') {
  fs.writeFileSync('.clasp.json', '{}');
  fs.writeFileSync('Code.js', '');
  fs.writeFileSync('appsscript.json', '{}');
}
if (args[0] === 'push') {
  entry.files = fs.readdirSync('.').sort();
  entry.manifest = JSON.parse(fs.readFileSync('appsscript.json', 'utf8'));
  entry.head = fs.readFileSync('gas-test.js', 'utf8').split('\\n')[0];
}
fs.appendFileSync(process.env.FAKE_CLASP_LOG, JSON.stringify(entry) + '\\n');
if (args[0] === 'run') {
  process.stdout.write(process.env.FAKE_CLASP_STDOUT ?? '');
  process.stderr.write(process.env.FAKE_CLASP_STDERR ?? '');
  process.exit(Number(process.env.FAKE_CLASP_STATUS ?? 0));
}
`;

/** @type {string[]} */
const dirs = [];

afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

/** @returns {string} */
function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'gas-dev-config-cli-'));
  dirs.push(dir);
  return dir;
}

/**
 * @param {Record<string, unknown>} [gasDevConfig]
 * @returns {string} A project with a library file and a test.
 */
function createProject(gasDevConfig = {}) {
  const dir = tempDir();
  mkdirSync(join(dir, 'src'));
  mkdirSync(join(dir, 'gas-test'));
  writeFileSync(join(dir, 'src', 'lib.ts'), 'const LIB: number = 1;\n');
  writeFileSync(
    join(dir, 'gas-test', 'lib.test.ts'),
    "test('lib', () => assert(LIB === 1));\n",
  );
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      name: 'consumer',
      gasDevConfig: {
        loadOrder: ['lib.ts'],
        gasTest: { scopes: SCOPES, scriptId: 'config-script' },
        ...gasDevConfig,
      },
    }),
  );
  return dir;
}

/**
 * Installs the fake clasp and returns the environment to run the CLI with.
 *
 * @param {Record<string, string>} [extra]
 */
function fakeEnv(extra = {}) {
  const bin = tempDir();
  const log = join(tempDir(), 'clasp.log');
  writeFileSync(log, '');
  writeFileSync(join(bin, 'clasp'), FAKE_CLASP);
  chmodSync(join(bin, 'clasp'), 0o755);
  /** @type {NodeJS.ProcessEnv} */
  const env = {
    ...process.env,
    PATH: `${bin}${delimiter}${dirname(process.execPath)}${delimiter}${process.env['PATH']}`,
    FAKE_CLASP_LOG: log,
    ...extra,
  };
  delete env['GAS_TEST_SCRIPT_ID'];
  delete env['GAS_TEST_SPREADSHEET_ID'];
  return {
    env: { ...env, ...extra },
    entries: () =>
      readFileSync(log, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map((l) => JSON.parse(l)),
  };
}

/**
 * @param {string} cwd
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} [env]
 */
function run(cwd, args, env = process.env) {
  const r = spawnSync(process.execPath, [BIN, ...args], {
    cwd,
    env,
    encoding: 'utf8',
  });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

/**
 * @param {unknown} payload
 * @returns {string}
 */
function sentinel(payload) {
  return `noise\n@@GAS_TEST@@${Buffer.from(JSON.stringify(payload)).toString('base64')}@@END@@\nmore`;
}

describe('gas-test build', () => {
  it('writes the default cache file with real bundling and no peers', () => {
    const dir = createProject();
    const result = run(dir, ['gas-test', 'build']);
    const out = join(
      dir,
      'node_modules',
      '.cache',
      'gas-dev-config',
      'gas-test.js',
    );
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(out);
    expect(result.stdout).toContain(
      'Run runGasTests from the Apps Script editor, or npm run test:gas.',
    );
    const code = readFileSync(out, 'utf8');
    expect(code.split('\n')[0]).toMatch(
      /^\/\/ gas-dev-config gas-test build \S+ [0-9a-f]{16}$/,
    );
    const order = [
      '// ---- lib.js ----',
      '// ---- runtime.js ----',
      '// ---- lib.test.js ----',
    ].map((m) => code.indexOf(m));
    expect(order.every((i) => i > 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(code).toContain('const LIB = 1;');
    expect(existsSync(join(dir, 'gas-test.js'))).toBe(false);
  });

  it('honors --out', () => {
    const dir = createProject();
    const out = join(tempDir(), 'sub', 'bundle.js');
    expect(run(dir, ['gas-test', 'build', '--out', out]).status).toBe(0);
    expect(existsSync(out)).toBe(true);
  });

  it('fails without loadOrder', () => {
    const dir = createProject();
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    pkg.gasDevConfig = {};
    writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg));
    const result = run(dir, ['gas-test', 'build']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('"gasDevConfig.loadOrder" is required');
  });

  it('fails without tests', () => {
    const dir = createProject();
    rmSync(join(dir, 'gas-test', 'lib.test.ts'));
    const result = run(dir, ['gas-test', 'build']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('no tests found');
  });
});

describe('gas-test usage', () => {
  it.each([
    [['gas-test'], 'unknown command: gas-test'],
    [['gas-test', 'nope'], 'unknown command: gas-test nope'],
    [['gas-test', 'run', '--out', 'x'], '--out is only valid'],
    [['gas-test', 'build', '--keep'], '--keep is only valid'],
    [['check', '--keep'], '--keep is only valid'],
  ])('exits 2 for %j', (args, message) => {
    const result = run(REPO_ROOT, args);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain(message);
  });
});

describe('gas-test run', () => {
  const passing = sentinel({
    results: [
      { name: 'ok', status: 'PASS', ms: 3 },
      { name: 'ctx', status: 'INFO', ms: 1, message: 'locale en_US' },
    ],
    elapsedMs: 1500,
  });

  it('requires a script ID', () => {
    const dir = createProject({ gasTest: { scopes: SCOPES } });
    const { env, entries } = fakeEnv();
    const result = run(dir, ['gas-test', 'run'], env);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('GAS_TEST_SCRIPT_ID');
    expect(entries()).toEqual([]);
  });

  it('requires gasTest config', () => {
    const dir = createProject({ gasTest: undefined });
    const result = run(dir, ['gas-test', 'run'], fakeEnv().env);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('"gasDevConfig.gasTest" is required');
  });

  it('clones, pushes and runs, then prints results and cleans up', () => {
    const dir = createProject();
    const { env, entries } = fakeEnv({ FAKE_CLASP_STDOUT: passing });
    const result = run(dir, ['gas-test', 'run'], env);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      'PASS ok (3 ms)\nINFO ctx: locale en_US\n1 passed, 0 failed, 1 info in 1.5 s\n',
    );
    const [clone, push, runEntry] = entries();
    expect(entries().map((e) => e.args[0])).toEqual(['clone', 'push', 'run']);
    expect(clone.args).toEqual([
      'clone',
      'config-script',
      '--rootDir',
      clone.cwd,
    ]);
    expect(push.args).toEqual(['push', '--force']);
    expect(runEntry.args).toEqual(['run', 'runGasTests']);
    expect(push.files).toEqual([
      '.clasp.json',
      'appsscript.json',
      'gas-test.js',
    ]);
    expect(push.manifest).toEqual({
      timeZone: 'Etc/UTC',
      runtimeVersion: 'V8',
      exceptionLogging: 'STACKDRIVER',
      executionApi: { access: 'MYSELF' },
      oauthScopes: SCOPES,
    });
    expect(push.head).toMatch(/^\/\/ gas-dev-config gas-test build /);
    expect(existsSync(clone.cwd)).toBe(false);
  });

  it('prefers the environment script ID and passes the spreadsheet ID as params', () => {
    const dir = createProject();
    const { env, entries } = fakeEnv({
      FAKE_CLASP_STDOUT: passing,
      GAS_TEST_SCRIPT_ID: 'env-script',
      GAS_TEST_SPREADSHEET_ID: 'sheet-1',
    });
    expect(run(dir, ['gas-test', 'run'], env).status).toBe(0);
    const [clone, , runEntry] = entries();
    expect(clone.args[1]).toBe('env-script');
    expect(runEntry.args).toEqual([
      'run',
      'runGasTests',
      '--params',
      '["sheet-1"]',
    ]);
  });

  it('exits 1 on a FAIL and prints the message indented', () => {
    const dir = createProject();
    const failing = sentinel({
      results: [{ name: 'bad', status: 'FAIL', ms: 2, message: 'boom ✓' }],
      elapsedMs: 10,
    });
    const result = run(
      dir,
      ['gas-test', 'run'],
      fakeEnv({ FAKE_CLASP_STDOUT: failing }).env,
    );
    expect(result.status).toBe(1);
    expect(result.stdout).toBe(
      'FAIL bad (2 ms)\n  boom ✓\n0 passed, 1 failed, 0 info in 0.0 s\n',
    );
  });

  it('prints clasp output and a scope hint when the sentinel is missing', () => {
    const dir = createProject();
    const { env } = fakeEnv({
      FAKE_CLASP_STDOUT: 'nothing here',
      FAKE_CLASP_STDERR: 'PERMISSION_DENIED: insufficient scope',
      FAKE_CLASP_STATUS: '1',
    });
    const result = run(dir, ['gas-test', 'run'], env);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('nothing here');
    expect(result.stderr).toContain('PERMISSION_DENIED');
    expect(result.stderr).toContain(
      `clasp login --extra-scopes ${SCOPES.join(',')}`,
    );
  });

  it('omits the scope hint for unrelated failures', () => {
    const dir = createProject();
    const { env } = fakeEnv({
      FAKE_CLASP_STDERR: 'network down',
      FAKE_CLASP_STATUS: '1',
    });
    const result = run(dir, ['gas-test', 'run'], env);
    expect(result.status).toBe(1);
    expect(result.stderr).not.toContain('--extra-scopes');
  });

  it('explains how to install clasp when it is missing', () => {
    const dir = createProject();
    const empty = tempDir();
    const result = run(dir, ['gas-test', 'run'], {
      ...process.env,
      PATH: empty,
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('npm install -D @google/clasp');
    expect(result.stderr).toContain('clasp login');
  });

  it('keeps the temporary project with --keep', () => {
    const dir = createProject();
    const { env, entries } = fakeEnv({ FAKE_CLASP_STDOUT: passing });
    const result = run(dir, ['gas-test', 'run', '--keep'], env);
    const kept = entries()[0].cwd;
    dirs.push(kept);
    expect(result.stdout).toContain(`Test project kept at ${kept}`);
    expect(existsSync(join(kept, 'gas-test.js'))).toBe(true);
  });
});
