# 9. GitHub rulesets

- Status: Accepted
- Date: 2026-11-06

## Context

Every gas-\* repository protects `develop`, `dist`, `dist-web`, the default branch and its tags with two repository rulesets, `branches` and `tags`. They were created by hand and nothing keeps them identical. The release tooling depends on them, so drift is silent until a release goes wrong. The organization is on GitHub Free, where organization-level rulesets are not available (they need Team).

## Decision

`gas-dev-config github [--fix]` compares this repository's rulesets with shared templates through `gh`, and `--fix` creates or updates them.

- Rulesets are per repository, because organization rulesets need Team.
- The templates in `templates/github/rulesets/{branches,tags}.json` are the source of truth. There is one set for both presets: every current repository already has identical rulesets, and protecting `dist`/`dist-web` in a Node repository is harmless. The command does not read `gasDevConfig` or the preset.
- It is a separate command, never a `check` rule. `check` runs in `npm run check` and CI and must stay offline, without `gh` or a token ([ADR 0008](0008-init-command.md) keeps scaffolding apart from `check` for the same reason).
- Rulesets are matched by `name`. The compared fields are `target`, `enforcement`, `conditions`, `rules` and `bypass_actors`. `conditions.ref_name.include`/`exclude` and `rules` (by `type`) are sorted before comparing, so ordering alone is not drift. A field absent from the API response is not compared: GitHub omits `bypass_actors` for callers without admin rights.
- Rulesets on GitHub that are not in the template are reported as a warning, never deleted, and do not affect the exit code. Otherwise `--fix` could never reach 0 on a repository with a legitimate extra ruleset.
- `--fix` POSTs missing rulesets and PUTs drifted ones with the template body, stops at the first failed write, and exits 0 only if every write succeeded.
- Exit codes: 0 in sync (or fixed), 1 drift or failure, 2 usage.

Rejected:

- Per-preset templates: no repository needs different rules, and two sets would drift apart.
- A `check` rule: it would make `npm run check` and CI depend on network access and a token.

## Consequences

- Rulesets in all repositories can be audited with one command and brought in line with `--fix`.
- `--fix` needs admin rights on the repository; without them it fails with a clear message.
- A repository that needs different rules must keep them in an extra ruleset, which the command leaves alone.
