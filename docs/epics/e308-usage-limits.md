# E308 — Wire Real Usage Limits into Pricing Tiers

> Phase 72 · billing · metering (builds on E301)
> Status: ⬜ pending

## Problem

E301 shipped the usage-metering foundation (`usage_events` + `recordUsage` + `getCurrentMonthUsage` + a billing `<Progress>` bar), but pricing tiers carry **no per-metric limit**, so the panel shows `current / ∞` and the Progress bar never renders. The metering plumbing exists with nothing to meter against.

## Solution

1. **Plan limits** — add a per-metric limit to the plan/pricing config (the JSON-configurable pricing from E274a, or the `plans` table). Shape: `limits: { api_request: 10000, ... }` (null/absent = unlimited).
2. **Resolve the active limit** — a helper `getPlanLimit(plan, metric)` (pure, db-free, tested) that reads the user's current plan's limit for a metric.
3. **Billing panel** — render `{current} / {limit}` + the `<Progress value={current/limit*100}>` bar when a finite limit exists; keep `current / ∞` for unlimited. Add a near-limit warning state (≥80% → amber, ≥100% → red) via existing tokens.
4. **(Optional, gated) soft enforcement** — `assertWithinLimit(metric)` helper the API route can call; on overage return a 429-style error. Ship the helper + a unit test; wire it into `app/api/v1/items` behind a comment so forks opt in. Do NOT hard-block by default.

Migration only if a `limits` column is added to `plans`; prefer the JSON pricing config (no migration) if that's where tiers live — **inspect first**. If a migration is needed it is **0010**.

## Key Files

- `next-app/lib/billing/*` or the pricing config (inspect where tiers are defined) — add limits
- `next-app/lib/usage-utils.ts` — `getPlanLimit` + `assertWithinLimit` (+ tests in `usage-utils.test.ts`)
- `next-app/app/(dashboard)/dashboard/system/_billing-panel.tsx` — render limit + Progress + warning
- `next-app/app/api/v1/items/route.ts` — opt-in overage guard (commented fork reference)
- migration `0010` only if a `plans.limits` column is added

## Acceptance Criteria

- [ ] Pricing tiers declare per-metric limits (config or column)
- [ ] Billing panel shows `current / limit` + Progress bar for finite limits; `current / ∞` otherwise
- [ ] Near-limit (≥80%) + over-limit (≥100%) visual states
- [ ] `getPlanLimit` + `assertWithinLimit` unit-tested (≥80%)
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` pass; `db:test-migrate` if a migration was added
- [ ] No hard-enforcement by default (opt-in only)

## Out of Scope

- Stripe metered-billing API push
- Usage history charts · overage emails
