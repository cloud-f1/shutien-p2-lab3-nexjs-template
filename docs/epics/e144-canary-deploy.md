# E144 — Canary Deployment Guide

> Phase 36 — Deploy Maturity | Size: S (3 SP) | Deps: none

## Problem

No documented strategy for safe, incremental production rollouts. Deploying all-or-nothing increases blast radius when a bad release ships.

## Solution

Create `docs/CANARY_DEPLOY.md` — a runbook covering traffic splitting on both Zeabur and Cloud Run, with monitoring checklists, rollback triggers, and error budget integration.

## Key Files

| File | Action |
|------|--------|
| `docs/CANARY_DEPLOY.md` | New — canary deployment guide (~80 lines) |
| `docs/epics/e144-canary-deploy.md` | New — this spec |
| `docs/epics/EPIC_INDEX.md` | Update — mark E144 steps |

## Acceptance Criteria

1. Guide covers both Zeabur and Cloud Run canary strategies
2. Cloud Run section includes `gcloud` CLI commands for traffic splitting
3. Gradual rollout schedule table with concrete percentages and timing
4. Monitoring checklist with quantitative thresholds (error rate, latency, memory)
5. Rollback triggers clearly defined with automatic escalation criteria
6. Forward reference to `docs/ERROR_BUDGET.md` (E142) for SLO integration
7. Quick reference section with copy-paste commands
8. All code blocks properly fenced with language hints
