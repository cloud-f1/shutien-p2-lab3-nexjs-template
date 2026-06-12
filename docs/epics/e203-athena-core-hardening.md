# E203 — athena-core v0.1.1 Hardening

> Phase 49 — Template↔Plugin Resolution | Size: M (10 SP) | Deps: E202

## Problem

The athena-core v0.1.1 registry-read hotfix that all of Phase 2 (the athena-saas-profile plugin) depends on is not built. `scripts/hooks/stop-verifier.sh` iterates only its own `scripts/stop-rules/*.sh` and never reads `~/.claude/athena-profile-registry.json`, so any profile's stop-rules would be silently ignored at commit time. The blocking exit semantics that protect template projects from rule violations do not extend to plugin-contributed rules — a registered profile can declare custom stop-rules and they will simply never fire.

`scripts/memory/lesson-tags.json` is the only file failing core's own no-stack-terms rule. Its `$comment` field still points at the old `~/.claude/template-memory` path (the correct path post-E202 is `~/.claude/athena-memory`). Its `defaults` map carries six Phase-2-deferred ghost entries — `architecture-lessons`, `architecture-patterns`, `design-handoff-pattern`, `integration-gotchas`, `mockup-contract`, `performance-insights` — each with domains referencing template-stack paths (`server/`, `client/src/`) that belong to template stack knowledge, not core. Critically, the always-injected `NEW_PROJECT_PRIMER.md` has no entry in the map at all, so `match.sh`/`inject.sh` score it as zero and the primer is unscored on every session.

