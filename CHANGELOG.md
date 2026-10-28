# Changelog

---

## [1.2.0] - 2026-10-28

### Added

- `gasDevConfig.loadOrder` (gas preset): source files under `src/` in load order, validated by `gas-dev-config check` (non-empty, unique, relative `.ts` paths that are not `.d.ts`); entries missing on disk are reported as drift
- `gasDevConfig.peers` (gas preset): optional sibling libraries mapped to version ranges, validated by `gas-dev-config check`
- `loadOrderFiles(root?)`, exported from `gas-dev-config/test`: returns the configured load order as `src/`-prefixed paths for `createGasLoader`

---

## [1.1.0] - 2026-10-27

### Added

- Test loader `createGasLoader({ files, exports, root })`, exported as `gas-dev-config/test`: transpiles Apps Script sources once and evaluates them in a fresh `node:vm` context per call, returning the requested globals; with option validation, clear errors for missing files and exports, and hand-written types (generic over the exports shape)
- Tests for the loader, including a TypeScript consumer type-check

---

## [1.0.0] - 2026-10-27

### Added

- Project scaffold: package manifest, Prettier, ESLint (flat config), TypeScript `checkJs` type-checking, Vitest and Dependabot for npm
- Shared Prettier config, exported as `gas-dev-config/prettier` (`singleQuote`; all other options are Prettier 3 defaults)
- Shared TypeScript configs, exported as `gas-dev-config/tsconfig/{gas,web,test,node}.json`, reproducing the options used across the gas-* projects
- Package `exports` map for the Prettier and TypeScript configs
- Tests that resolve the Prettier config from a `package.json` specifier and compile fixture projects extending each TypeScript config
- ESLint flat-config factory `gasEslint(options, ...extra)`, exported as `gas-dev-config/eslint`: `gas` preset (TypeScript GAS sources, Node ESM tests when `tsconfig.test.json` exists, `scripts/`, `peer/` and `dist/` ignored), `web` option for browser sources, `node` preset for plain JavaScript tooling, extra `ignores` and trailing configs, with option validation
- `@eslint/js`, `typescript-eslint`, `eslint-config-prettier` and `globals` as dependencies; `eslint`, `prettier` and `typescript` as peer dependencies
- Tests resolving the factory's config per preset through the ESLint API and CLI, including an equivalence check against the gas-error configuration
- `gas-dev-config check` CLI (`bin` entry) that reports drift of `.gitignore`, `.prettierignore`, `.github/dependabot.yml` and the standard `package.json` scripts against per-preset templates (`gas`, `node`, selected by `"gasDevConfig": { "preset" }`, default `gas`); read-only, exits 1 on drift and 2 on invalid usage
- Tests for the check command covering each kind of drift, presets, option validation and CLI usage
- README: requirements, installation, Prettier, TypeScript, ESLint and config check usage, Dependabot and a migration guide for gas-* projects
