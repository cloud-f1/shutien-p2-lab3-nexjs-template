# E223 — Auth UI (shadcn login-01 / signup-01)

**Phase:** 54 | **Status:** 🔄 | **Depends:** none

## Problem

The login/register pages are functional (RHF+Zod+Server Actions, 19 e2e green) but use ad-hoc Card layouts. Adopt the polished shadcn `login-01` + `signup-01` block look.

## Solution

- `npx shadcn@latest add login-01 signup-01`.
- Re-skin `app/(auth)/login/_login-form.tsx` and `register/_register-form.tsx` to the block layout.
- **Keep all existing wiring** (confirmed Hybrid): RHF + zodResolver, `loginAction`/`registerUser` Server Actions, email-verification gate, Google OAuth, `noValidate`, `startTransition(formAction)`.
- Preserve field names so the existing e2e suite stays green (`name`, `email`, `password`, `currentPassword`, etc.).

## Acceptance

- [ ] Login/register visually match login-01/signup-01
- [ ] All 19 existing e2e tests still pass (selectors/field names preserved or tests updated)
- [ ] Zod validation, verify-email, Google OAuth all still work
