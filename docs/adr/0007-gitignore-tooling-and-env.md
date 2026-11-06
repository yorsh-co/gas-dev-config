# 7. Gitignore for tooling output and `.env`

- Status: Accepted
- Date: 2026-11-06

## Context

`gas-dev-deploy` writes `GAS_*` values and OAuth secrets to `.env` and refuses to run when `.env` is not ignored. Claude Code output under `.claude/` is now used beyond a single owner, so relying on each contributor's global `core.excludesFile` no longer holds.

## Decision

This supersedes the "`gitignore` templates unchanged" decision in [ADR 0001](0001-claude-code-output-ignores.md) and [ADR 0003](0003-claude-handoff-ignore.md).

| Path                 | `gitignore` templates |
| -------------------- | --------------------- |
| `.claude/worktrees/` | yes                   |
| `.claude/plans/`     | yes                   |
| `.claude/handoff/`   | yes                   |
| `.env`               | yes                   |

- Entries take a trailing `/` for directories, matching `node_modules/` and `.worktrees/`.
- `.env` is an unconditional line in both the `gas` and `node` presets. A project without a `.env` loses nothing.
- Rejected: requiring `.env` only when `gas-dev-deploy` is a dependency, and a `gasDevConfig` flag. Both add a config key or a conditional `--fix` line for no benefit, and would change [ADR 0002](0002-check-fix-ignore-files.md).

## Consequences

- `gas-dev-config check` now requires the four lines in `.gitignore`. Consumers add them with `check --fix`.
- Ignore lines are matched exactly, so an equivalent pattern (for example `/.env`, `.env*`, or `.claude/`) is still reported and `--fix` appends the exact line.
- This is a minor version bump, following the precedent of ADR 0001.
- The global `core.excludesFile` is no longer needed for these paths.