Repo identity is ambiguous: `README.md` and `INSTALL.md` reference `github.com/alexhsieh/athena-core`, while the Phase 2 spec uses `cloud-f1/athena-core`, and the git remote is `cloud-f1/athena-core`. `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` `homepage`/`repository` fields carry the inconsistent `alexhsieh` slug. No test exercises the real `install.sh` path against a clean `HOME`, so the seed-copy + `.installed` marker + `score.sh` init guarantees are untested. There is also no version-sync guard: `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, and the `v0.1.0-alpha` git tag can drift silently.

## Solution

1. **Registry-read hotfix in `stop-verifier.sh`** — after running its own `scripts/stop-rules/*.sh`, read `~/.claude/athena-profile-registry.json` (skip gracefully if absent). For each registered profile entry, resolve the profile root and execute `<profile-root>/scripts/stop-rules/*.sh` with the same blocking exit semantics (exit 2 on any rule violation). Add `tests/test-profile-registry.sh` with fixtures covering: registry absent (no-op), registry present + rule passes, registry present + rule blocks.

2. **Clean `lesson-tags.json`** — remove the six ghost entries and their template-stack domains. Add a `NEW_PROJECT_PRIMER.md` entry keyed correctly to the primer file. Fix `$comment` path from `~/.claude/template-memory` to `~/.claude/athena-memory`. Resulting map covers exactly the 7 shipped core seed files.

3. **Pin repo identity** — decide on `cloud-f1/athena-core` as canonical. Update `README.md`, `INSTALL.md`, `.claude-plugin/plugin.json` (`homepage` + `repository`), and `.claude-plugin/marketplace.json` (`repository`) to use this slug consistently. Add `tests/test-install-smoke.sh`: runs `install.sh` against a temp `$HOME`, asserts seed files copied, `.installed` marker written, `score.sh` init succeeds, then cleans up.

4. **Version-sync check** — add `scripts/check-version-sync.sh`: reads the four version strings from `package.json`, `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, and `git describe --tags --abbrev=0`; exits 1 with a diff-style error if any pair mismatches. Wire into `stop-verifier.sh` as a global rule.

## Key Files

| File | Action |
|---|---|
| `scripts/hooks/stop-verifier.sh` | Edit — add registry-read loop after own rules + version-sync rule |
| `scripts/memory/lesson-tags.json` | Edit — drop ghost entries, fix `$comment` path, add PRIMER entry |
| `scripts/check-version-sync.sh` | New — 4-source version mismatch detector |
| `tests/test-profile-registry.sh` | New — 3+ fixtures for registry-read blocking semantics |
| `tests/test-install-smoke.sh` | New — clean-HOME install smoke test (complements existing `tests/test-install.sh`) |
| `.claude-plugin/plugin.json` | Edit — fix `homepage` + `repository` to `cloud-f1/athena-core` |
| `.claude-plugin/marketplace.json` | Edit — fix `repository` to `cloud-f1/athena-core` |
| `README.md` | Edit — fix repo URL slug |
| `INSTALL.md` | Edit — fix repo URL slug |

## Implementation

1. Write `tests/test-profile-registry.sh` — three fixtures (absent registry, passing rule, blocking rule) as the RED baseline; confirm the existing `stop-verifier.sh` fails the blocking-rule fixture.
2. Implement the registry-read loop in `stop-verifier.sh`: parse `~/.claude/athena-profile-registry.json` with `jq`, iterate profile roots, glob `scripts/stop-rules/*.sh`, source or exec with exit-code check; no-op if file absent or `jq` unavailable.
3. Run `tests/test-profile-registry.sh` — all three fixtures must pass (GREEN).
4. Edit `scripts/memory/lesson-tags.json` — remove ghost entries, add `NEW_PROJECT_PRIMER.md`, fix `$comment`; run the no-stack-terms rule check against the file directly to confirm it passes.
5. Write `tests/test-install-smoke.sh` — creates a `mktemp -d` fake HOME, exports it, runs `bash install.sh`, asserts seed directory exists + `.installed` present + `score.sh init` exits 0, then `rm -rf` cleans up; confirm it fails against current `install.sh` if any assertion is missing.
6. Fix any `install.sh` gaps surfaced by step 5 until the smoke test is GREEN.
7. Write `scripts/check-version-sync.sh` — read four sources, compare pairwise, emit mismatch lines, exit 1 on any diff. Test with a deliberate version bump to one file and confirm exit 1.
8. Wire `check-version-sync.sh` into `stop-verifier.sh` as a global rule; confirm a clean tree exits 0.
9. Update `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `README.md`, `INSTALL.md` to use `cloud-f1/athena-core`; search for `alexhsieh/athena-core` and confirm zero remaining hits.
10. Run the full `tests/` suite; confirm all tests pass and stop-verifier exits 0 on a clean tree.

## Acceptance Criteria

- [ ] `stop-verifier.sh` reads `~/.claude/athena-profile-registry.json` and executes each registered profile's `scripts/stop-rules/*.sh` with blocking exit semantics; absent registry is a silent no-op
- [ ] `tests/test-profile-registry.sh` passes: absent-registry (no-op), passing-rule (exit 0), blocking-rule (exit 2)
- [ ] `scripts/memory/lesson-tags.json` passes the no-stack-terms rule: no ghost entries with template-stack domains, `$comment` path is `~/.claude/athena-memory`, `NEW_PROJECT_PRIMER.md` has an entry
- [ ] `tests/test-install-smoke.sh` passes against a clean temp `$HOME`: seed files copied, `.installed` marker written, `score.sh init` exits 0
- [ ] `scripts/check-version-sync.sh` exits 1 on a deliberate single-file version bump and exits 0 when all four sources agree
- [ ] Version-sync check is wired into `stop-verifier.sh`; a mismatched version blocks commit
- [ ] `grep -r "alexhsieh/athena-core" .` returns zero hits in `.claude-plugin/plugin.json`, `.claude-plugin/marketplace.json`, `README.md`, `INSTALL.md`
- [ ] All existing `tests/` pass; `stop-verifier.sh` exits 0 on the repo's clean tree post-changes

## Alignment / Cross-Epic Hooks

- **Deps**: E202 (athena-core repo scaffolded + seeds in place; lesson-tags.json and install.sh must exist before this epic edits them)
- **Unblocks**: Phase 2 (athena-saas-profile plugin) — the registry-read hotfix is the gating blocker for any plugin's stop-rules to fire in template projects
- **Reuses**: existing `stop-verifier.sh` rule pattern (global rule, exit 2 semantics) established in E155/E157/E176/E188; `scripts/memory/score.sh` init path established in E181

## Out of Scope

- Building the athena-saas-profile plugin itself — Phase 2 proper; this epic only ensures core can host it
- Migrating the template repo to consume athena-core — covered by E202
- CI/CD pipeline for the athena-core repo (GitHub Actions) — deferred to a follow-up hardening epic
- Configurable registry path (currently hardcoded `~/.claude/athena-profile-registry.json`) — defer; single path is sufficient for v1
- Multi-version plugin compatibility checks — defer; uniform version-sync across four files is sufficient for v0.1.1

## Provenance

- Spec source: 2-workflow enhancement audit (athena-enhancement-research + ultracode-into-athena), 2026-05-30
- Approved via `/athena:plan approve E193,E194,E195,E196,E197` on 2026-05-30 (Cycle 21); Phase 48/49 rendered same day under "no limit 5 epics" override
