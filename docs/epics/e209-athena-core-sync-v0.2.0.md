# E209 — Apply athena-core Sync + Cut v0.2.0

> Phase 50 — Operationalize the Dial | Size: M (12 SP) | Deps: none (builds on shipped E202 + E203)

## Problem

The plugin distribution story is presently fiction. E202 (Cycle 21) chose Path B — the template is the canonical upstream, `athena-core` is the downstream package — and shipped the sync machinery: `scripts/sync-to-plugin.sh` (one-way rsync, `--apply` flag, `athena_sync` audit event) and `make drift-check`. But nobody ran `--apply`. `make drift-check` today reports **"Drift detected: 106 file(s) differ"** across agents/commands/skills/hooks/memory — exactly the count recorded at E202 spec time. The published `athena-core` is at `v0.1.0-alpha` (plus the E203 hardening commit `5b07880` made directly in that repo) and is a full cycle behind: it has none of Cycle 21's E193–E205 work (pipeline events, effort dial, verify-panel, Workflow-native batch, design-system skill, etc.).

Anyone installing `athena-core` today gets pre-Cycle-21 athena. The decision is made; only the mechanical execution remains — and it has now been deferred far enough that the drift is a full release behind.

## Solution

Run the apply, verify, version-sync, and cut a real `v0.2.0` of the sibling `../athena-core` repo. This epic *executes* the Path-B machinery; it makes no new architectural decision.

1. **Pre-apply snapshot** — `make drift-check` to record the exact 106-file delta; confirm `../athena-core` is on a clean tree (the E203 commit `5b07880` is the baseline).
2. **Apply** — `scripts/sync-to-plugin.sh --apply` to port `.claude/agents/`, `.claude/commands/athena/`, `.claude/skills/`, `scripts/hooks/`, `scripts/memory/` into `../athena-core/`. The `athena_sync` event records `mode:apply, files_changed:N`.
3. **Reconcile E203-only changes** — the E203 hardening (registry-read loop, version-sync guard, repo-identity fix, lesson-tags.json cleanup) lives ONLY in athena-core, not the template. The sync is one-way (template → core), so it must NOT clobber those core-only files. Verify the sync manifest excludes (or the apply preserves) athena-core's `scripts/check-version-sync.sh`, the registry-read block in its `stop-verifier.sh`, and its cleaned `lesson-tags.json`. If the one-way rsync would overwrite them, the sync script's file set must be scoped to exclude athena-core-owned hardening — record any such exclusion.
4. **Install smoke test** — run athena-core's `tests/test-install-smoke.sh` (E203) against a clean temp `$HOME`: seed copy + `.installed` marker + `score.sh init` green.
5. **Version-sync + cut v0.2.0** — bump `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json` to `0.2.0`; run athena-core's `scripts/check-version-sync.sh` (E203) → exit 0; tag `v0.2.0`; commit + push the athena-core repo.
6. **Re-drift guard** — after apply, `make drift-check` from the template should report a *small, explainable* residual (only the athena-core-owned hardening files), not 106. Document the expected residual so future drift-checks aren't noisy.

## Key Files

| File (template repo) | Action |
|---|---|
| `scripts/sync-to-plugin.sh` | Reuse / Edit — run `--apply`; if needed, scope the file set to exclude athena-core-owned hardening (check-version-sync.sh, registry-read block, lesson-tags.json) |
| `Makefile` | Reuse — `make drift-check` before + after; optionally document the expected post-sync residual |
| `docs/guides/en/plugin-sync.md` | Edit — record that the v0.2.0 sync was applied + the expected residual delta |
| `docs/context/decisions.md` | Edit — record the apply + version cut + any sync-scope exclusions |
| **athena-core repo** (`/Users/MH/Documents/git_saas/athena-core/`) | Edit — receives the synced assets; version bump to 0.2.0; tag; push |

## Implementation

1. `make drift-check` → capture the 106-file list. Confirm `../athena-core` clean (HEAD = `5b07880` E203).
2. Inspect the sync file set vs the E203 athena-core-only files. If `sync-to-plugin.sh --apply` would overwrite `check-version-sync.sh` / the registry-read block / cleaned `lesson-tags.json`, narrow the sync source set (or add an exclude list) so the one-way port adds template work WITHOUT reverting E203 hardening. Add a fixture asserting the exclusion holds.
3. Run `scripts/sync-to-plugin.sh --apply`; confirm `athena_sync {mode:apply}` event emitted.
4. In athena-core: run `tests/run-all.sh` + `tests/test-install-smoke.sh` against a clean temp `$HOME` → all green.
5. In athena-core: bump the 3 version files to `0.2.0`; `scripts/check-version-sync.sh` → exit 0; `git tag v0.2.0`; commit + push.
6. Back in template: `make drift-check` → residual is only the documented athena-core-owned files (not 106). Update `plugin-sync.md` + `decisions.md`.

## Acceptance Criteria

- [ ] `scripts/sync-to-plugin.sh --apply` ran; `athena_sync` event with `mode:apply` + `files_changed` recorded in `.claude/audit.jsonl`
- [ ] athena-core's E203 hardening is preserved post-sync — `check-version-sync.sh`, the stop-verifier registry-read block, and the cleaned `lesson-tags.json` are NOT reverted by the one-way port (verified by inspection + a sync-scope fixture)
- [ ] athena-core `tests/run-all.sh` + `tests/test-install-smoke.sh` pass against a clean temp `$HOME` after the apply
- [ ] athena-core `package.json` / `plugin.json` / `marketplace.json` all read `0.2.0`; `check-version-sync.sh` exits 0; a `v0.2.0` git tag exists and is pushed
- [ ] Post-apply `make drift-check` from the template reports only the documented athena-core-owned residual (not 106 files); the expected residual is written into `plugin-sync.md`
- [ ] `decisions.md` records the apply, the version cut, and any sync-scope exclusion

## Alignment / Cross-Epic Hooks

- **Builds on E202** (shipped) — executes the `sync-to-plugin.sh --apply` machinery E202 built but never ran.
- **Builds on E203** (shipped) — must preserve the athena-core-only hardening; this epic's main subtlety is the one-way-port-without-clobber.
- **Unblocks Phase 2 athena-saas-profile** — a current athena-core (v0.2.0) with the E203 registry-read is the prerequisite for any profile plugin to host stop-rules.
- **Reuses E180 audit infra** — the `athena_sync` event already follows the JSONL pattern.

## Out of Scope

- Bi-directional sync (core → template) — Path B is one-way; reverse flow stays deferred.
- Re-arming CI for an automated drift-check (owner disabled CI) — `make drift-check` stays a local/periodic guard.
- Building the athena-saas-profile plugin — Phase 2 proper; this epic only makes core current enough to host it.
- Publishing athena-core to a marketplace/registry — version cut + tag only; distribution channel is a separate ops step.

## Provenance

- Spec source: `/athena:plan auto` Cycle 22 (2026-06-02) — `make drift-check` confirmed exactly 106 stale files; the never-run `--apply` from E202.
- Approved via `/athena:plan approve E206,E207,E208,E209,E210` on 2026-06-02 (Cycle 22).
