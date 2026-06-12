# E113 — MSW Handler Zod Factory

> Phase 31 — Integration Integrity Shield | Size: M | Deps: none
> Learned from: ai-casino-shift E161 (coverage paradox) + E164 (MSW factory)

## Problem

MSW handlers in `client/src/tests/handlers/` use hardcoded response objects (e.g., `TEST_USER` in auth.ts, `MOCK_ADMIN_HEALTH` in admin.ts). These are manually maintained and can drift from Zod schemas. Casino-shift E161 proved: 971 server tests + 691 client tests all green, but dashboard crashed in production because MSW mocks matched component expectations, not actual API shapes. **High coverage does not equal integration validity.**

## Solution

Create `createMockFromSchema(zodSchema)` factory that auto-generates valid mock data from Zod schemas. Schema change = mock change automatically. Also create `createHandlerFromSchema(method, path, zodSchema)` that produces MSW handlers whose responses are always schema-valid.

## Key Files

| File | Action |
|------|--------|
| `client/src/tests/helpers/mockFactory.ts` | New — factory functions |
| `client/src/tests/handlers/auth.ts` | Migrate — use factory |
| `client/src/tests/handlers/admin.ts` | Migrate — use factory |
| `client/src/schemas/*.ts` | Read — source of truth for mock shapes |

## Acceptance Criteria

1. `createMockFromSchema(schema)` produces object passing `schema.parse()`
2. Supports overrides: `createMockFromSchema(userSchema, { email: "x@y.com" })`
3. `createHandlerFromSchema("get", "/path", schema)` returns MSW handler with valid response
4. All existing handlers migrated — no hardcoded response literals remain
5. Test: adding a schema field auto-includes it in factory output
6. Test: handler returning non-schema data throws at test time (fail-fast)

## Reference

- ai-casino-shift E164: `createMockFromSchema(zodSchema)` + MSW response validation
- `@anatine/zod-mock` or custom faker for generating valid Zod data
