# E110 — Pre-Deploy Gate Hardening

> Phase 30 — Docker DevOps Maturity | Size: M | Deps: none
> Learned from: ai-finance-management 11-gate `scripts/pre-deploy-gates.sh`

## Problem

`scripts/doctor-production.sh` currently checks 4 categories (secrets, database, email, OAuth). The finance sibling project has 11 pre-deploy gates including migration drift, DEBUG enforcement, and localhost detection — gates that have prevented real production incidents.

## Solution

Add 5 new gate categories to `scripts/doctor-production.sh`:

| # | Gate | Check |
|---|------|-------|
| 5 | Migration drift | `cd server && uv run alembic check` — fails on pending/diverged migrations |
| 6 | DEBUG enforcement | `DEBUG` must be `false` or unset — fails if `true` |
| 7 | No localhost origins | `ALLOWED_ORIGINS_STR` must not contain `localhost` |
| 8 | Secret key length | `SECRET_KEY` must be >= 32 characters |
| 9 | Client build | `cd client && pnpm build` must succeed without errors |

Total: 9 check categories (4 existing + 5 new).

## Key Files

| File | Action |
|------|--------|
| `scripts/doctor-production.sh` | Add 5 new gate categories |

## Acceptance Criteria

1. Gate: `alembic check` runs and fails on pending/diverged migrations
2. Gate: DEBUG env var must be `false` (or unset) — fails if `true`
3. Gate: `ALLOWED_ORIGINS_STR` must not contain `localhost`
4. Gate: `SECRET_KEY` length >= 32 characters
5. Gate: `cd client && pnpm build` succeeds without TypeScript/Vite errors
6. Non-zero exit code if any gate fails; summary shows X/Y checks passed
7. Each new gate has a clear "Fix:" remediation hint matching existing style

## Reference

- ai-finance-management `scripts/pre-deploy-gates.sh`: 11 gates including alembic check, DEBUG=false, no-localhost, client build
- Existing `scripts/doctor-production.sh`: 4 categories to extend (don't rewrite)
