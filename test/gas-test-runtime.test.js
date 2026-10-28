import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import { REPO_ROOT } from './support.js';

const SOURCE = readFileSync(join(REPO_ROOT, 'gas-test', 'runtime.js'), 'utf8');
const HOUR = 60 * 60 * 1000;

/**
 * @param {string[]} names Initial sheet names.
 */
function createSpreadsheet(names) {
  const sheets = names.map((name) => ({ getName: () => name }));
  return {
    sheets,
    getSheets: () => [...sheets],
    deleteSheet: vi.fn((/** @type {{ getName(): string }} */ sheet) => {
      sheets.splice(sheets.indexOf(sheet), 1);
    }),
    names: () => sheets.map((s) => s.getName()),
  };
}

/**
 * Evaluates the runtime in a fresh context with fakes of the Apps Script services.
 *
 * @param {{ spreadsheet?: ReturnType<typeof createSpreadsheet>, property?: string | null, active?: boolean }} [options]
 */
function load({
  spreadsheet = createSpreadsheet(['Sheet1']),
  property = null,
  active = true,
} = {}) {
  /** @type {string[]} */
  const logs = [];
  const SpreadsheetApp = {
    openById: vi.fn(() => spreadsheet),
    getActiveSpreadsheet: vi.fn(() => (active ? spreadsheet : null)),
  };
  const getProperty = vi.fn(() => property);
  const context = vm.createContext({
    console: { log: (/** @type {string} */ line) => logs.push(line) },
    SpreadsheetApp,
    PropertiesService: { getScriptProperties: () => ({ getProperty }) },
    Utilities: {
      Charset: { UTF_8: 'UTF_8' },
      base64Encode: (/** @type {string} */ text) =>
        Buffer.from(text, 'utf8').toString('base64'),
    },
  });
  vm.runInContext(SOURCE, context);
  return {
    context: /** @type {any} */ (context),
    logs,
    spreadsheet,
    SpreadsheetApp,
    getProperty,
  };
}

/**
 * @param {string} returned
 * @returns {{ results: any[], elapsedMs: number }}
 */
function decode(returned) {
  const match = /^@@GAS_TEST@@([A-Za-z0-9+/=]+)@@END@@$/.exec(returned);
  expect(match).not.toBeNull();
  return JSON.parse(Buffer.from(match?.[1] ?? '', 'base64').toString('utf8'));
}

