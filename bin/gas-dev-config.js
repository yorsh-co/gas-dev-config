#!/usr/bin/env node
// @ts-check
import { parseArgs } from 'node:util';
import pkg from '../package.json' with { type: 'json' };
import { CheckError, checkProject, formatReport } from './check.js';

const OPTIONS = /** @type {const} */ ({
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean' },
});

const USAGE = `Usage: gas-dev-config check

Reports drift of .gitignore, .prettierignore, .github/dependabot.yml and the
standard package.json scripts from the preset templates. Never writes.

The preset is read from package.json: "gasDevConfig": { "preset": "gas" | "node" }
(default: gas). "loadOrder" and "peers" are also validated.

Commands:
  check          Compare the project in the current directory with the templates

Options:
  -h, --help     Show this help
  --version      Show the version
`;

/**
 * @param {string} message
 * @returns {number} Exit code 2.
 */
function usageError(message) {
  process.stderr.write(
    `gas-dev-config: ${message}\nRun gas-dev-config --help for usage.\n`,
  );
  return 2;
}

/**
 * Runs the CLI.
 *
 * @param {string[]} argv Command-line arguments, without the node and script paths.
 * @returns {number} The process exit code: 0 when clean, 1 on drift or error, 2 on invalid usage.
 */
export function main(argv) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: OPTIONS,
      strict: true,
      allowPositionals: true,
    });
  } catch (error) {
    const { code, message } = /** @type {Error & { code?: string }} */ (error);
    if (!code?.startsWith('ERR_PARSE_ARGS_')) throw error;
    return usageError(message.split('. ')[0]?.replace(/\.$/, '') + '.');
  }
  const { values, positionals } = parsed;
  if (values.help) {
    process.stdout.write(USAGE);
    return 0;
  }
  if (values.version) {
    process.stdout.write(`${pkg.version}\n`);
    return 0;
  }
  const [command, ...rest] = positionals;
  if (command === undefined) return usageError('missing command.');
  if (command !== 'check' || rest.length > 0) {
    return usageError(`unknown command: ${positionals.join(' ')}.`);
  }
  try {
    const { drift } = checkProject(process.cwd());
    const out = formatReport(drift).join('\n') + '\n';
    (drift.length === 0 ? process.stdout : process.stderr).write(out);
    return drift.length === 0 ? 0 : 1;
  } catch (error) {
    if (error instanceof CheckError) {
      process.stderr.write(`gas-dev-config: ${error.message}\n`);
      return 1;
    }
    throw error;
  }
}

process.exitCode = main(process.argv.slice(2));
