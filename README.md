# gas-dev-config

## Shared Prettier, TypeScript and ESLint configuration for gas-\* Google Apps Script projects.

> [!NOTE]
> `gas-dev-config` is development tooling. It is installed as a dev dependency and is never pushed to Apps Script.

> **Disclaimer:**
> This project and [Yorsh](https://github.com/yorsh-co) are independent and are not affiliated with, endorsed by, or associated with Google LLC.

### Features

- One Prettier config, four TypeScript presets and one ESLint flat-config factory, so a tooling change is made once and rolled out by bumping a version
- Uses each tool's own extension mechanism (shared Prettier config, tsconfig `extends`, exported ESLint factory) instead of copying files
- ESLint `gas` preset for Apps Script TypeScript, with a `web` option for browser sources and a `node` preset for plain JavaScript tooling
- `gas-dev-config check` reports drift of the files that cannot be extended: `.gitignore`, `.prettierignore`, `.github/dependabot.yml` and the standard `package.json` scripts
- The check is read-only: it never writes to your project
- `gas-dev-config/test` loads Apps Script sources, which are global-scope scripts without exports, into a fresh `node:vm` context for Vitest suites
- `gas-dev-config gas-test` builds a library's tests into one script that runs in real Apps Script, from the editor or through clasp
- `gas-dev-config html` inlines a page edited as `.html`, `.css` and TypeScript into one generated `.ts` string constant, so an HtmlService UI ships as a single Apps Script source file
- Plain ESM JavaScript, no build step

<a id="gas-dev-tools"></a>

## The gas-dev-\* tools

Three development tools support the gas-\* libraries. None of them is ever pushed to Apps Script.

| Tool                                                             | Installed by                                        | Purpose                                                                                                                                                                                                                     |
| ---------------------------------------------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gas-dev-config` (this package)                                  | Library authors                                     | Prettier, TypeScript and ESLint presets; `check` for config drift; the `gasDevConfig` key (`loadOrder`, `peers`, `gasTest`, `html`); the Vitest loader; Apps Script tests (`gas-test build`/`run`); the HTML build (`html`) |
| [`gas-dev-release`](https://github.com/yorsh-co/gas-dev-release) | Library authors                                     | Publishes the build to the `dist` branch, tagged `dist/vX.Y.Z`, with a release `package.json` that carries `gasLibrary` metadata derived from `gasDevConfig`                                                                |
| [`gas-dev-bundle`](https://github.com/yorsh-co/gas-dev-bundle)   | Apps Script projects using several gas-\* libraries | Resolves version ranges against the `dist/vX.Y.Z` tags and writes the libraries into one script, ordered by their `gasLibrary` metadata                                                                                     |

Each is a dev dependency installed from GitHub with a `#semver:` range. A library uses `gas-dev-config` and `gas-dev-release`; a project consuming several libraries needs only `gas-dev-bundle` (a single library can be added with `git subtree` instead).

The tools are connected by one piece of metadata, declared once in the library:

```text
library package.json            dist/vX.Y.Z package.json          consumer project
"gasDevConfig": {               "gasLibrary": {                   src/lib/gas-libraries.js
  "loadOrder": [...],  ──────►    "loadOrder": [...],   ──────►   (libraries and their files
  "peers": {...}                  "peers": {...}                   in load order)
}                               }
validated by                    written by                        written by
gas-dev-config check            gas-dev-release                   gas-dev-bundle
```

The only code dependency between them: `gas-dev-config gas-test build` uses `gas-dev-bundle` to bundle a library's peers ahead of the library under test.

A library release therefore runs: `npm run check` (presets, tests and `gas-dev-config check`), `npm run test:gas` on the release branch (Apps Script tests, manual), then `npm run build:release` (build, then `gas-dev-release`).

## Requirements

- Node.js >= 20.10
- Peer dependencies, which stay direct dev dependencies of your project so their binaries are linked:
  - `eslint` `^10.7.0`
  - `prettier` `^3.9.6`
  - `typescript` `^5.9.3`
  - `@google/clasp` `^3.4.1`, optional: only for `gas-dev-config gas-test run`
- `@types/google-apps-script`, and `@types/node` for projects with tests, as your own dev dependencies

> [!IMPORTANT]
> The presets reference `types` such as `google-apps-script` and `node`. TypeScript resolves them from your project's `node_modules/@types`, not from this package, so they must be installed by the consumer. Relying on hoisting would be fragile.

## Install

Add it to your project's `package.json` as a dev dependency, pinned to a release tag, together with the peer dependencies:

```json
{
  "devDependencies": {
    "gas-dev-config": "github:yorsh-co/gas-dev-config#semver:^1.0.0",
    "eslint": "^10.7.0",
    "prettier": "^3.9.6",
    "typescript": "^5.9.3",
    "@types/google-apps-script": "^2.0.13",
    "@types/node": "^22.20.5"
  }
}
```

`@eslint/js`, `typescript-eslint`, `eslint-config-prettier` and `globals` are dependencies of `gas-dev-config`. Remove them from your own `devDependencies`.

## Prettier

Point the `prettier` key of your `package.json` at the shared config:

```json
{
  "prettier": "gas-dev-config/prettier"
}
```

The config is `{ "singleQuote": true }`; every other option is a Prettier 3 default.

Delete `.prettierrc.json`. A `prettier` key in `package.json` takes precedence over `.prettierrc.json`, so a leftover file was already being ignored.

## TypeScript

Extend one of the presets from `gas-dev-config/tsconfig/`:

| Preset          | Use for                         | Sets                                                                                                                                                                                                                                                                                                   |
| --------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `gas.json`      | Apps Script backend sources     | `target` `ES2020`, `lib` `ES2021`, `types` `["google-apps-script"]`, `declaration`, `noEmitOnError`, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`, `noUncheckedSideEffectImports`, `skipLibCheck`, `forceConsistentCasingInFileNames` |
| `web.json`      | Browser client sources          | Extends `gas.json`; `lib` `ES2021`, `DOM`, `DOM.Iterable`; `types` `[]` (no GAS types)                                                                                                                                                                                                                 |
| `test.json`     | Vitest suites                   | Extends `gas.json`; `module` `ESNext`, `moduleResolution` `bundler`, `noEmit`, `declaration` off, `types` `["node", "google-apps-script"]`                                                                                                                                                             |
| `gas-test.json` | Apps Script tests (`gas-test/`) | Extends `gas.json`; `noEmit`, `declaration` off, `types` `["google-apps-script", "gas-dev-config/gas-test/runtime"]`                                                                                                                                                                                   |
| `node.json`     | Plain JavaScript Node tooling   | `target` `ES2022`, `module` and `moduleResolution` `nodenext`, `types` `["node"]`, `allowJs`, `checkJs`, `noEmit`, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `skipLibCheck`                                                                                                  |

`gas.json` targets ES2020 because Apps Script checks syntax on push with a parser that rejects ES2021 syntax such as `||=`, `??=` and `1_000`. BigInt literals (`1n`) are rejected too and are not downleveled, so avoid them. `lib` stays ES2021, which the V8 runtime provides. `web.json` inherits the target.

Path options (`rootDir`, `outDir`, `include`, `exclude`) stay in your own files: TypeScript resolves them relative to the file that declares them, so they cannot live in the shared preset.

A library, `tsconfig.json`:

```json
{
  "extends": "gas-dev-config/tsconfig/gas.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
```

Its tests, `tsconfig.test.json`:

```json
{
  "extends": "gas-dev-config/tsconfig/test.json",
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

A gas-webapp, `tsconfig.json` for the backend and `tsconfig.frontend.json` for the browser client:

```json
{
  "extends": "gas-dev-config/tsconfig/gas.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["src/web/**/*"]
}
```

```json
{
  "extends": "gas-dev-config/tsconfig/web.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/web/**/*.ts", "src/shared/**/*.ts"]
}
```

## ESLint

`gas-dev-config/eslint` exports `gasEslint(options, ...extra)`, which returns a flat config array:

```js
// eslint.config.js
import { gasEslint } from 'gas-dev-config/eslint';

export default gasEslint();
```

### Options

All options are optional. Unknown options and invalid values throw a `TypeError` naming the option.

| Option         | Default             | Description                                                                                      |
| -------------- | ------------------- | ------------------------------------------------------------------------------------------------ |
| `preset`       | `'gas'`             | `'gas'` for Apps Script TypeScript projects, `'node'` for plain JavaScript Node tooling          |
| `ignores`      | `[]`                | Extra ignore globs, added to the preset's                                                        |
| `web`          | none                | Browser sources, linted apart from the GAS files: `{ files, tsconfig }`. Not supported by `node` |
| `web.files`    | required with `web` | Non-empty array of globs of browser (DOM) sources                                                |
| `web.tsconfig` | required with `web` | tsconfig used for type-aware linting of those files                                              |
| `cwd`          | `process.cwd()`     | Project root, used to detect `tsconfig.test.json` and `gas-test/tsconfig.json`                   |

Any further arguments are flat configs applied after the preset and before Prettier, for one-off rules.

### What the `gas` preset lints

- `@eslint/js` and `typescript-eslint` recommended rules
- `src/**/*.ts` as Apps Script files: `sourceType: 'script'` (the files share one global scope), type-aware linting with `./tsconfig.json`, unused-variable rules off
- With `web`: `web.files` are excluded from the Apps Script block and linted as browser scripts (browser globals, `web.tsconfig`, unused-variable rules off)
- `test/**/*.ts` as Node ES modules with `./tsconfig.test.json`, only when `tsconfig.test.json` exists in `cwd`
- `async` functions and `await` (including `for await`) are errors in `src/` and `gas-test/` Apps Script files, via `no-restricted-syntax`: Apps Script rejects both on push. A `no-restricted-syntax` entry in an extra config for the same files replaces this one, so repeat the selectors (`:function[async=true]`, `AwaitExpression`, `ForOfStatement[await=true]`) there. Web, `test/` and `scripts/` files are unaffected
- `gas-test/**/*.ts` as Apps Script files (`sourceType: 'script'`, the `test`, `info`, `assert` and `runGasTests` globals, type-aware linting with `./gas-test/tsconfig.json`, unused-variable rules off), only when `gas-test/tsconfig.json` exists in `cwd`; they are not Node test modules
- `scripts/**/*.js` as Node ES modules
- `dist/`, `.worktrees/` and `peer/` ignored; `peer/` holds ambient declarations that are outside the tsconfig `include`
- `eslint-config-prettier` last, so formatting rules never conflict with Prettier

The `node` preset lints `**/*.js` as Node ES modules with `@eslint/js` recommended rules, ignores `.worktrees/` and `node_modules/`, and also ends with `eslint-config-prettier`.

### Examples

A library:

```js
import { gasEslint } from 'gas-dev-config/eslint';

export default gasEslint();
```

A gas-webapp with a browser client:

```js
import { gasEslint } from 'gas-dev-config/eslint';

export default gasEslint({
  web: {
    files: ['src/web/**/*.ts'],
    tsconfig: './tsconfig.frontend.json',
  },
});
```

Node tooling (for example `gas-dev-release` itself):

```js
import { gasEslint } from 'gas-dev-config/eslint';

export default gasEslint({ preset: 'node' });
```

A one-off rule, passed as an extra flat config:

```js
import { gasEslint } from 'gas-dev-config/eslint';

export default gasEslint(
  { ignores: ['generated/**'] },
  {
    files: ['src/**/*.ts'],
    rules: { 'no-console': 'error' },
  },
);
```

## Test loader

Apps Script sources share one global scope and have no `import` or `export`, so a test cannot import them. `createGasLoader` from `gas-dev-config/test` transpiles the files once, concatenates them in load order and compiles a single `node:vm` script. Each call of the returned function evaluates it in a fresh context built from the globals you pass, so no state leaks between tests.

```ts
// test/harness.ts
import { createGasLoader } from 'gas-dev-config/test';

const load = createGasLoader({
  files: ['src/gas-logger.types.ts', 'src/gas-logger.class.ts'],
  exports: ['GasLogger'],
});

const { GasLogger } = load({ console, SpreadsheetApp, Logger });
```

| Option    | Default         | Description                                                                 |
| --------- | --------------- | --------------------------------------------------------------------------- |
| `files`   | required        | Non-empty array of source files in load order; later files see earlier ones |
| `exports` | required        | Non-empty array of global names (classes, functions, constants) to return   |
| `root`    | `process.cwd()` | Directory the `files` are resolved against                                  |

- Unknown options and invalid values throw a `TypeError` naming the option.
- A source file that cannot be read throws at creation, naming its resolved path.
- An `exports` name that the sources do not define throws when loading, naming it.
- Files are read and transpiled once, at creation; `load` only runs the compiled script.

### Load order from `package.json`

Keep the load order in one place: `gasDevConfig.loadOrder` in `package.json` (see [Config check](#config-check)). `loadOrderFiles(root?)` returns it as `src/`-prefixed POSIX paths relative to `root` (default `process.cwd()`), ready for `files`:

```ts
import { createGasLoader, loadOrderFiles } from 'gas-dev-config/test';

const ROOT = process.cwd();

const load = createGasLoader({
  files: loadOrderFiles(ROOT),
  exports: ['GasSheetDb'],
  root: ROOT,
});
```

- It throws an `Error` prefixed `loadOrderFiles:` when `package.json` cannot be read or parsed (naming its path, with the original error as `cause`), or when `gasDevConfig.loadOrder` is missing or not a non-empty array of non-empty strings.
- It does not validate the paths; `gas-dev-config check` does.

### Sharing `Error`

A vm context has its own built-ins, so an error thrown by the sources is not `instanceof Error` in the test realm. Pass the host `Error` to share it:

```ts
const { GasError } = load({ Session, console, Error });

expect(new GasError('boom')).toBeInstanceOf(Error);
```

### Typing the result

The exports are not inferred from the sources. Supply their shape as the type argument; without it the result is `Record<string, unknown>`.

```ts
import { createGasLoader } from 'gas-dev-config/test';

interface GasLoggerInstance {
  info(msg: string, meta?: Record<string, unknown>): void;
}

interface GasLoggerExports {
  GasLogger: new (options?: { level?: string }) => GasLoggerInstance;
}

const load = createGasLoader<GasLoggerExports>({
  files: ['src/gas-logger.types.ts', 'src/gas-logger.class.ts'],
  exports: ['GasLogger'],
});

export function loadGasLogger(globals: Record<string, unknown> = {}) {
  return load({ console, ...globals }).GasLogger;
}
```

The types ship as `test-loader/types.d.ts`, so consumers with `moduleResolution: bundler` (such as `gas-dev-config/tsconfig/test.json`) need no `allowJs`.

## Apps Script tests

Unit tests with fakes cannot show how Sheets, `LockService` or `PropertiesService` really behave. `gas-dev-config gas-test` builds one self-contained script from the library's optional peers, the library, a small test runtime and your tests, so it can run in Apps Script.

### Layout

```
src/                      library, in gasDevConfig.loadOrder
gas-test/
  tsconfig.json
  sheets.ts               tests: global-scope TypeScript, no import/export
```

`gas-test/*.ts` (declaration files excluded) are transpiled in name order after the runtime. `gas-test/tsconfig.json` type-checks them against `src/` and the runtime's types:

```json
{
  "extends": "gas-dev-config/tsconfig/gas-test.json",
  "include": ["../src/**/*.ts", "*.ts"]
}
```

The runtime's global declarations (`test`, `info`, `assert`, `runGasTests`, `GasTestContext`) come in through the preset's `types` entry `gas-dev-config/gas-test/runtime`, which TypeScript resolves from `node_modules`; no `/// <reference>` is needed. Add the check to `typecheck`, for example `tsc --noEmit && tsc -p gas-test/tsconfig.json --noEmit`. The `gas` ESLint preset lints `gas-test/` once `gas-test/tsconfig.json` exists.

### Configuration

`gasDevConfig.gasTest` requires `loadOrder`:

```json
{
  "gasDevConfig": {
    "loadOrder": ["gas-lock.types.ts", "gas-lock.class.ts"],
    "gasTest": {
      "scopes": ["https://www.googleapis.com/auth/spreadsheets"],
      "scriptId": "1AbC..."
    }
  }
}
```

- `scopes` is required: a non-empty array of unique strings, each starting with `https://www.googleapis.com/auth/`. They become the project's `oauthScopes`.
- `scriptId` is optional; the `GAS_TEST_SCRIPT_ID` environment variable overrides it.
- Unknown keys are rejected, naming their path.

### Writing tests

```ts
// gas-test/sheets.ts
test('writes a row', ({ prefix, spreadsheet }) => {
  const sheet = spreadsheet.insertSheet(`${prefix}rows`);
  sheet.appendRow(['a', 1]);
  assert(sheet.getLastRow() === 1, 'expected one row');
});

info('locale', ({ spreadsheet }) => spreadsheet.getSpreadsheetLocale());
```

| Global                       | Description                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `test(name, fn)`             | Registers a test; it fails when `fn` throws                                                                        |
| `info(name, fn)`             | Records context-dependent behaviour: the returned string (or thrown message) is reported as `INFO` and never fails |
| `assert(condition, message)` | Throws `Error(message)` when the condition is falsy                                                                |
| `runGasTests(spreadsheetId)` | Entry point: runs the tests in registration order                                                                  |

Each `fn` receives `{ prefix, spreadsheet }`. `prefix` is `__gt_<epochMs>_`; name every sheet a test creates with it. `spreadsheet` is resolved on first access, so tests that never read it (for example for `gas-lock`) need no spreadsheet. Resolution order:

1. the `spreadsheetId` argument of `runGasTests` (with `clasp run`, the `GAS_TEST_SPREADSHEET_ID` environment variable)
2. the `GAS_TEST_SPREADSHEET_ID` script property; this needs the `https://www.googleapis.com/auth/script.storage` scope in `gasTest.scopes`
3. `SpreadsheetApp.getActiveSpreadsheet()`

If none applies, the test that reads `spreadsheet` fails with an error naming all three. On first access, sheets named `__gt_<epochMs>_...` older than one hour (left by a run killed by the execution limit) are deleted; after the run, every sheet with the run's prefix is deleted. A cleanup error is reported as `INFO`.

The runtime logs `PASS`, `FAIL` and `INFO` lines and a summary (`<p> passed, <f> failed, <i> info in <s> s`) to the execution log, and returns the results as `@@GAS_TEST@@<base64 JSON>@@END@@`.

### Commands

With `gasTest` configured, `gas-dev-config check` requires these scripts with exactly these values. `typecheck` is a suggested addition and is only required to exist:

```json
{
  "scripts": {
    "typecheck": "tsc --noEmit && tsc -p gas-test/tsconfig.json --noEmit && echo '✓ TypeScript passed'",
    "test:gas:build": "gas-dev-config gas-test build",
    "test:gas": "gas-dev-config gas-test run"
  }
}
```

- `gas-dev-config gas-test build [--out <file>]` transpiles (without type-checking) the `loadOrder` files and `gas-test/*.ts`, bundles the `peers` with [`gas-dev-bundle`](https://github.com/yorsh-co/gas-dev-bundle) and writes the script to `--out`, by default `node_modules/.cache/gas-dev-config/gas-test.js`. The first line is a unique build stamp, because `clasp push --force` skips the push when every local file matches the remote.
- `gas-dev-config gas-test run [--keep]` builds, pushes the script to the test project with clasp, runs `runGasTests` and prints one line per result and the summary. It exits `1` when a test fails or no results come back. With `--keep`, the temporary project directory is kept and its path printed. `GAS_TEST_SPREADSHEET_ID` is passed to `runGasTests`.

> [!WARNING]
> The test project must be dedicated to this purpose: `run` replaces its whole contents, including `appsscript.json`.

### One-off setup

1. Create a dedicated Apps Script project and link it to a standard Google Cloud project (project settings), which `clasp run` requires.
2. Install clasp: `npm install -D @google/clasp`.
3. Authorize the scopes: `clasp login --extra-scopes <comma-separated gasTest.scopes>`.
4. Set `GAS_TEST_SCRIPT_ID` (or `gasTest.scriptId`) and, optionally, `GAS_TEST_SPREADSHEET_ID`.

### Running from the editor

Run `npm run test:gas:build`, paste the generated file into the Apps Script editor, select `runGasTests` and run it. The execution log shows the results.

### Limits

- Apps Script stops an execution after 6 minutes; the run's sheets are then removed by the next run's stale-sheet sweep.
- Runs share the project's script properties and spreadsheet, so do not run two at once.

## HTML build

A library that ships an HtmlService UI edits it as `.html`, `.css` and TypeScript files, but Apps Script needs it as source files that gas-dev-bundle (`.js` only), git subtree, the Vitest loader and gas-dev-release already handle. `gas-dev-config html` inlines the page and writes it as a `.ts` file that declares the whole page as one string constant, listed in `loadOrder` like any other source.

### Configuration

`gasDevConfig.html` requires `loadOrder` and the `gas` preset:

```json
{
  "gasDevConfig": {
    "loadOrder": ["generated/gas-config.ui.html.ts", "gas-config.ui.ts"],
    "html": [
      {
        "entry": "src/web/gas-config.ui.html",
        "out": "src/generated/gas-config.ui.html.ts",
        "name": "_GAS_CONFIG_UI_HTML"
      }
    ]
  }
}
```

| Key     | Value                                                                                                                                       |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `entry` | Relative POSIX path to an `.html` file (no leading `/`, no backslashes, no `.` or `..` segments). Reported as drift when it does not exist  |
| `out`   | Relative POSIX path under `src/` ending in `.ts` but not `.d.ts`. Its path relative to `src/` must be in `loadOrder`, otherwise it is drift |
| `name`  | A valid JavaScript identifier for the constant                                                                                              |

The array is non-empty, `out` and `name` are unique across entries, and unknown keys are errors naming their path.

### Rules

For each entry, the HTML is read and:

1. `<link rel="stylesheet" href="...">` with a local `href` becomes `<style>` holding the file's contents. Only `media` is kept from its attributes.
2. `<script src="..."></script>` with a local `src` becomes `<script>` holding the code, with its other attributes kept. If the `src` names a `.js` file and a `.ts` file with the same path and base name exists, the `.ts` is transpiled with the project's TypeScript (`transpileModule`, target ES2020, no module system: browser code is a classic global script) and not type-checked; run `tsc` for that, for example with `tsconfig/web.json`. Otherwise the `.js` is inlined as is. A missing file is an error naming its path, so `--check` needs no prior compile step.
3. References resolve relative to the directory of the entry. Absolute URLs (`http:`, `https:`, any other scheme such as `data:`) and protocol-relative `//` references are left untouched; a root-relative one (`/x.js`) is an error.
4. Any element with a `data-dev-only` attribute is removed with its content, for example a mock server script.
5. Inlined code containing `</script` (case-insensitive) in a script, or `</style` in a stylesheet, is an error naming the source file, because the browser would end the element there. `<?` is allowed: the page must be served with `HtmlService.createHtmlOutput()`, not as a template, so no inlined code is evaluated as a scriptlet.

Tags are found with a small scanner rather than an HTML parser. It handles attributes in any order, single, double and unquoted values, self-closing `<link />`, any tag case and multiline tags, and does not touch anything inside HTML comments, inline `<script>` and `<style>` elements or elements without a local reference.

### Limitations

- `url(...)` references in inlined CSS are not rewritten, so use absolute URLs or `data:` URIs.
- Attribute entities are not decoded.
- Root-relative references (`/x.js`) are errors, as is a direct `<script src="x.ts">`: reference `x.js` and the `.ts` source is transpiled.
- A `<script src>` body is dropped.

### The generated file

```ts
// Generated by `gas-dev-config html` from src/web/gas-config.ui.html. Do not edit.
// prettier-ignore
const _GAS_CONFIG_UI_HTML: string = "<!doctype html>...";
```

The page is escaped with `JSON.stringify`, so the output is byte-stable: LF line endings and a trailing newline. `// prettier-ignore` keeps Prettier from rewriting the quotes. Directories are created as needed.

### Commands

```
gas-dev-config html [--check]
```

- `gas-dev-config html` writes every `out` and prints `✓ Generated <out>`.
- `--check` writes nothing: it rebuilds in memory and compares with the file on disk. For each stale or missing file it prints `<out> is out of date: run gas-dev-config html` to stderr and exits `1`; otherwise it prints `✓ HTML build is up to date`.
- A build error, or `html` not configured, exits `1`.
- `gas-dev-config check` runs the same comparison when `html` is configured and reports it as drift.

### Workflow

1. Make `build:frontend` run `gas-dev-config html` after the frontend compile, for example `tsc -p tsconfig.frontend.json && gas-dev-config html`.
2. Commit the generated file: tests, Apps Script tests and type-checking load it from `loadOrder`.
3. `npm run check` fails with drift when it is stale, because `gas-dev-config check` is part of it. No script of the project is required by this feature.

## Config check

Prettier, TypeScript and ESLint are shared through their own extension mechanisms. Four things have none, so `gas-dev-config check` compares them with templates and reports the drift:

```
gas-dev-config check
```

It reads the project in the current directory and never writes. A passing run prints `✓ Config check passed`; otherwise the drift is listed per file on stderr, followed by `✗ Config check failed: N issue(s) in M file(s)`.

| Option         | Description      |
| -------------- | ---------------- |
| `-h`, `--help` | Show usage       |
| `--version`    | Show the version |

`gas-dev-config html [--check]` is described in [HTML build](#html-build).

Exit codes: `0` when the project matches, `1` on drift or an unusable `package.json`, `2` on invalid usage (a missing or unknown command, an unknown option).

### Presets

The preset is read from `package.json` and defaults to `gas`. Set it to `node` for plain JavaScript tooling:

```json
{
  "gasDevConfig": {
    "preset": "node"
  }
}
```

`loadOrder`, `peers`, `gasTest` and `html` are also read from `gasDevConfig`, for the `gas` preset only. Any other key or preset value is an error.

```json
{
  "gasDevConfig": {
    "loadOrder": ["gas-sheet-db.types.ts", "gas-sheet-db.class.ts"],
    "peers": { "gas-logger": "^1.2.0" }
  }
}
```

- `loadOrder` is the single source of truth for the order in which the global-scope files under `src/` load. Use it in tests with [`loadOrderFiles`](#load-order-from-packagejson).
  - A non-empty array of unique, non-empty strings.
  - Each entry is a relative POSIX path under `src/` (no leading `/`, no backslashes, no `.` or `..` segments) ending in `.ts` but not `.d.ts`.
  - A listed file that does not exist is reported as drift: `gasDevConfig.loadOrder: src/<entry> does not exist`.
- `peers` lists sibling libraries that are used when present, mapped to version ranges.
  - An object whose keys are package names matching `/^[a-z0-9][a-z0-9._-]*$/`.
  - Each value is a non-empty string; ranges are not parsed.
- `gasTest` configures [Apps Script tests](#apps-script-tests).
  - An object with the keys `scopes` and `scriptId`; any other key is an error naming its path.
  - `scopes` is a non-empty array of unique strings starting with `https://www.googleapis.com/auth/`; `scriptId` is an optional non-empty string.
  - It requires `loadOrder`.
- `html` configures the [HTML build](#html-build).
  - A non-empty array of objects with the keys `entry`, `out` and `name`; any other key is an error naming its path.
  - `out` and `name` are unique. Missing entry files, stale or missing generated files, and an `out` absent from `loadOrder` are reported as drift.
  - It requires `loadOrder`.
- Any of these keys with the `node` preset is an error.

### What is checked

| File                     | Rule                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.gitignore`             | Every line of the template is present. Extra lines, blanks and comments are allowed                                                                                       |
| `.prettierignore`        | Every line of the template is present. Extra lines, blanks and comments are allowed                                                                                       |
| `.github/dependabot.yml` | Equals the template (ignoring trailing whitespace and final newlines)                                                                                                     |
| `package.json` `scripts` | Required scripts have exactly the template value; present scripts must exist with any value. With `gasTest` configured, `test:gas:build` and `test:gas` are also required |

Required lines per preset:

| File              | `gas`                                   | `node`                         |
| ----------------- | --------------------------------------- | ------------------------------ |
| `.gitignore`      | `node_modules/`, `dist/`, `.worktrees/` | `node_modules/`, `.worktrees/` |
| `.prettierignore` | `node_modules`, `.worktrees`            | `node_modules`, `.worktrees`   |

Required scripts, exact values, for the `gas` preset. They assume `rimraf` and [`gas-dev-release`](https://github.com/yorsh-co/gas-dev-release) are dev dependencies of the project:

| Script          | Value                                                                                               |
| --------------- | --------------------------------------------------------------------------------------------------- |
| `clean`         | `rimraf dist`                                                                                       |
| `release`       | `gas-dev-release`                                                                                   |
| `build:format`  | `npm run check && npm run build && npm run format:dist`                                             |
| `build:release` | `npm run build:format && npm run release`                                                           |
| `lint`          | `eslint . && echo '✓ Lint passed'`                                                                  |
| `lint:fix`      | `eslint . --fix`                                                                                    |
| `format`        | `prettier . --write`                                                                                |
| `format:dist`   | `prettier ./dist --write --ignore-path .prettierignore`                                             |
| `format:check`  | `prettier . --check`                                                                                |
| `check`         | `npm run format:check && npm run lint && npm run typecheck && npm run test && gas-dev-config check` |
| `test`          | `vitest run`                                                                                        |
| `test:watch`    | `vitest`                                                                                            |

The `gas` preset also requires `build`, `build:watch` and `typecheck` to exist, with any value. With `gasTest` configured it also requires `test:gas:build` (`gas-dev-config gas-test build`) and `test:gas` (`gas-dev-config gas-test run`).

For the `node` preset the required scripts are `typecheck` (`tsc --noEmit && echo '✓ TypeScript passed'`), `lint`, `lint:fix`, `format`, `format:check`, `check`, `test` and `test:watch`, with the same values as above. No script is merely required to be present.

Add the check to your `check` script, as in the values above, so `npm run check` fails on drift.

## Dependabot

Keep dependencies current with one weekly grouped pull request for development dependencies. This is the `.github/dependabot.yml` that `gas-dev-config check` enforces, for both presets:

```yaml
version: 2
updates:
  - package-ecosystem: npm
    directory: /
    target-branch: develop
    schedule:
      interval: weekly
    groups:
      dev-dependencies:
        dependency-type: development
        patterns:
          - '*'
```

## Migrating a gas-\* project

1. Add `gas-dev-config` and the peer dependencies to `devDependencies` (see [Install](#install)).
2. Set `"prettier": "gas-dev-config/prettier"` in `package.json` and delete `.prettierrc.json`.
3. Replace the options of `tsconfig.json` and `tsconfig.test.json` with an `extends` of the matching preset, keeping `rootDir`, `outDir` and `include` local (see [TypeScript](#typescript)).
4. Replace `eslint.config.js` with `gasEslint(...)` (see [ESLint](#eslint)).
5. Remove `@eslint/js`, `typescript-eslint`, `eslint-config-prettier` and `globals` from `devDependencies`.
6. Add `.github/dependabot.yml` as shown in [Dependabot](#dependabot).
7. For plain JavaScript tooling, add `"gasDevConfig": { "preset": "node" }` to `package.json`.
8. Add `gas-dev-config check` to the `check` script and align the other scripts, `.gitignore` and `.prettierignore` with what the check reports.
9. Run `npm install`.
10. Run `npm run check`. It must pass with no source changes: `prettier --check`, `eslint` and `tsc` are clean.

## License

MIT

See the `LICENSE` file for details.

## Support

Issues and feature requests are welcome via GitHub Issues.

Maintained by [yorsh-co](https://github.com/yorsh-co).

---

> [!TIP]
> Found `gas-dev-config` useful?
> Find more Google Apps Script libraries at [github.com/yorsh-co](https://github.com/yorsh-co).
