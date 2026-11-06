import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { compareRulesets, loadTemplates } from '../bin/github.js';
import { REPO_ROOT } from './support.js';

const BIN = join(REPO_ROOT, 'bin', 'gas-dev-config.js');

/** Fake gh: logs calls and answers from the JSON state in $FAKE_GH_STATE. */
const FAKE_GH = `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const state = JSON.parse(fs.readFileSync(process.env.FAKE_GH_STATE, 'utf8'));
const stdin = args.includes('--input') ? fs.readFileSync(0, 'utf8') : null;
fs.appendFileSync(process.env.FAKE_GH_LOG, JSON.stringify({ args, stdin }) + '\\n');
const [a, b] = args;
if (a === 'auth' && b === 'status') process.exit(state.auth ? 0 : 1);
if (a === 'repo' && b === 'view') {
  process.stdout.write('yorsh-co/demo\\n');
  process.exit(0);
}
if (a === 'api' && args.length === 2) {
  const path = b.replace('repos/yorsh-co/demo/rulesets', '');
  if (path === '?per_page=100') {
    const list = state.rulesets.map(({ id, name, target, enforcement }) => ({
      id, name, target, enforcement,
    }));
    process.stdout.write(JSON.stringify(list));
    process.exit(0);
  }
  const found = state.rulesets.find((r) => '/' + r.id === path);
  if (found) {
    process.stdout.write(
      JSON.stringify({ ...found, node_id: 'RRS_x', source_type: 'Repository', source: 'yorsh-co/demo' }),
    );
    process.exit(0);
  }
}
process.stderr.write('unexpected gh call\\n');
process.exit(1);
`;

/** @type {string[]} */
const dirs = [];

afterEach(() => {
  for (const dir of dirs.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

/** @returns {string} */
function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'gas-dev-config-github-'));
  dirs.push(dir);
  return dir;
}

/**
 * Runs `gas-dev-config github` against a fake gh.
 *
 * @param {object} state Fake gh state.
 * @param {string[]} [args]
 * @param {{ noGh?: boolean }} [options]
 */
function runGithub(state, args = ['github'], { noGh = false } = {}) {
  const bin = tempDir();
  const work = tempDir();
  const stateFile = join(work, 'state.json');
  const log = join(work, 'gh.log');
  writeFileSync(stateFile, JSON.stringify(state));
  writeFileSync(log, '');
  if (!noGh) {
    writeFileSync(join(bin, 'gh'), FAKE_GH);
    chmodSync(join(bin, 'gh'), 0o755);
  }
  const node = dirname(process.execPath);
  const result = spawnSync(process.execPath, [BIN, ...args], {
    cwd: work,
    encoding: 'utf8',
    env: {
      ...process.env,
      PATH: noGh ? bin : `${bin}${delimiter}${node}`,
      FAKE_GH_STATE: stateFile,
      FAKE_GH_LOG: log,
    },
  });
  return {
    ...result,
    calls: readFileSync(log, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line)),
  };
}

/** @returns {(Record<string, any> & { id: number, name: string })[]} Templates as GitHub rulesets. */
function inSync() {
  return loadTemplates().map((t, i) => ({ id: i + 1, ...t }));
}

/** @param {{ args: string[] }[]} calls */
function writes(calls) {
  return calls.filter((c) => c.args.includes('-X'));
}

describe('gas-dev-config github', () => {
  it('exits 0 and writes nothing when in sync', () => {
    const result = runGithub({ auth: true, rulesets: inSync() });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('✓ ruleset branches');
    expect(result.stdout).toContain('✓ ruleset tags');
    expect(writes(result.calls)).toEqual([]);
  });

  it('exits 1 for a missing ruleset', () => {
    const result = runGithub({ auth: true, rulesets: inSync().slice(1) });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('✗ ruleset branches: missing');
    expect(result.stderr).toContain('gas-dev-config github --fix');
  });

  it('exits 1 naming the drifted field', () => {
    const rulesets = inSync();
    rulesets[0] = {
      ...rulesets[0],
      id: 1,
      name: 'branches',
      rules: [{ type: 'deletion' }],
    };
    const result = runGithub({ auth: true, rulesets });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('✗ ruleset branches: differs in rules');
  });

  it('ignores the order of include', () => {
    const rulesets = inSync();
    rulesets[0]?.conditions['ref_name'].include.reverse();
    expect(runGithub({ auth: true, rulesets }).status).toBe(0);
  });

  it('warns about an extra ruleset without failing', () => {
    const rulesets = [...inSync(), { id: 9, name: 'custom', target: 'branch' }];
    const result = runGithub({ auth: true, rulesets });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      '! ruleset custom: not in the template (left unchanged)',
    );
  });

  it('does not compare a field the API omits', () => {
    const rulesets = inSync();
    for (const r of rulesets) delete r.bypass_actors;
    expect(runGithub({ auth: true, rulesets }).status).toBe(0);
  });

  it('exits 1 with an install hint when gh is missing', () => {
    const result = runGithub({}, ['github'], { noGh: true });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Install GitHub CLI');
  });

  it('exits 1 with a login hint when unauthenticated', () => {
    const result = runGithub({ auth: false, rulesets: [] });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('gh auth login');
  });

  it.each([
    [['github', 'extra'], 'unknown command: github extra'],
    [['github', '--check'], '--check is only valid'],
  ])('exits 2 on %j', (args, message) => {
    const result = runGithub({ auth: true, rulesets: [] }, args);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain(message);
    expect(result.calls).toEqual([]);
  });
});

describe('compareRulesets', () => {
  const branches = /** @type {import('../bin/github.js').Ruleset} */ (
    loadTemplates()[0]
  );

  it('treats rules in another order as equal', () => {
    const actual = { id: 1, ...branches, rules: [...branches.rules].reverse() };
    expect(compareRulesets([branches], [actual]).inSync).toEqual(['branches']);
  });

  it('ignores fields outside the compared set', () => {
    const actual = { id: 1, ...branches, node_id: 'x', source: 'y' };
    expect(compareRulesets([branches], [actual]).drifted).toEqual([]);
  });

  it('reports every differing field', () => {
    const actual = {
      id: 7,
      ...branches,
      enforcement: 'disabled',
      target: 'tag',
    };
    const { drifted } = compareRulesets([branches], [actual]);
    expect(drifted).toEqual([
      { template: branches, id: 7, fields: ['target', 'enforcement'] },
    ]);
  });

  it('detects a different include list', () => {
    const actual = {
      id: 1,
      ...branches,
      conditions: { ref_name: { include: ['~ALL'], exclude: [] } },
    };
    expect(compareRulesets([branches], [actual]).drifted[0]?.fields).toEqual([
      'conditions',
    ]);
  });
});
