// @ts-check
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const PRESETS = ['gas', 'node'];
const KNOWN_KEYS = ['preset'];
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
 * Resolves the preset from the `gasDevConfig` field of package.json.
 *
 * @param {Record<string, unknown>} pkg
 * @returns {string}
 */
function resolvePreset(pkg) {
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
  return preset;
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
 * Compares a project's non-extendable configuration with the preset templates.
 * Never writes.
 *
 * @param {string} cwd Project root.
 * @returns {{ preset: string, drift: Drift[] }}
 * @throws {CheckError} When package.json or the `gasDevConfig` field is unusable.
 */
export function checkProject(cwd) {
  const pkg = readJson(join(cwd, 'package.json'), 'package.json');
  if (!isRecord(pkg)) throw new CheckError('package.json must be an object');
  const preset = resolvePreset(pkg);
  const drift = [
    ...checkIgnoreFile(cwd, preset, '.gitignore'),
    ...checkIgnoreFile(cwd, preset, '.prettierignore'),
    ...checkDependabot(cwd, preset),
    ...checkScripts(pkg, preset),
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
