# 3. Claude Code handoff ignore

- Status: Accepted
- Date: 2026-11-04

## Context

Claude Code sessions can write handoff notes under `.claude/handoff/`. Like `.claude/plans/`, they are personal tooling output: generated Markdown that Prettier would reformat and that should not be committed. `.claude/settings.json` is shared project settings and can be committed, so `.claude/` as a whole cannot be ignored.

Prettier 3 reads only `.gitignore` and `.prettierignore`. It does not read `.git/info/exclude` or `core.excludesFile`.

## Decision

This extends the table in [ADR 0001](0001-claude-code-output-ignores.md) with one row.

| Path              | ESLint | Prettier | `gitignore` templates |
| ----------------- | ------ | -------- | --------------------- |
| `.claude/handoff` | no     | yes      | no                    |

- `.claude/handoff` mirrors `.claude/plans`. ESLint is unchanged because the preset does not lint Markdown.
- Both `prettierignore` templates and this repo's `.prettierignore` list `.claude/handoff`.
- The `gitignore` templates are unchanged. The path belongs in the owner's global `core.excludesFile`.
- `.claude/handoff` is ignored, not `.claude/`, so `.claude/settings.json` can still be committed.

## Consequences

- `gas-dev-config check` derives its required lines from the templates, so it now requires the `.claude/handoff` line in `.prettierignore`. Consumers add it with `check --fix`.
- Contributors who do not configure a global excludes file may see `.claude/handoff/` as untracked.
