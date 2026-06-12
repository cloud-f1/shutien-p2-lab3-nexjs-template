# E142 — Error Budget Tracking

> Phase 33 — Observability & Reliability | Size: M | Deps: E131 (structlog)

## Problem

No automated way to track 5xx/total request ratio against an SLO target. Teams lack visibility into whether reliability is degrading, and have no signal for when to freeze feature work and focus on stability.

## Solution

Shell script that parses structlog JSON logs and calculates error budget consumption against a configurable SLO. Paired with documentation explaining the error budget concept and integration points.

## Key Files

| File | Action |
|------|--------|
| `scripts/checks/check-error-budget.sh` | New — parse structlog JSON, calculate error budget |
| `docs/ERROR_BUDGET.md` | New — concept guide + usage + SLO targets |
| `Makefile` | Add `error-budget` target |

## Acceptance Criteria

1. Script parses structlog JSON logs for `request_completed` events with `status_code`
2. Calculates success rate = (total - 5xx) / total * 100
3. Compares against configurable SLO (default 99.5%)
4. Exits 0 when within budget, exits 1 when SLO violated
5. Handles edge cases: missing file, no requests found
6. `make error-budget LOG=<file>` works
7. Documentation covers concept, usage, escalation, and per-environment targets
