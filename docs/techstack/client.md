# Client — React 18 Tech Stack

## Packages

| Layer | Package | Version | Purpose |
|---|---|---|---|
| Language | `TypeScript` | 5.x | Types auto-generated from openapi.yaml |
| Build | `Vite` | 7.x | Fast HMR, optimized production bundles |
| Framework | `React` | 18.x | Concurrent features, Suspense |
| HTTP | `axios` | 1.7 | Request/response interceptors for JWT |
| Global State | `zustand` | 4.x | Auth identity only, not tokens |
| Server State | `@tanstack/react-query` | 5.x | Cache tiers, background sync |
| Forms | `react-hook-form + zod` | -- | Schema-validated forms |
| Routing | `react-router-dom` | 6.x | Client-side navigation, protected routes |
| Testing | `vitest` | 4.x | Jest-compatible, Vite-native |
| Testing | `@testing-library/react` | 16.x | Component rendering + queries |
| Testing | `@testing-library/user-event` | 14.x | Real browser event simulation (not fireEvent) |
| Testing | `msw` | 2.x | Network-level API mocking |
| E2E | `playwright` | -- | Full browser automation |

**State responsibility split:**
- Zustand -> who is logged in (user identity)
- React Query -> API data cache (server state)
- `api/client.ts` -> access token (in-memory, never in any store)

## Auth Flow & Token Strategy

### Current Implementation (Adapter Pattern)

The client schemas are designed for a richer auth contract (refresh tokens, sessions).
The current fastapi-users backend returns simpler responses. An **adapter layer** in
`api/auth.ts` bridges the gap:

| Client Shape | Backend Reality |
|---|---|
| `AuthResponse { user, tokens }` | Login returns `BearerResponse`, register returns `UserRead` |
| `TokenPair { access_token, refresh_token }` | Only `access_token` + `token_type` |
| `login()` -> AuthResponse | POST form-data -> get token -> GET /users/me -> compose |
| `register()` -> AuthResponse | POST JSON -> get UserRead -> auto-login -> compose |

When the backend adds refresh token support, the adapter shims are removed and the client
works unchanged.

### Token Storage

| Token | Storage | Purpose |
|---|---|---|
| Access Token (JWT) | `api/client.ts` in-memory | Attached to every API request |
| Refresh Token | In-memory (placeholder `""`) | Ready for future backend support |

> **NEVER** store access tokens in `localStorage`. The `setAccessToken()` / `getAccessToken()` functions in `api/client.ts` use module-level variables -- cleared on page refresh by design.

### Login Flow
```
1. User submits email + password on /signin
2. authApi.login() -> POST form-data to /auth/jwt/login (username=email)
3. Backend returns { access_token, token_type: "bearer" }
4. setAccessToken(token) -> stored in memory
5. GET /users/me -> fetch user profile
6. Compose AuthResponse { user, tokens } -> return to hook
7. useLogin() hook sets authStore.user via setUser()
8. Page shows success banner (hooks don't navigate)
```

### Social Login Flow (Google/GitHub)
```
1. User clicks "Login with Google" / "Login with GitHub"
2. SocialButtons component calls authApi.getGoogleAuthUrl()
3. Backend returns { authorization_url }
4. window.location.href = authorization_url (full redirect)
5. OAuth provider -> GET /auth/google/callback?code=...
6. FastAPI exchanges code, creates/finds user, returns JWT
7. Client receives token (callback handling TBD)
```

## Cache Strategy

All React Query hooks MUST use tiers from `cacheConfig.ts`. **Never** hardcode `staleTime` inline.

```typescript
// cacheConfig.ts
export const CACHE_TIERS = {
  STATIC:   { staleTime: 5 * 60_000, gcTime: 30 * 60_000 },  // 5 min
  STANDARD: { staleTime: 30_000,     gcTime: 5 * 60_000 },    // 30s
  REALTIME: { staleTime: 5_000,      gcTime: 60_000,          // 5s
              refetchInterval: 10_000 },
} as const;
```

```typescript
// hooks/useAuth.ts -- correct usage
import { CACHE_TIERS } from '../cacheConfig';

export function useCurrentUser() {
  return useQuery({
    queryKey: ["currentUser"],
    queryFn: () => authApi.getCurrentUser(),
    enabled: !!getAccessToken(),
    ...CACHE_TIERS.STATIC,
  });
}
```

## React Query Hook Design

**Data vs UI side-effects:**
- Hooks own **data** side-effects: `setUser()`, `invalidateQueries()`
- Pages own **UI** side-effects: `navigate()`, show banners

```typescript
// hooks/useAuth.ts -- hook sets user, does NOT navigate
export function useLogin() {
  return useMutation({
    mutationFn: authApi.login,
    onSuccess: (res) => {
      setUser(res.user);
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    },
  });
}

// pages/auth/SignInPage.tsx -- page handles navigation + banners
loginMutation.mutate(data, {
  onSuccess: () => setBanner({ type: "success", message: "Signed in!" }),
  onError: (err) => setBanner({ type: "error", message: "Bad credentials" }),
});
```

## Auth Pages Structure

```
client/src/pages/auth/
  AuthLayout.tsx          Split-panel (left branding + right form)
  AuthPages.css           Full design system (Amber/Archivo)
  SignInPage.tsx           /signin
  SignUpPage.tsx           /signup
  ForgotPasswordPage.tsx  /forgot-password
  ResetPasswordPage.tsx   /reset-password
  components/
    SocialButtons.tsx     Google + GitHub OAuth buttons
    PasswordField.tsx     Show/hide toggle + strength meter
    FormBanner.tsx        Success/error notification
```

## Testing (Vitest + MSW)

**MSW** intercepts at network level. Handlers must use **full URLs** matching `baseURL`:

```typescript
const BASE = "http://localhost:8080";
http.post(`${BASE}/auth/jwt/login`, async ({ request }) => { ... });
```

**`userEvent`** (not `fireEvent`) for all user interactions:

```typescript
const user = userEvent.setup();
await user.type(screen.getByLabelText(/email/i), "test@example.com");
await user.click(screen.getByRole("button", { name: /sign in/i }));
```

```bash
cd client
pnpm run test:run          # one-shot
pnpm run test              # watch mode
pnpm run test:coverage     # coverage report (gate: >= 80%)
pnpm run test:e2e          # Playwright E2E
```
