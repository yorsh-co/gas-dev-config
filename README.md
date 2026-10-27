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
- Plain ESM JavaScript, no build step

## Requirements

- Node.js >= 20.10
- Peer dependencies, which stay direct dev dependencies of your project so their binaries are linked:
  - `eslint` `^10.7.0`
  - `prettier` `^3.9.6`
  - `typescript` `^5.9.3`
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

| Preset      | Use for                       | Sets                                                                                                                                                                                                                                                                                             |
| ----------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `gas.json`  | Apps Script backend sources   | `target` and `lib` `ES2021`, `types` `["google-apps-script"]`, `declaration`, `noEmitOnError`, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`, `noUncheckedSideEffectImports`, `skipLibCheck`, `forceConsistentCasingInFileNames` |
| `web.json`  | Browser client sources        | Extends `gas.json`; `lib` `ES2021`, `DOM`, `DOM.Iterable`; `types` `[]` (no GAS types)                                                                                                                                                                                                           |
| `test.json` | Vitest suites                 | Extends `gas.json`; `module` `ESNext`, `moduleResolution` `bundler`, `noEmit`, `declaration` off, `types` `["node", "google-apps-script"]`                                                                                                                                                       |
| `node.json` | Plain JavaScript Node tooling | `target` `ES2022`, `module` and `moduleResolution` `nodenext`, `types` `["node"]`, `allowJs`, `checkJs`, `noEmit`, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `skipLibCheck`                                                                                            |

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
| `cwd`          | `process.cwd()`     | Project root, used to detect `tsconfig.test.json`                                                |

Any further arguments are flat configs applied after the preset and before Prettier, for one-off rules.

### What the `gas` preset lints

- `@eslint/js` and `typescript-eslint` recommended rules
- `src/**/*.ts` as Apps Script files: `sourceType: 'script'` (the files share one global scope), type-aware linting with `./tsconfig.json`, unused-variable rules off
- With `web`: `web.files` are excluded from the Apps Script block and linted as browser scripts (browser globals, `web.tsconfig`, unused-variable rules off)
- `test/**/*.ts` as Node ES modules with `./tsconfig.test.json`, only when `tsconfig.test.json` exists in `cwd`
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

Any other `gasDevConfig` key or preset value is an error.

### What is checked

| File                     | Rule                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| `.gitignore`             | Every line of the template is present. Extra lines, blanks and comments are allowed         |
| `.prettierignore`        | Every line of the template is present. Extra lines, blanks and comments are allowed         |
| `.github/dependabot.yml` | Equals the template (ignoring trailing whitespace and final newlines)                       |
| `package.json` `scripts` | Required scripts have exactly the template value; present scripts must exist with any value |

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

The `gas` preset also requires `build`, `build:watch` and `typecheck` to exist, with any value.

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
