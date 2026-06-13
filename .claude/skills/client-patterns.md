---
name: client-patterns
description: >
  DEPRECATED — describes the old Vite + React SPA `client/` stack (Zustand, React Query, MSW, axios),
  which was REMOVED in the Next.js migration. Do NOT use for current work. The frontend is now
  Next.js App Router + Server Components + shadcn in `next-app/` — use `nextjs-saas-patterns` (and
  the `next-best-practices` / `vercel-*` skills) instead. Kept only as historical reference.
---

> **⚠️ DEPRECATED (Next.js migration).** The Vite SPA `client/` this skill documents was deleted.
> For current frontend work use **`nextjs-saas-patterns`** + **`next-best-practices`**. Historical only.

# Client Patterns — AI-Coding-Template

## Cache Tiers (from cacheConfig.ts — NEVER hardcode staleTime)

```typescript
import { CACHE_TIERS } from "../cacheConfig";

CACHE_TIERS.STATIC    // { staleTime: 5min, gcTime: 30min }  — user profile, settings
CACHE_TIERS.STANDARD  // { staleTime: 30s,  gcTime: 5min  }  — lists, dashboard data
CACHE_TIERS.REALTIME  // { staleTime: 5s,   gcTime: 1min, refetchInterval: 10s } — live data
```

Usage in hooks:
```typescript
useQuery({ queryKey: ["currentUser"], queryFn: ..., ...CACHE_TIERS.STATIC });
```

## Token Storage (in-memory only — NEVER localStorage)

```typescript
import { getAccessToken, setAccessToken, getRefreshToken, setRefreshToken } from "./client";
```

- `client.ts` stores tokens in module-scoped variables
- Request interceptor attaches `Authorization: Bearer` header
- Response interceptor handles 401 with silent refresh (deduplicates concurrent 401s)

## Auth Client

The auth client uses thin typed wrappers over `AuthResponse` (the OpenAPI-generated type) — no adapter or compose layer. `auth.ts` functions are straightforward typed wrappers over the API response shape defined in `components["schemas"]["AuthResponse"]`.

Auth stays manual (typed wrappers). All future domains use the service factory.

## Service Factory (for new domains)

```typescript
import { createService } from "./services/createService";
import { itemSchema } from "../schemas/item";

export const itemService = createService("/items", itemSchema);
// Provides: .list(), .listAll(), .getById(), .create(), .update(), .remove()
```

## React Query Hooks

**Auth hooks** (manual, in `useAuth.ts`):
```typescript
useLogin()          // mutationFn: authApi.login, onSuccess: setUser + invalidate
useRegister()       // mutationFn: authApi.register, onSuccess: setUser
useLogout()         // onSettled: logout + clear cache + navigate
useCurrentUser()    // enabled: !!getAccessToken(), CACHE_TIERS.STATIC
useForgotPassword() // simple mutation wrapper
useResetPassword()  // simple mutation wrapper
```

**Generic hooks** (for service factory, in `useService.ts`):
```typescript
useServiceQuery(key, fetcher, CACHE_TIERS.STANDARD)
useServiceMutation(mutator, { invalidateKeys: [...] })
```

Mutation invalidation pattern — ALWAYS use `onSettled` (fires on both success and error):
```typescript
onSettled: () => {
  invalidateKeys?.forEach((k) => qc.invalidateQueries({ queryKey: k }));
}
```

## Zustand Store

```typescript
import { useAuthStore } from "../store/authStore";

const isAuthenticated = useAuthStore((s) => s.isAuthenticated);  // reactive
const setUser = useAuthStore((s) => s.setUser);
```

Protected routes use `useAuthStore` (reactive), NEVER raw `getAccessToken()`.

## Zod Schemas + OpenAPI Drift Detection

```typescript
import type { components } from "../api/types";
type ApiUserRead = components["schemas"]["UserRead"];

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  // ...
}) satisfies z.ZodType<ApiUserRead>;  // compile-time drift detection
```

Types file (`api/types.ts`) is auto-generated — NEVER edit manually.

## Testing

- `userEvent.setup()` — NOT `fireEvent` (misses focus/blur/keyboard bugs)
- MSW handlers in `src/tests/handlers/` — NOT inline in test files
- `onUnhandledRequest: "error"` — every network call needs a handler
- Coverage gate: **>=80%** (configured in vite.config.ts thresholds)

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

it("submits form", async () => {
  const user = userEvent.setup();
  render(<MyForm />, { wrapper: createWrapper() });
  await user.type(screen.getByLabelText("Email"), "test@test.com");
  await user.click(screen.getByRole("button", { name: /submit/i }));
  await waitFor(() => expect(screen.getByText("Success")).toBeInTheDocument());
});
```

## CSS Architecture

- Design tokens (47 CSS vars, 6 themes) live in `src/styles/themes.css` — that is the canonical token source
- Tailwind is the primary styling layer; compose `components/ui/` primitives for all new UI
- Style via **Preset axis** (`components/ui/preset.ts`) × **Theme axis** (`styles/themes.css`) — no new page-level CSS
- Use CSS custom properties, never hardcoded hex values
- **Stop-verifier Rules #21/#22 (E176)**: no new files matching `client/src/pages/**/*.css`; no new selectors added under `client/src/styles/common/`. New visuals belong in `components/ui/` Preset slots.

## Routing

Routes defined in `App.tsx`. Auth routes: `/signin`, `/signup`, `/forgot-password`,
`/reset-password`, `/verify-email`. Dashboard: `/dashboard` (protected).
`ProtectedRoute` wraps protected pages, redirects to `/signin` if not authenticated.
