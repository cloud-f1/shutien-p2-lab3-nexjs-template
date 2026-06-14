# Phase 40 — Self-Review Improvements — PRD

> Product-level view of the 6 epics (E156–E161). For technical detail, see each epic spec.
> Source: self-review 2026-04-24 of the template after 156 epics landed.

## Context

After 40 phases and 156 epics, the template is mature in features but has **six specific gaps where silent failure is possible**. This phase closes those gaps. All 6 epics are independent and designed to ship as a parallel wave.

## Problem Statements

| # | Gap | Silent failure mode |
|---|-----|---------------------|
| 1 | Server can drift from `openapi.yaml` | Client types compile; runtime 400/422 on first real call |
| 2 | `alembic --autogenerate` misses rename/enum/partial-index | Migration runs in prod, data corrupts or drops |
| 3 | `[GENERALIZABLE]` lessons accumulate; no auto-promotion | Wisdom lost — stays in `debug-log.md` forever |
| 4 | Sentry installed but not wired; no structured logs; no SLI | Production incidents discovered by users, not dashboards |
| 5 | `docs/context/*.md` grows unbounded | SessionStart injection eventually overflows context window |
| 6 | Auth adapter is tech debt; no session store, no reuse detection | Can't remote-logout; token theft undetected |

## Goals

1. **Enforce** contract + migration safety **inside `@qa`** (quality authority, not deploy gate)
2. **Automate** wisdom extraction (hooks, not human memory)
3. **Observe** production (structured logs + Sentry + SLI + staging)
4. **Prune** context logs automatically, turning pruning into promotion trigger
5. **Close** all auth tech debt in a single PR (no sunset dance)

## Non-Goals

- Adding new business features (this phase is about quality + ops)
- Replacing existing agents
- Breaking Tier 0 / Tier 1 memory contracts

## Success Metrics

| Metric | Today | Target after Phase 40 |
|--------|-------|----------------------|
| Spec→server drift caught before merge | 0% | 100% (E156 Phase 2.5) |
| Migration changes reviewed for safety | 0% | 100% (E157 Phase 2.6 + @dba signoff) |
| `[GENERALIZABLE]` lessons promoted | Manual, sporadic | Auto-proposal on every 3rd tag (E158) |
| Production errors with `request_id` | 0% | 100% (E159 structured logging) |
| `docs/context/*.md` max file size | Unbounded | Per-file caps enforced by Stop hook (E160) |
| Auth adapter lines of code | ~50 | 0 (E161 deletion) |

## Epic Map

```
E156 ┬─ Contract conformance → @qa Phase 2.5 (mandatory, Stop Rule #20)
     └─ consumed by: E161 (new AuthResponse must pass contract)

E157 ┬─ Migration safety → @qa Phase 2.6 (mandatory, Stop Rule #19)
     └─ consumed by: E161 (session_table migration triggers @dba signoff)

E158 ┬─ Promotion proposals → PostToolUse hook
     └─ consumed by: E160 (archive → extract lessons → write proposal)

E159 ┬─ Sentry + structlog + /admin/sli + staging + Chronos SRE CLI
     ├─ consumed by: E161 (refresh-reuse security events go to Sentry)
     └─ consumed by: E164 (deploy confidence reads SLI regressions)

E160 ── Auto-compact via Stop hook + promotion-proposals write-side

E161 ── Auth unified response + session store + reuse detection (one-shot)
```

## Delivery Plan

- **Wave A (parallel, ~1.5 days)**: E156, E157, E158, E159, E160, E161 — all independent
- **Order-of-operations note**: If E158 lands first, E160 can skip defining `promotion-proposals/` format. Either order works.
- **PR strategy**: one PR per epic; merge order driven by CI, not by dependency (all are parallel-safe)

## Risk Register

| Risk | Mitigation |
|------|-----------|
| Schemathesis finds hundreds of drift issues on first run | Seed the first PR with a baseline `xfail` list; track burndown |
| @dba signoff becomes a bottleneck | Red-flag scanner is auto; only red flags require signoff |
| Auto-promotion hook runs on every edit (noisy) | Threshold ≥3 tags + watermark prevents spam |
| Sentry DSN missing in prod crashes startup | That's the point — fail-fast is the right default |
| Archive hook rewrites files mid-session | Only runs on `Stop` event, never during agent work |
| Auth deletion breaks existing sessions | Migration runs on startup; users get one forced re-login |

## Rollback Plan

Each epic is a self-contained PR. Rollback = `git revert` + redeploy. No cross-epic state coupling except E158/E160's shared directory (benign — empty directory does nothing).

## Story Points & Timeline

| Epic | Size | SP | Est. solo-dev |
|------|------|----|---|
| E156 | M | 5 | ~1 day |
| E157 | S | 3 | ~½ day |
| E158 | S | 2 | ~½ day |
| E159 | L | 8 | ~2 days |
| E160 | S | 2 | ~½ day |
| E161 | L | 8 | ~2 days |
| **Total** | | **28 SP** | **~6 days sequential / ~2 days parallel via `/athena:batch --phase 40`** |

Batch wave assumes green-path CI; add ~1 day contingency for Schemathesis xfail-baseline tuning on E156.

## Dogfooding Plan

This template is its own first user. Each epic must prove itself on the template before shipping:

| Epic | Dogfood trigger | Observable outcome |
|------|-----------------|---|
| E156 | Introduce a deliberate 1-line drift in `auth.py` response model | Schemathesis run in `@qa` must FAIL the build before coverage gate |
| E157 | Hand-write a migration with `DROP COLUMN` on a seed table | `migration-review.sh` flags it; `@dba` signoff blocks commit |
| E158 | Add 3 `[GENERALIZABLE]` tags to `debug-log.md` in a single session | PostToolUse hook writes `promotion-proposals/<ts>.md` within the same Stop |
| E159 | Start server with `ENVIRONMENT=production` and empty `SENTRY_DSN_SERVER` | Process refuses to start; `/admin/sli` returns 200 for superuser in dev |
| E160 | Push `debug-log.md` past its 20-entry limit | Stop hook archives surplus to `archive/YYYY-MM.md` + writes promotion proposal |
| E161 | Log in on two browsers; trigger `/auth/logout-all` from one | Other browser's next request returns 401 `session_revoked` |

A dogfood failure in QA blocks the PR regardless of test coverage — the point of these epics is to eliminate silent failure, so the gate must fire once.

## Post-Phase Retrospective Triggers

Schedule a retro exactly once, 14 days after Phase 40 merges (not after each epic). Review:

- **Contract drift**: how many PRs had schemathesis catches? Baseline xfail burndown trending to zero?
- **Migration safety**: how many `@dba` signoff requests? Any red flags that slipped through?
- **Promotion volume**: how many `[GENERALIZABLE]` lessons auto-queued vs. manually promoted? Noise vs signal ratio?
- **Observability**: did any production incident reach a user before Sentry/SLI surfaced it?
- **Archive churn**: how many auto-compact runs fired? Any false positives (valuable entries archived)?
- **Auth**: any `refresh_reuse` events? Any legitimate users hit `session_revoked`?

Write findings to `docs/context/review-findings.md` under `## Phase 40 Retro`. Failures propose follow-up epics — success evidence feeds Phase 41's E164 confidence calibration.
