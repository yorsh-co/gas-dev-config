import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createGasLoader } from '../test-loader/index.js';
import { REPO_ROOT, createProject } from './support.js';

const ROOT = join(import.meta.dirname, 'fixtures', 'test-loader');
const FILES = ['lib/greeter.types.ts', 'lib/greeter.ts'];

/** @returns {ReturnType<typeof createGasLoader>} */
function greeterLoader() {
  return createGasLoader({ files: FILES, exports: ['Greeter'], root: ROOT });
}

/**
 * @typedef {new (options?: { greeting?: string }) => {
 *   greet(name: string): string;
 *   fail(): never;
 * }} GreeterConstructor
 */

describe('createGasLoader', () => {
  it('returns the requested exports', () => {
    const { Greeter, VERSION } = /** @type {any} */ (
      createGasLoader({
        files: FILES,
        exports: ['Greeter', 'VERSION'],
        root: ROOT,
      })({ Logger: { log() {} } })
    );
    expect(new Greeter({ greeting: 'Hi' }).greet('Ann')).toBe('Hi, Ann');
    expect(VERSION).toBe('1.0.0');
  });

  it('injects the given globals', () => {
    const Logger = { log: vi.fn() };
    const { Greeter } = /** @type {{ Greeter: GreeterConstructor }} */ (
      greeterLoader()({ Logger })
    );
    new Greeter().greet('Ann');
    expect(Logger.log).toHaveBeenCalledWith('greeting Ann');
  });

  it('resolves files against process.cwd() by default', () => {
    const cwd = vi.spyOn(process, 'cwd').mockReturnValue(ROOT);
    try {
      const load = createGasLoader({ files: FILES, exports: ['Greeter'] });
      expect(typeof load({ Logger: {} }).Greeter).toBe('function');
    } finally {
      cwd.mockRestore();
    }
  });

  it('evaluates in a fresh context per call', () => {
    const load = greeterLoader();
    const a = /** @type {any} */ (load({ Logger: { log() {} } }));
    const b = /** @type {any} */ (load({ Logger: { log() {} } }));
    expect(a.Greeter).not.toBe(b.Greeter);
    new a.Greeter();
    new a.Greeter();
    expect(a.Greeter.instances).toBe(2);
    expect(b.Greeter.instances).toBe(0);
  });

  it('does not mutate the given globals', () => {
    const globals = { Logger: { log() {} } };
    greeterLoader()(globals);
    expect(Object.keys(globals)).toEqual(['Logger']);
  });

  it('reads and compiles the sources once, at creation', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gas-loader-'));
    try {
      writeFileSync(join(dir, 'a.ts'), 'const A: number = 1;');
      const load = createGasLoader({
        files: ['a.ts'],
        exports: ['A'],
        root: dir,
      });
      rmSync(join(dir, 'a.ts'));
      expect(load()).toEqual({ A: 1 });
      expect(load()).toEqual({ A: 1 });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('shares the host Error when passed as a global', () => {
    const load = greeterLoader();
    const shared = /** @type {{ Greeter: GreeterConstructor }} */ (
      load({ Logger: {}, Error })
    );
    const isolated = /** @type {{ Greeter: GreeterConstructor }} */ (
      load({ Logger: {} })
    );
    expect(() => new shared.Greeter().fail()).toThrow(Error);
    expect(() => new isolated.Greeter().fail()).not.toThrow(Error);
  });

  it('names the resolved path of a missing source file at creation', () => {
    expect(() =>
      createGasLoader({
        files: ['lib/missing.ts'],
        exports: ['X'],
        root: ROOT,
      }),
    ).toThrow(join(ROOT, 'lib', 'missing.ts'));
  });

  it('names an export the sources do not define at load time', () => {
    const load = createGasLoader({
      files: FILES,
      exports: ['Greeter', 'Nope'],
      root: ROOT,
    });
    expect(() => load({ Logger: {} })).toThrow(
      'export "Nope" is not defined by the source files',
    );
  });

  it.each([
    [undefined, 'options must be an object'],
    [[], 'options must be an object'],
    [{ files: ['a.ts'], exports: ['A'], extra: 1 }, 'unknown option "extra"'],
    [{ exports: ['A'] }, 'option "files"'],
    [{ files: [], exports: ['A'] }, 'option "files"'],
    [{ files: ['a.ts', 1], exports: ['A'] }, 'option "files"'],
    [{ files: ['a.ts'] }, 'option "exports"'],
    [{ files: ['a.ts'], exports: [''] }, 'option "exports"'],
    [{ files: ['a.ts'], exports: ['a-b'] }, '"a-b", which is not a valid'],
    [{ files: ['a.ts'], exports: ['A'], root: '' }, 'option "root"'],
    [{ files: ['a.ts'], exports: ['A'], root: 1 }, 'option "root"'],
  ])('rejects invalid options %j', (options, message) => {
    const create = () => createGasLoader(/** @type {any} */ (options));
    expect(create).toThrow(TypeError);
    expect(create).toThrow(message);
  });
});

describe('gas-dev-config/test types', () => {
  /** @type {ReturnType<typeof createProject>} */
  let project;

  beforeAll(() => {
    project = createProject('test-loader');
  });
  afterAll(() => project.cleanup());

  /**
   * @param {string} config tsconfig file name inside the consumer fixture.
   * @returns {{ status: number | null, output: string }}
   */
  function tsc(config) {
    const result = spawnSync(
      join(REPO_ROOT, 'node_modules', '.bin', 'tsc'),
      ['--noEmit', '-p', join(project.dir, 'consumer', config)],
      { encoding: 'utf8' },
    );
    return { status: result.status, output: result.stdout + result.stderr };
  }

  it('type-checks a consumer importing gas-dev-config/test', () => {
    expect(tsc('tsconfig.json')).toEqual({ status: 0, output: '' });
  });

  it('rejects options missing a required property', () => {
    const { status, output } = tsc('tsconfig.invalid.json');
    expect(status).not.toBe(0);
    expect(output).toContain("Property 'exports' is missing");
  });
});
