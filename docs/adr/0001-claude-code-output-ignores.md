# 1. Claude Code output ignores

- Status: Accepted; gitignore column superseded by [ADR 0007](0007-gitignore-tooling-and-env.md)
- Date: 2026-11-03

## Context

Claude Code writes personal tooling output under `.claude/`: worktrees in `.claude/worktrees/` and plan files in `.claude/plans/`. ESLint and Prettier walk into these directories, so they lint and reformat copies of the project and generated Markdown. `.claude/settings.json` is shared project settings and can be committed, so `.claude/` as a whole cannot be ignored.

Prettier 3 reads only `.gitignore` and `.prettierignore`. It does not read `.git/info/exclude` or `core.excludesFile`.

## Decision

| Path                | ESLint | Prettier | `gitignore` templates |
| ------------------- | ------ | -------- | --------------------- |
| `.claude/worktrees` | yes    | yes      | no                    |
| `.claude/plans`     | no     | yes      | no                    |

- Both ESLint presets ignore `.claude/worktrees/**`. `.claude/plans/` stays out of ESLint because the preset does not lint Markdown.
- Both `prettierignore` templates and this repo's `.prettierignore` list `.claude/worktrees` and `.claude/plans`.
- The `gitignore` templates are unchanged. Both paths are personal tooling output and belong in the owner's global `core.excludesFile`.
- `.claude/` is not ignored as a whole, and `.worktrees/` stays where it appears.

## Consequences

- `gas-dev-config check` derives its required lines from the templates, so it now requires both `.prettierignore` lines. Consumers must add them on upgrade, which is a minor bump (1.7.0).
- Contributors who do not configure a global excludes file may see `.claude/worktrees/` and `.claude/plans/` as untracked.
- Trigger: if other contributors adopt Claude Code, add `.claude/worktrees/` to the `gitignore` templates.
