# 4. Peers sync

- Status: Accepted
- Date: 2026-11-04

## Context

Each library keeps copies of its peers' type declarations in `src/internal/<peer>.peer.types.d.ts`. They were copied by hand, and each copy carries an ` * @version` line, so every peer patch release changed the line in every consumer even when the declared surface was identical. Copies also drifted from the released peer.

## Decision

`gas-dev-config peers sync [--check]` writes the copies from the peers' releases.

- Source: `peer/<peer>.peer.types.d.ts` at the source tag `vX.Y.Z` of `https://github.com/yorsh-co/<peer>.git`, not gas-dev-bundle's `dist/vX.Y.Z` tags.
- Version: `semver.maxSatisfying` over the `vX.Y.Z` tags, keeping only tags that are strictly valid semver, against the range in `gasDevConfig.peers`.
- Fetch: a shallow `git fetch` of the tag into a temporary repository, spawned without a shell and with `GIT_TERMINAL_PROMPT=0`.
- Output: the canonical file with the ` * @version` line removed, otherwise byte-identical.
- `--check` is read-only and exits 1 on any difference. It needs the network, so it is not part of `npm run check`; consumers add `peers:sync` and `peers:check` scripts.
- Only the listed peers are synced; stray peer files for unlisted peers are not reported.

## Consequences

- Peer repositories must keep `peer/<peer>.peer.types.d.ts` at every `vX.Y.Z` tag.
- Peer patch releases no longer churn consumers when the surface is unchanged.
- `peers:check` needs network access and is run separately from `check`.
