# Client — Claude Code Instructions

> React frontend for AI-Coding-Template. Keep under 80 lines.

---

## Stack

React 18 + TypeScript + Vite 5. State: Zustand 4. Server state: React Query 5.
Forms: react-hook-form 7 + @hookform/resolvers + Zod 3. HTTP: Axios.
Routing: react-router-dom 6. Testing: Vitest + RTL + MSW 2. E2E: Playwright.

## Zod Rules

- All API request/response schemas live in `src/schemas/` as Zod schemas.
- TypeScript types are derived via `z.infer<typeof SomeSchema>` — never hand-write duplicates.
- Forms always use `zodResolver(schema)` — no manual validation logic.
- No inline type assertions (`as SomeType`) for API response data; parse through Zod instead.
- Schemas must stay in sync with `docs/openapi.yaml` (the single source of truth).
- `openapi-typescript` generates raw types to `src/api/types.ts` — Zod schemas wrap these.

## Token Storage

- Access token: **in-memory only** via `getAccessToken`/`setAccessToken` in `src/api/client.ts`.
- **NEVER** store access tokens in `localStorage` or `sessionStorage`.
- Refresh token: **`sessionStorage`** — survives page refresh, cleared on browser close.
- Silent refresh on 401 is handled by the Axios response interceptor in `client.ts`.

## React Query

- All query/mutation hooks import cache tier presets from `cacheConfig.ts`.
- **Never** hardcode `staleTime`, `gcTime`, or `refetchInterval` inline in hooks.
- Tier examples: `STATIC` (1hr), `SEMI_DYNAMIC` (15min), `SECURITY` (5min), `REALTIME` (1min).

## State Management

- Zustand for client-only state (auth user, UI flags). Stores live in `src/store/`.
- Server state belongs in React Query — never duplicate API data into Zustand.

## Testing

- **Vitest** as test runner (config in `vite.config.ts` or `vitest.config.ts`).
- Always use `userEvent` from `@testing-library/user-event` — never `fireEvent`.
- MSW handlers live in `src/tests/handlers/`. Server setup in `src/tests/setup.ts`.
- MSW server uses `onUnhandledRequest: "error"` — every network call needs a handler.
- **Playwright** for E2E tests (`test:e2e` script).
- Coverage gate: **>=80%** — CI blocks deploy if below.

## Build & Deploy

- `VITE_API_URL` is baked at **build time** via `import.meta.env` — must be set in Zeabur before build.
- Build command: `tsc && vite build`.
- Deployed on Zeabur as a separate service with its own `zbpack.json`.

## Service Layer Pattern

- **`createService(path, zodSchema)`** in `src/api/services/` — generic CRUD factory, every response Zod-validated.
- **`useServiceQuery` / `useServiceMutation`** in `src/hooks/useService.ts` — generic hook wrappers with cache tier + auto-invalidation.
- **`satisfies z.ZodType<ApiType>`** on Zod schemas — compile-time drift detection against OpenAPI-generated types.
- Auth is special (adapter pattern in `api/auth.ts`); other domains use `createService` factory.
- New domain checklist: schema → service → hook → MSW handler → tests.

## File Conventions

```
src/
  api/
    client.ts       Axios instance, token storage, interceptors
    types.ts        Auto-generated from openapi.yaml (DO NOT EDIT)
    auth.ts         Auth API (adapter pattern — special case)
    services/       Generic CRUD services (createService factory)
  schemas/
    common.ts       Shared schemas (pagination, error, message)
    auth.ts         Auth schemas with satisfies bridge
  store/            Zustand stores (authStore, etc.)
  hooks/
    useAuth.ts      Auth hooks (special — manual)
    useService.ts   Generic query/mutation hook factories
    useHealth.ts    Health hook (first factory consumer)
  components/
    ui/             Shared primitives (Button, FormField, DataTable, ...) +
                    preset.ts (theme-aware Tailwind class slots)
    DashboardLayout.tsx + .css   Dashboard shell (owned by E175 going fwd)
  pages/            Route-level pages — NO co-located *.css after E170;
                    every page composes components/ui/ primitives
  styles/
    themes.css      6 themes × 47-var contract (canonical token source)
    fonts.css       Google Fonts imports
    globals.css     @tailwind + reset + body — DO NOT edit
    common/         Legacy-trim shelf — no new rules; remaining ones
                    are gated on E173 / E178 epic deletions
  locales/
    en/             en/{common,auth,dashboard,landing,errors,primitives}.json
    zh-TW/          繁中 mirror — keys identical to en/, values translated
  tests/
    handlers/       MSW request handlers
    helpers/        Test factories (createHandlers, createWrapper)
    i18n/           Locale-switch smoke tests (E172)
    setup.ts        Global test setup (MSW server lifecycle)
```

Primitive-internal strings (aria-labels, default placeholders, fallback
messages) live in `locales/{lang}/primitives.json` and are accessed via
`useTranslation('primitives')`. Consumer-supplied props always win over
the i18n default (e.g. `searchPlaceholder ?? t('search.placeholder')`).

## Styling Axes

Three independent axes drive the look of any page:

1. **Theme** — `styles/themes.css` `[data-theme="..."]` blocks. 6 themes
   today; add via the 6-step recipe in `docs/design/css-architecture.md`.
2. **Preset** — `components/ui/preset.ts` slot maps. Default + compact
   ship today; swap globally via `setActivePreset(...)`.
3. **Primitive** — `components/ui/<Name>.tsx` React components. Pages
   compose primitives + `className` overrides; never new page CSS.

## Key Reminders

- Edit `docs/openapi.yaml` FIRST — before writing any client code for new endpoints.
- Run `pnpm generate:types` after openapi.yaml changes to regenerate `src/api/types.ts`.
- Add `satisfies z.ZodType<ApiType>` to new Zod response schemas for drift detection.
- This folder is `client/` — never rename to `frontend/`.
