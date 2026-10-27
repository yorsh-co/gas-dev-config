# Changelog

---

## [Unreleased]

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
