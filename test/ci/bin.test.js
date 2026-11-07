// @ts-check
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const BIN = new URL('../../bin/gas-dev-config.js', import.meta.url).pathname;

/**
 * @param {string[]} args
 * @returns {import('node:child_process').SpawnSyncReturns<string>}
 */
function run(args) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => key !== 'CLASPRC_JSON' && !key.startsWith('GAS_'),
    ),
  );
  return spawnSync(process.execPath, [BIN, ...args], {
    encoding: 'utf8',
    env,
  });
}

describe('gas-dev-config setup | deploy', () => {
  it('prints setup usage and exits 0', () => {
    const result = run(['setup', '--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Usage: gas-dev-config setup | deploy');
  });

  it('exits 1 with the inputs error when deploy has no credentials', () => {
    const result = run(['deploy']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('CLASPRC_JSON is not set');
  });
});
