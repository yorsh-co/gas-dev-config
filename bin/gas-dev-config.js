#!/usr/bin/env node
// @ts-check
import { parseArgs } from 'node:util';
import pkg from '../package.json' with { type: 'json' };
import { CheckError, checkProject, formatReport, loadConfig } from './check.js';
import { GasTestError, runBuild, runRun } from './gas-test.js';
import { HtmlError, runHtml } from './html.js';

const OPTIONS = /** @type {const} */ ({
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean' },
  out: { type: 'string' },
  keep: { type: 'boolean' },
  check: { type: 'boolean' },
});

const USAGE = `Usage: gas-dev-config check
       gas-dev-config gas-test build [--out <file>]
       gas-dev-config gas-test run [--keep]
       gas-dev-config html [--check]

Reports drift of .gitignore, .prettierignore, .github/dependabot.yml and the
standard package.json scripts from the preset templates. Never writes.

The preset is read from package.json: "gasDevConfig": { "preset": "gas" | "node" }
(default: gas). "loadOrder", "peers", "gasTest" and "html" are also validated.

Commands:
  check            Compare the project in the current directory with the templates
  gas-test build   Build one self-contained script (peers, library, test runtime
                   and gas-test/*.ts) to paste into the Apps Script editor
  gas-test run     Push that script to the dedicated test project with clasp
                   (replacing its whole contents), run it and print the results;
                   needs GAS_TEST_SCRIPT_ID or "gasTest.scriptId"
  html             Inline each "html" entry's local stylesheets and scripts
                   (TypeScript is transpiled) into a generated .ts file that
                   declares the page as a string constant

Options:
  -h, --help       Show this help
  --version        Show the version
  --out <file>     gas-test build: output file
                   (default: node_modules/.cache/gas-dev-config/gas-test.js)
  --keep           gas-test run: keep the temporary project directory
  --check          html: write nothing; exit 1 when a generated file is stale
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
  const isBuild = command === 'gas-test' && rest.join(' ') === 'build';
  const isRun = command === 'gas-test' && rest.join(' ') === 'run';
  const isCheck = command === 'check' && rest.length === 0;
  const isHtml = command === 'html' && rest.length === 0;
  if (!isCheck && !isBuild && !isRun && !isHtml) {
    return usageError(`unknown command: ${positionals.join(' ')}.`);
  }
  if (values.out !== undefined && !isBuild) {
    return usageError('--out is only valid with gas-test build.');
  }
  if (values.keep && !isRun) {
    return usageError('--keep is only valid with gas-test run.');
  }
  if (values.check && !isHtml) {
    return usageError('--check is only valid with html.');
  }
  try {
    if (isHtml) {
      const { html } = loadConfig(process.cwd());
      return runHtml(process.cwd(), html, { check: values.check === true });
    }
    if (isBuild) return runBuild(process.cwd(), { out: values.out });
    if (isRun) return runRun(process.cwd(), { keep: values.keep === true });
    const { drift } = checkProject(process.cwd());
    const out = formatReport(drift).join('\n') + '\n';
    (drift.length === 0 ? process.stdout : process.stderr).write(out);
    return drift.length === 0 ? 0 : 1;
  } catch (error) {
    if (
      error instanceof CheckError ||
      error instanceof GasTestError ||
      error instanceof HtmlError
    ) {
      process.stderr.write(`gas-dev-config: ${error.message}\n`);
      return 1;
    }
    throw error;
  }
}

process.exitCode = main(process.argv.slice(2));
