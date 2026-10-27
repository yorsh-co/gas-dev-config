# Changelog

---

## [Unreleased]

### Added

- Project scaffold: package manifest, Prettier, ESLint (flat config), TypeScript `checkJs` type-checking, Vitest and Dependabot for npm
- Shared Prettier config, exported as `gas-dev-config/prettier` (`singleQuote`; all other options are Prettier 3 defaults)
- Shared TypeScript configs, exported as `gas-dev-config/tsconfig/{gas,web,test,node}.json`, reproducing the options used across the gas-* projects
- Package `exports` map for the Prettier and TypeScript configs
- Tests that resolve the Prettier config from a `package.json` specifier and compile fixture projects extending each TypeScript config
