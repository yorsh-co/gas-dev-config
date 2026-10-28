// @ts-check
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PRESETS = ['gas', 'node'];
const KNOWN_KEYS = ['preset', 'loadOrder', 'peers'];
const PEER_NAME = /^[a-z0-9][a-z0-9._-]*$/;
const TEMPLATES = new URL('../templates/', import.meta.url);

/** Local invocation used in place of the `gas-dev-config` bin by this package itself. */
const SELF_BIN = 'node bin/gas-dev-config.js';

/**
 * @typedef {object} Drift
 * @property {string} file Project file the drift belongs to.
 * @property {string} message What is missing, expected or different.
 */

/**
 * @typedef {object} ScriptsTemplate
 * @property {Record<string, string>} required Scripts that must have exactly this value.
 * @property {string[]} present Scripts that must exist with any value.
 */

/**
 * @typedef {object} ResolvedConfig
 * @property {string} preset Preset name; `gas` when unset.
 * @property {string[] | undefined} loadOrder Source files under `src/` in load order.
 * @property {Record<string, string> | undefined} peers Optional sibling libraries and their version ranges.
 */

/** Raised for a configuration problem that prevents the check from running. */
export class CheckError extends Error {}

/**
 * Reads a text file, or returns `undefined` when it does not exist.
 *
 * @param {string | URL} path
 * @returns {string | undefined}
 */
function readOptional(path) {
  if (!existsSync(path)) return undefined;
  return readFileSync(path, 'utf8');
}

/**
 * Reads and parses a JSON file.
 *
 * @param {string | URL} path
 * @param {string} label Name used in error messages.
 * @returns {unknown}
 */
function readJson(path, label) {
  const text = readOptional(path);
  if (text === undefined) throw new CheckError(`${label} not found`);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new CheckError(
      `${label} is not valid JSON: ${/** @type {Error} */ (error).message}`,
    );
  }
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validates `gasDevConfig.loadOrder`: a non-empty list of unique, relative POSIX
 * paths under `src/` to `.ts` files that are not declaration files.
 *
 * @param {unknown} value
 * @returns {string[]}
 */
function parseLoadOrder(value) {
  const key = 'package.json: "gasDevConfig.loadOrder"';
  if (!Array.isArray(value) || value.length === 0) {
    throw new CheckError(`${key} must be a non-empty array of strings`);
  }
  /** @type {Set<string>} */
  const seen = new Set();
  for (const entry of value) {
    if (typeof entry !== 'string' || entry === '') {
      throw new CheckError(
        `${key} entry ${JSON.stringify(entry)} must be a non-empty string`,
      );
    }
    if (seen.has(entry)) {
      throw new CheckError(`${key} lists ${JSON.stringify(entry)} twice`);
    }
    seen.add(entry);
    if (entry.startsWith('/') || /^[A-Za-z]:/.test(entry)) {
      throw new CheckError(
        `${key} entry ${JSON.stringify(entry)} must be relative to src/`,
      );
    }
    if (entry.includes('\\')) {
      throw new CheckError(
        `${key} entry ${JSON.stringify(entry)} must use "/" separators`,
      );
    }
    if (
      entry
        .split('/')
        .some((part) => part === '' || part === '.' || part === '..')
    ) {
      throw new CheckError(
        `${key} entry ${JSON.stringify(entry)} must not contain empty, "." or ".." segments`,
      );
    }
    if (!entry.endsWith('.ts') || entry.endsWith('.d.ts')) {
      throw new CheckError(
        `${key} entry ${JSON.stringify(entry)} must be a .ts file other than .d.ts`,
      );
    }
  }
  return /** @type {string[]} */ (value);
}

/**
 * Validates `gasDevConfig.peers`: package names mapped to non-empty version ranges.
 *
 * @param {unknown} value
 * @returns {Record<string, string>}
 */
function parsePeers(value) {
  const key = 'package.json: "gasDevConfig.peers"';
  if (!isRecord(value)) throw new CheckError(`${key} must be an object`);
  for (const [name, range] of Object.entries(value)) {
    if (!PEER_NAME.test(name)) {
      throw new CheckError(
        `${key} has an invalid package name ${JSON.stringify(name)}`,
      );
    }
    if (typeof range !== 'string' || range.trim() === '') {
      throw new CheckError(
        `${key}[${JSON.stringify(name)}] must be a non-empty version range string`,
      );
    }
  }
  return /** @type {Record<string, string>} */ (value);
}

/**
 * Resolves and validates the `gasDevConfig` field of package.json.
 *
 * @param {Record<string, unknown>} pkg
 * @returns {ResolvedConfig}
 */
function resolveConfig(pkg) {
  const config = pkg['gasDevConfig'] ?? {};
  if (!isRecord(config)) {
    throw new CheckError('package.json: "gasDevConfig" must be an object');
  }
  const unknown = Object.keys(config).filter((k) => !KNOWN_KEYS.includes(k));
  if (unknown.length > 0) {
    throw new CheckError(
      `package.json: unknown "gasDevConfig" key(s): ${unknown.join(', ')} (expected: ${KNOWN_KEYS.join(', ')})`,
    );
  }
  const preset = config['preset'] ?? 'gas';
  if (typeof preset !== 'string' || !PRESETS.includes(preset)) {
    throw new CheckError(
      `package.json: unknown preset ${JSON.stringify(preset)} (expected: ${PRESETS.join(', ')})`,
    );
  }
  for (const key of ['loadOrder', 'peers']) {
    if (config[key] !== undefined && preset !== 'gas') {
      throw new CheckError(
        `package.json: "gasDevConfig.${key}" requires the gas preset`,
      );
    }
  }
  return {
    preset,
    loadOrder:
      config['loadOrder'] === undefined
        ? undefined
        : parseLoadOrder(config['loadOrder']),
    peers:
      config['peers'] === undefined ? undefined : parsePeers(config['peers']),
  };
}

