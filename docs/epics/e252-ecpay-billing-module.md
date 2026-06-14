# E252 — ECPay Billing Module (Local)

**Phase:** 58 | **Status:** ⬜ | **Depends:** E249, E251

## Problem

Taiwan-local recurring billing. ECPay 定期定額 lacks Stripe's subscription / invoice /
proration abstractions — they must be self-built. (TapPay + NewebPay 藍新 deferred to Phase 57.)

## Solution

- `lib/billing/providers/ecpay.ts`: implements `PaymentProvider` using the **official ECPay
  SDK** for CheckMacValue (do NOT hand-roll the param-sort — that research claim was refuted)
  + 定期定額 params (PeriodType / Frequency / ExecTimes).
- Dual notify **Route Handlers** (raw form body):
  - `app/api/billing/ecpay/return/route.ts` (ReturnURL — first auth)
  - `app/api/billing/ecpay/period/route.ts` (PeriodReturnURL — each cycle)
  - verify CheckMacValue → idempotency via `payment_events` → respond `1|OK`.
- **ExecTimes renewal scheduler**: ExecTimes caps at 999 (D/M) / 99 (Y); a job rebuilds a new
  定期定額 order before exhaustion; next-renewal tracked in `subscriptions`.
- `reconcile`: active query against ECPay's query API (notify reliability is weaker than Stripe).
- `install-ecpay-billing` consumer skill: env (`ECPAY_MERCHANT_ID`, `ECPAY_HASH_KEY`,
  `ECPAY_HASH_IV`), sandbox testing, the renewal-scheduler cron note.

## Acceptance

- [ ] ECPay provider implements `PaymentProvider`; `BILLING_PROVIDER=ecpay` works in sandbox
- [ ] CheckMacValue verified via official SDK on both notify routes; respond `1|OK`; idempotent
- [ ] 定期定額 order created with correct PeriodType/Frequency/ExecTimes; scheduler rebuilds before cap
- [ ] reconcile via ECPay query API; webhooks are Route Handlers (raw body), not Server Actions
- [ ] packaged as `@saas/billing-ecpay` + manifest + install skill; env documented

## Research-Informed Refinements (2nd pass · `woawzys1o`)

- **No ECPay "expiring" / "limit-reached" webhook exists** (verified) — the renewal scheduler is fully
  merchant-side:
  - Persist per-subscription `ExecTimes` + `TotalSuccessTimes` in `provider_meta` (E249).
  - Update them every cycle from **PeriodReturnURL** (2nd+ auth) and reconcile via the **order query
    API** (`ExecStatus`: 0=terminated, 1=running, 2=completed). PeriodReturnURL fires once per cycle →
    missed notifications are recovered by polling the query API.
  - Remaining = `ExecTimes − TotalSuccessTimes` (no native "remaining" field). When remaining < a
    threshold (or `ExecStatus=2`), **rebuild a NEW 定期定額 order** to continue the subscription —
    handle billing-continuity + no double-charge at the cutover.
- ExecTimes caps stay (D/M ≤ 999, Y ≤ 99); the rebuild-before-exhaustion loop is the only way to model
  an open-ended subscription on ECPay.
- Contributes a docs page + iframe live-demo + API-demonstration entry to the E240 VitePress site (via manifest `docs`/`demo`).

## Official Integration Skill (use this — do NOT hand-roll)

**ECPay official AI skill:** https://github.com/ECPay/ECPay-API-Skill (`SKILL.md` + `AGENTS.md` +
`guides/` (29) + `references/` + **`test-vectors/` — 25 cross-language CheckMacValue crypto tests** +
`scripts/SDK_PHP/` (134 verified samples); covers AIO 金流, **定期定額/recurring**, CheckMacValue
SHA256/MD5, AES-128-CBC/GCM, webhooks; TS/Node among 12 languages).

- The implementer MUST install + follow this skill for CheckMacValue and 定期定額 — its
  **`test-vectors/`** are the authoritative ground truth that **resolves the refuted "param-sort"
  claim** (2nd research pass): validate the TS CheckMacValue impl against these vectors instead of
  guessing the ordering rule.
- Install into the repo's skill layer (e.g. `skills-lock.json` source `ECPay/ECPay-API-Skill`,
  `skillPath: SKILL.md`) so the agent can read it during implementation. **Touches the skill layer →
  run this epic interactively / with the `.claude` + skills permission, like E239.**
