# E205 — Doc-Truth Reconciliation: Make the Docs Match Disk

> Phase 47 — Foundation Truth | Size: M (8 SP) | Deps: none

## Problem

The repo's docs assert several things that disk contradicts. For a teaching/showcase template, a confidently-wrong doc is worse than a missing one — it misleads every reader and every future planning pass. The completeness audit verified the following drift:

1. **Domains claimed live, but empty.** Project memory + `docs/PRD.md` §3.3/§5 describe `billing/ teams/ places/ portfolios` as "auto-discovered" live domains. On disk `server/app/domains/` holds only `__init__.py` (verified). The E22 registry exists but discovers nothing.
2. **Test-count drift across three sources.** PRD §3.8/§6 says 216/221; `docs/context/test-status.md` says 383 client; `session-summary.md` says 515 / 86 files (closest to empirical). PRD is ~2 months stale (dated 2026-03-21, pre-athena-pivot).
3. **Roster-count drift.** `dashboard.md` example says agents:9 / commands:17 / skills:8; `CLAUDE.md` says 11/23/8; reality is **11 agents** (after E204-adjacent `domain-expert.md.tmpl` deletion) / **23 commands** / **11 skills**. None of the three is currently correct.
4. **Security posture oversold.** PRD §3.6 claims "Role-based access control + team scoping + ownership checks." There is no `teams` domain and no tenant column on the live schema — the product ships **superuser-vs-user only** (`admin.py`).
5. **Dangling Stripe dependency.** `server/pyproject.toml` declares `stripe>=14.4.1` and `STRIPE_*` config keys exist, but nothing wires it (no billing endpoint/domain; billing migration quarantined in `_legacy_migrations/`). A false "billing supported" signal.
6. **CI advertised but disabled.** CLAUDE.md/PRD advertise a hard "≥80% coverage gate blocks deploy," but all GitHub Actions are `workflow_dispatch`-only since 2026-05-20 (commit `c7015b6`).

Plus dead write-back logs flagged alongside: `review-log.md` (55KB, stale since 2026-03-30), `evaluation-log.md` + `autopilot-log.md` (scaffolds with headers but no data entries), `test-status.md` (stale 2026-05-03), and two divergent epic-creation paths (`plan.md` approve vs `qa-report.md` Phase 4).

## Solution

Make every claim match disk (this is the doc-truth half of Foundation-truth; pairs with E193 instrumentation + E204 guard integrity):

1. Correct project memory + PRD §3.3/§5 to state domains are **empty example scaffolds**, not live/auto-discovered.
2. Reconcile test counts to the empirical values everywhere (PRD/CLAUDE/session-summary/test-status). Prefer making `test-status.md` self-generated from `pytest`/`vitest` output (coordinate with E196's render-from-source approach).
3. Fix roster counts; make `dashboard.md` self-count via file globs instead of a hardcoded example.
4. Downgrade PRD §3.6 to the superuser-vs-user reality; move RBAC/team-scoping to a clearly-labelled "example/roadmap" note.
5. Decide Stripe: remove the dangling dep + `STRIPE_*` keys, **or** mark them an explicit, labelled deferred example. Record the decision.
6. Document the CI posture honestly (manual-trigger-only since 2026-05-20) in CLAUDE.md/PRD; note re-enable is the owner's call (do NOT silently re-arm).
7. Retire/reconcile the dead logs (`review-log.md` → archive; empty scaffolds → remove + re-scaffold on first write); consolidate the two epic-creation paths behind one shared writer.

## Key Files

| File | Action |
|---|---|
| `docs/PRD.md` | Edit — §3.3/§5 domains-are-examples; §3.6 superuser-only; §3.8/§6 test counts; §3.9 CI posture; §4.1/§4.2/§4.3 roster counts |
| project memory (`MEMORY.md` / Tier-1 notes) | Edit — domains empty; correct counts |
| `CLAUDE.md` | Edit — roster counts; CI posture note |
| `docs/context/test-status.md` | Edit/regenerate — empirical counts (or self-generate) |
| `.claude/commands/athena/dashboard.md` | Edit — self-count via globs; drop the stale 9/17/8 example |
| `server/pyproject.toml` + config | Edit — Stripe decision (remove or label deferred) |
| `docs/context/{review-log,evaluation-log,autopilot-log}.md` | Archive/retire the dead logs |

## Implementation

1. Inventory every count/claim with a quick `grep` sweep (domains, test counts, roster, RBAC, Stripe, CI) → build the truth table from disk.
2. Patch PRD + CLAUDE.md + project memory to match; cross-check no source still disagrees.
3. Regenerate/repair `test-status.md`; make `dashboard.md` self-counting.
4. Take + record the Stripe decision; take + document the CI-posture note.
5. Archive `review-log.md`; remove the empty scaffolds; fold the epic-creation paths behind one shared writer.
6. Final `grep` assertion sweep proves zero remaining contradictions.

## Acceptance Criteria

- [ ] No doc claims `billing/teams/places/portfolios` are live/auto-discovered (grep clean); domains labelled "empty example scaffolds"
- [ ] Test counts agree across PRD, CLAUDE.md, session-summary, test-status.md (empirical values)
- [ ] Roster counts correct everywhere (11 agents / 23 commands / 11 skills); `dashboard.md` self-counts via globs
- [ ] PRD §3.6 reflects superuser-vs-user reality; RBAC/team-scoping clearly labelled example/roadmap
- [ ] Stripe decision made + recorded (removed, or labelled explicit deferred example)
- [ ] CI manual-only posture documented in CLAUDE.md/PRD (no silent re-arm)
- [ ] `review-log.md` archived; `evaluation-log.md`/`autopilot-log.md` empty scaffolds removed; single epic-creation writer
- [ ] A `grep` assertion sweep (committed as a check) finds zero remaining doc-vs-disk contradictions

## Alignment / Cross-Epic Hooks

- **Doc-truth half of Foundation-truth** — pairs with E193 (instrument the substrate) and E204 (make gates fire). Together they make "athena's claims are true" actually hold.
- **Coordinates with E196** (state-file truth) — both move toward generated-from-source docs; share the self-counting/render approach.
- **Scope verdict ATHENA-ONLY** — this epic corrects *claims about* the product; it does NOT build product features (multi-tenancy/billing stay out of scope per the audit).

## Out of Scope

- Building any product feature the docs currently oversell (multi-tenancy, billing, team scoping) — correcting the claim is in scope; implementing the feature is not.
- Re-enabling CI (owner's deliberate call) — this epic only *documents* the posture.
- Promoting/curating Tier 0 memory (separate `/athena:promote` flow).

## Provenance

- Spec source: Cycle 21 plan-completeness audit (2026-05-30) — product-scope scan + dropped-opportunity critic; scope verdict ATHENA-ONLY (product gaps are doc-truth, not missing features).
- Approved via `/athena:plan` (AskUserQuestion gate) on 2026-05-30 (Cycle 21 addendum) — "Add as Phase 47 epics".