describe('gas-test runtime', () => {
  it('runs tests in registration order and reports PASS, FAIL and INFO', () => {
    const { context, logs } = load();
    context.test('first', () => {});
    context.test('second', () => context.assert(false, 'nope'));
    context.info('third', () => 'some context');
    context.info('fourth', () => {
      throw new Error('unsupported here');
    });
    const { results } = decode(context.runGasTests());
    expect(results.map((r) => [r.name, r.status, r.message])).toEqual([
      ['first', 'PASS', undefined],
      ['second', 'FAIL', 'nope'],
      ['third', 'INFO', 'some context'],
      ['fourth', 'INFO', 'unsupported here'],
    ]);
    for (const r of results) expect(r.ms).toBeGreaterThanOrEqual(0);
    expect(logs[0]).toMatch(/^PASS first \(\d+ ms\)$/);
    expect(logs[1]).toMatch(/^FAIL second \(\d+ ms\): nope$/);
    expect(logs[2]).toBe('INFO third: some context');
    expect(logs[3]).toBe('INFO fourth: unsupported here');
    expect(logs[4]).toMatch(/^1 passed, 1 failed, 2 info in \d+\.\d s$/);
  });

  it('asserts with Error(message)', () => {
    const { context } = load();
    expect(() => context.assert(true, 'x')).not.toThrow();
    expect(() => context.assert(0, 'bad value')).toThrow('bad value');
    expect(() => context.assert(null)).toThrow('Assertion failed');
  });

  it('round-trips non-ASCII names and messages through the sentinel', () => {
    const { context } = load();
    context.test('ünï — ✓', () => context.assert(false, 'ß ≠ 日本語'));
    const { results, elapsedMs } = decode(context.runGasTests());
    expect(results[0]).toMatchObject({
      name: 'ünï — ✓',
      message: 'ß ≠ 日本語',
    });
    expect(elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('passes a prefix of the form __gt_<epochMs>_', () => {
    const { context } = load();
    let prefix = '';
    context.test('p', (/** @type {any} */ c) => (prefix = c.prefix));
    context.runGasTests();
    expect(prefix).toMatch(/^__gt_\d+_$/);
  });

  describe('spreadsheet', () => {
    it('is not resolved or touched when unused', () => {
      const { context, SpreadsheetApp, getProperty, spreadsheet } = load();
      context.test('a', () => {});
      context.runGasTests('id');
      expect(SpreadsheetApp.openById).not.toHaveBeenCalled();
      expect(SpreadsheetApp.getActiveSpreadsheet).not.toHaveBeenCalled();
      expect(getProperty).not.toHaveBeenCalled();
      expect(spreadsheet.deleteSheet).not.toHaveBeenCalled();
    });

    it('prefers the argument, then the script property, then the active spreadsheet', () => {
      let h = load({ property: 'prop-id' });
      h.context.test('a', (/** @type {any} */ c) => c.spreadsheet);
      h.context.runGasTests('arg-id');
      expect(h.SpreadsheetApp.openById).toHaveBeenCalledWith('arg-id');
      expect(h.getProperty).not.toHaveBeenCalled();

      h = load({ property: 'prop-id' });
      h.context.test('a', (/** @type {any} */ c) => c.spreadsheet);
      h.context.runGasTests('');
      expect(h.getProperty).toHaveBeenCalledWith('GAS_TEST_SPREADSHEET_ID');
      expect(h.SpreadsheetApp.openById).toHaveBeenCalledWith('prop-id');

      h = load();
      h.context.test('a', (/** @type {any} */ c) => c.spreadsheet);
      h.context.runGasTests();
      expect(h.SpreadsheetApp.openById).not.toHaveBeenCalled();
      expect(h.SpreadsheetApp.getActiveSpreadsheet).toHaveBeenCalledTimes(1);
    });

    it('resolves once per run', () => {
      const h = load();
      h.context.test('a', (/** @type {any} */ c) => c.spreadsheet);
      h.context.test('b', (/** @type {any} */ c) => c.spreadsheet);
      h.context.runGasTests('id');
      expect(h.SpreadsheetApp.openById).toHaveBeenCalledTimes(1);
    });

    it('fails the accessing test with an error naming all three options', () => {
      const h = load({ active: false });
      h.context.test('a', (/** @type {any} */ c) => c.spreadsheet);
      const [result] = decode(h.context.runGasTests()).results;
      expect(result.status).toBe('FAIL');
      expect(result.message).toContain('runGasTests(spreadsheetId)');
      expect(result.message).toContain('GAS_TEST_SPREADSHEET_ID');
      expect(result.message).toContain('getActiveSpreadsheet');
    });
  });

  describe('sheet cleanup', () => {
    it('deletes stale test sheets on first access and keeps recent and foreign ones', () => {
      const now = Date.now();
      const spreadsheet = createSpreadsheet([
        'Sheet1',
        `__gt_${now - 2 * HOUR}_old`,
        `__gt_${now - 10 * 60 * 1000}_recent`,
        '__gt_abc_other',
      ]);
      const h = load({ spreadsheet });
      h.context.test('a', (/** @type {any} */ c) => c.spreadsheet);
      h.context.runGasTests();
      expect(spreadsheet.names()).toEqual([
        'Sheet1',
        `__gt_${now - 10 * 60 * 1000}_recent`,
        '__gt_abc_other',
      ]);
    });

    it("deletes this run's sheets afterwards, even when a test fails", () => {
      const spreadsheet = createSpreadsheet(['Sheet1']);
      const h = load({ spreadsheet });
      h.context.test('a', (/** @type {any} */ c) => {
        c.spreadsheet.getSheets();
        spreadsheet.sheets.push({ getName: () => `${c.prefix}tmp` });
        c.assert(false, 'boom');
      });
      const { results } = decode(h.context.runGasTests());
      expect(results).toHaveLength(1);
      expect(spreadsheet.names()).toEqual(['Sheet1']);
    });

    it('records a cleanup failure as INFO instead of throwing', () => {
      const spreadsheet = createSpreadsheet(['Sheet1']);
      const h = load({ spreadsheet });
      h.context.test('a', (/** @type {any} */ c) => {
        c.spreadsheet.getSheets();
        spreadsheet.sheets.push({ getName: () => `${c.prefix}tmp` });
      });
      spreadsheet.deleteSheet.mockImplementation(() => {
        throw new Error('cannot delete');
      });
      const { results } = decode(h.context.runGasTests());
      expect(results[1]).toMatchObject({
        name: 'cleanup',
        status: 'INFO',
        message: 'cannot delete',
      });
      expect(h.logs).toContain('INFO cleanup: cannot delete');
    });
  });
});