/**
 * Lists the meaningful lines of an ignore file: trimmed, without blanks and comments.
 *
 * @param {string} text
 * @returns {string[]}
 */
function ignoreEntries(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith('#'));
}

/**
 * Normalises line endings and trailing whitespace for whole-file comparison.
 *
 * @param {string} text
 * @returns {string}
 */
function normalise(text) {
  return text.replace(/[ \t\r]+$/gm, '').replace(/\n+$/, '');
}

/**
 * Requires every template entry to appear in the project's ignore file.
 *
 * @param {string} cwd
 * @param {string} preset
 * @param {string} name Ignore file name.
 * @returns {Drift[]}
 */
function checkIgnoreFile(cwd, preset, name) {
  const actual = readOptional(join(cwd, name));
  if (actual === undefined) return [{ file: name, message: 'file is missing' }];
  const template = readFileSync(
    new URL(`${preset}/${name.slice(1)}`, TEMPLATES),
    'utf8',
  );
  const present = new Set(ignoreEntries(actual));
  return ignoreEntries(template)
    .filter((entry) => !present.has(entry))
    .map((entry) => ({ file: name, message: `missing line: ${entry}` }));
}

/**
 * Requires the Dependabot configuration to equal the template.
 *
 * @param {string} cwd
 * @param {string} preset
 * @returns {Drift[]}
 */
function checkDependabot(cwd, preset) {
  const file = '.github/dependabot.yml';
  const actual = readOptional(join(cwd, file));
  if (actual === undefined) return [{ file, message: 'file is missing' }];
  const template = readFileSync(
    new URL(`${preset}/${file}`, TEMPLATES),
    'utf8',
  );
  if (normalise(actual) === normalise(template)) return [];
  return [
    { file, message: `differs from the template templates/${preset}/${file}` },
  ];
}

/**
 * Checks the standard package.json scripts.
 *
 * @param {Record<string, unknown>} pkg
 * @param {string} preset
 * @returns {Drift[]}
 */
function checkScripts(pkg, preset) {
  const file = 'package.json';
  const template = /** @type {ScriptsTemplate} */ (
    readJson(new URL(`${preset}/scripts.json`, TEMPLATES), 'scripts template')
  );
  const scripts = isRecord(pkg['scripts']) ? pkg['scripts'] : {};
  const isSelf = pkg['name'] === 'gas-dev-config';
  /** @type {Drift[]} */
  const drift = [];
  for (const [name, wanted] of Object.entries(template.required)) {
    const expected = isSelf
      ? wanted.replace('gas-dev-config check', `${SELF_BIN} check`)
      : wanted;
    const found = scripts[name];
    if (found === undefined) {
      drift.push({
        file,
        message: `scripts.${name} is missing; expected: ${expected}`,
      });
    } else if (found !== expected) {
      drift.push({
        file,
        message: `scripts.${name} differs; expected: ${expected}; found: ${JSON.stringify(found)}`,
      });
    }
  }
  for (const name of template.present) {
    if (scripts[name] === undefined) {
      drift.push({ file, message: `scripts.${name} is missing` });
    }
  }
  return drift;
}

/**
 * Requires every `loadOrder` entry to exist under `src/`.
 *
 * @param {string} cwd
 * @param {string[]} loadOrder
 * @returns {Drift[]}
 */
function checkLoadOrder(cwd, loadOrder) {
  return loadOrder
    .filter((entry) => !existsSync(join(cwd, 'src', entry)))
    .map((entry) => ({
      file: 'package.json',
      message: `gasDevConfig.loadOrder: src/${entry} does not exist`,
    }));
}

/**
 * Compares a project's non-extendable configuration with the preset templates
 * and validates its `gasDevConfig.loadOrder` files. Never writes.
 *
 * @param {string} cwd Project root.
 * @returns {{ preset: string, drift: Drift[] }}
 * @throws {CheckError} When package.json or the `gasDevConfig` field is unusable or invalid.
 */
export function checkProject(cwd) {
  const pkg = readJson(join(cwd, 'package.json'), 'package.json');
  if (!isRecord(pkg)) throw new CheckError('package.json must be an object');
  const { preset, loadOrder } = resolveConfig(pkg);
  const drift = [
    ...checkIgnoreFile(cwd, preset, '.gitignore'),
    ...checkIgnoreFile(cwd, preset, '.prettierignore'),
    ...checkDependabot(cwd, preset),
    ...checkScripts(pkg, preset),
    ...(loadOrder ? checkLoadOrder(cwd, loadOrder) : []),
  ];
  return { preset, drift };
}

/**
 * Formats drift as one line per entry, grouped by file, followed by a summary.
 *
 * @param {Drift[]} drift
 * @returns {string[]}
 */
export function formatReport(drift) {
  if (drift.length === 0) return ['✓ Config check passed'];
  /** @type {string[]} */
  const lines = [];
  const files = [...new Set(drift.map((d) => d.file))];
  for (const file of files) {
    lines.push(file);
    for (const d of drift.filter((x) => x.file === file)) {
      lines.push(`  ${d.message}`);
    }
  }
  lines.push(
    `✗ Config check failed: ${drift.length} issue(s) in ${files.length} file(s)`,
  );
  return lines;
}
