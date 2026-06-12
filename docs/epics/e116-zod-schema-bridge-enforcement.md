# E116 — Zod Schema Bridge Audit & Enforcement

> Phase 31 — Integration Integrity Shield | Size: S | Deps: none
> Learned from: ai-casino-shift E162 (partial adoption still allows drift)

## Problem

The template uses `satisfies z.ZodType<ApiType>` in `client/src/schemas/auth.ts` for compile-time drift detection. But this pattern is not universally applied — admin.ts and future domain schemas may lack the bridge. Casino-shift E162 showed partial adoption still allows drift in unbridged schemas.

## Solution

Audit all existing schemas, enforce the bridge on every response schema, and add a stop verifier rule to prevent regression.

## Key Files

| File | Action |
|------|--------|
| `client/src/schemas/*.ts` | Audit + fix — add `satisfies` where missing |
| `scripts/hooks/stop-verifier.sh` | Add Rule 16 |

## Acceptance Criteria

1. Every response Zod schema uses `satisfies z.ZodType<ApiType>`
2. Rule 16 (Schema Bridge Check): warn if `z.object({` without `satisfies z.ZodType<` in schema files. Warning.
3. TypeScript compilation catches missing fields when OpenAPI changes + types regenerated
