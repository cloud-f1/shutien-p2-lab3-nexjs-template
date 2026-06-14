# E204 — Guard Integrity: Branch-Regex Fix + Fail-Open Self-Test Canary

> Phase 47 — Foundation Truth | Size: M (8 SP) | Deps: none

## Problem

The three flagship epic-safety gates in `scripts/hooks/stop-verifier.sh` **silently fail open on this repo's actual branch convention**, so the enforcement they were built to provide has never fired:

- **Rule 18** (QA Gate, E155) regex `^feat/e[0-9]+-` requires a **lowercase `e`** and **no prefix**.
- **Rules 19/20** (Migration Review E157, OpenAPI Contract E156) regex `^(MH/)?feat/e[0-9]+|^feat/E[0-9]+`: arm 1 is lowercase-`e` only; arm 2 forbids the `MH/` prefix via the `^` anchor.

Real branches are `feat/E191-cycle-integration` (capital `E` + `MH/` prefix — verified via `git branch -a`). That string matches **none** of the three regexes, and "no match" means "skip" (`exit 0`) — so the QA gate, migration-review gate, and OpenAPI-contract gate **never run on any epic branch the team actually creates**. This is the same fail-open failure **class** that the E157 early-exit bug already caused once, recurring through a different mechanism.

Compounding it: **Rule 23** (verification discipline, E188) is gated behind `STOP_RULE_23_ENABLED=1` which is set nowhere, and even if enabled it scans for `verification_check` events the audit log never receives (see E193) — so it is currently a no-op.

A guard that cannot prove it still blocks is indistinguishable from a disabled guard. This epic is the keystone of Foundation-truth: it makes the gates fire **and** makes a future fail-open impossible to ship silently.

## Solution

1. **Single shared epic-branch matcher.** Extract one helper `is_epic_branch()` (e.g. `^(.*/)?feat/[Ee][0-9]+-`) used by Rules 18/19/20 and any future epic-scoped rule, so the three regexes can never diverge again. Matches `feat/e1-x`, `feat/E191-x`, `feat/E191-x`, `claude/feat/E12-x`.
2. **Fail-open self-test canary.** New `scripts/hooks/tests/test-stop-verifier-canary.sh` + a `make guard-selftest` target (and/or a `stop-verifier.sh --self-test` flag) that runs the verifier against known-violating fixture branches + working trees and asserts `exit 2` for **every** blocking rule. Includes a fixture asserting `feat/E191-x` with `impl=✅ / qa=⬜` trips Rule 18, and migration/openapi fixtures on `feat/E{n}` trip Rules 19/20.
3. **Resolve Rule 23's fate** (sequenced after E193 lands the audit-event flow): either enable it (`STOP_RULE_23_ENABLED=1` + wire `audit-emit-verification.sh` into `/athena:qa`) or retire the pilot. Decision recorded in `scripts/hooks/CLAUDE.md`.

## Key Files

| File | Action |
|---|---|
| `scripts/hooks/stop-verifier.sh` | Edit — add `is_epic_branch()` helper; repoint Rules 18/19/20 to it |
| `scripts/hooks/tests/test-stop-verifier-canary.sh` | New — fail-open canary asserting the verifier still BLOCKS on every epic-branch spelling (Rule 18 fixtures; Rules 19/20 share the matcher) |
| `Makefile` | Edit — add `guard-selftest` target (runs the canary) |
| `scripts/hooks/CLAUDE.md` | Edit — document the canary, the branch convention, and Rule 23's resolved status |

## Implementation

1. Write the canary FIRST (red): fixture branch `feat/E191-x` + `epic-progress.md` showing `impl=✅ qa=⬜` → assert Rule 18 `exit 2`. It will FAIL against the current regex, proving the bug.
2. Add `is_epic_branch()` to `stop-verifier.sh`; repoint Rules 18/19/20; canary goes green.
3. Extend the canary across every epic-branch spelling (lowercase/capital E; `MH/` and `claude/` prefixes) plus non-epic branches that must NOT fire, using the existing `BRANCH_OVERRIDE`/`EPIC_PROGRESS_PATH` test-injection env vars. (Broader per-rule fixtures for the other blocking rules — localStorage, fireEvent, page CSS, etc. — are a follow-on; this epic closes the branch-regex fail-open class for the epic-safety gates.)
4. Wire `make guard-selftest`; run it; confirm green.
5. After E193 lands audit-event flow, decide Rule 23: enable or retire; document in `scripts/hooks/CLAUDE.md`.

## Acceptance Criteria

- [x] `is_epic_branch()` exists and is the SINGLE source of epic-branch detection used by Rules 18/19/20
- [x] `feat/E191-x` with `impl=✅ qa=⬜` trips Rule 18 (`exit 2`) — was `exit 0` before (canary)
- [x] Rules 19/20 use the same `is_epic_branch()` matcher, so they fire on `feat/E{n}` too (shared-matcher fix; end-to-end migration/openapi fixtures are a follow-on)
- [x] `test-stop-verifier-canary.sh` asserts `exit 2` on every epic-branch spelling (5 epic forms) and `exit 0` on 3 non-epic branches; runs in <2s
- [x] `make guard-selftest` runs the canary + all blocking-rule suites and fails the build on any fail-open
- [x] Lowercase `feat/e{n}-` and prefixed `claude/feat/E{n}-` both still match (back-compat) — verified in canary + existing Rule-18 suite (8/8)
- [ ] Rule 23 status resolved + documented in `scripts/hooks/CLAUDE.md` (deferred to E193 — depends on the audit-event flow)

## Alignment / Cross-Epic Hooks

- **Keystone of Phase 47 Foundation-truth** — a gate that fails open undermines every truth claim the rest of the plan rests on.
- **Sequences with E193** — Rule 23's enable/retire decision depends on E193 fixing the audit-event flow (`verification_check` events must actually reach `.claude/audit.jsonl`).
- **Prevents the E157 failure class structurally** — the canary makes "a silently disabled gate" impossible to ship.
- **Reuses** the existing `scripts/hooks/tests/` harness + `BRANCH_OVERRIDE`/`AUDIT_LOG_PATH`/`RULE_TO_LESSON_PATH` injection env vars.

## Out of Scope

- Migrating the 23 inline rules to a declarative rule manifest (separate later-phase item) — this epic only fixes the branch matcher + adds the canary.
- Re-enabling GitHub Actions CI (owner disabled it deliberately 2026-05-20) — orthogonal.
- The `pre-bash-guard.sh` destructive-SQL false-positive (already fixed as a quick-fix in commit `c9f8a47`).

## Provenance

- Spec source: Cycle 21 plan-completeness audit (2026-05-30) — the #1 missing part found by the hooks deep-dive that had failed in the first research pass.
- Approved via `/athena:plan` (AskUserQuestion gate) on 2026-05-30 (Cycle 21 addendum) — "Add as Phase 47 epics".
