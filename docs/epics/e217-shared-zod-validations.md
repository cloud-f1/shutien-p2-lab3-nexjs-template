# E217 — Shared Zod Validation Layer

**Phase:** 53 | **Status:** ✅ Implemented | **Branch:** main (inline, no PR)

## Problem

Forms (register, login, settings) had no shared schema — each form duplicated its own ad-hoc validation logic. Server Actions and client forms validated independently, allowing drift between client and server rules.

## Solution

Introduce `next-app/lib/validations/` as a shared schema layer consumed by both React Hook Form (client) and Server Actions (server):

- `lib/validations/auth.ts` — `registerSchema`, `loginSchema`, `passwordSchema`
- `lib/validations/user.ts` — `updateProfileSchema`, `changePasswordSchema`
- `lib/validations/items.ts` — `createItemSchema`, `updateItemSchema`
- `lib/validations/types.ts` — `FormState` type

All auth and settings forms updated to use `@hookform/resolvers/zod` + these schemas.

## Acceptance Criteria

- [x] `lib/validations/` exports compile without errors (`pnpm typecheck`)
- [x] Register form shows inline Zod errors on invalid input
- [x] Login form validates client-side before submission
- [x] Settings forms validate before calling Server Actions
- [x] Server Actions re-validate with the same schema (defence in depth)

## Dependencies

- E218 depends on this (RBAC needs `passwordSchema` for password change validation)
