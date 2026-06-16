# E281 — Zod-derived OpenAPI contract (drift-proof)

## Problem

The repo migrated FastAPI → Next.js. The hand-written `docs/openapi.yaml` is now
**stale fiction**: it documents REST endpoints that no longer exist and omits the
ones that do.

- **Documents endpoints that DO NOT EXIST** — `/api/users/me`, `/api/users/me/password`,
  and `/api/admin/users/{id}/role`. These were migrated to **Server Actions**
  (`actions/user.ts` + `actions/admin.ts`), not HTTP routes. They are no longer
  reachable over HTTP.
- **Omits the real HTTP surface** — the actual route handlers (`/api/health`, the
  Stripe + ECPay billing callbacks, the cron jobs) are entirely absent.
- **Stale enums** — the `User.role` enum says `[user, admin]` but the real RBAC is a
  3-tier `pgEnum("role", ["admin","editor","viewer"])`.

A hand-maintained contract file inevitably drifts back into fiction. The user wants to
**keep** an up-to-date `openapi.yaml` as the API contract — but maintained by
**generation from Zod** (the single source of truth), so it can never drift again.

## Solution

Generate `docs/openapi.yaml` from code:

1. **Zod is the source of truth.** Register the shared schemas from `lib/validations/*`
   as named OpenAPI components via `@asteasolutions/zod-to-openapi`
   (`extendZodWithOpenApi`).
2. **Register ONLY the real HTTP route handlers** (read from `app/api/**`) — never
   invent endpoints. The Server Actions are intentionally **out of scope** of the
   OpenAPI doc: their contract is TypeScript + the shared Zod schemas, enforced at
   compile time. Auth.js routes under `/api/auth/[...nextauth]` are framework-owned
   and omitted.
3. **`buildOpenApiDocument()`** returns the OpenAPI 3.1 document from the registry
   (in memory — no file read at runtime).
4. **Two consumers of the same builder:**
   - `lib/openapi/generate.ts` (a `tsx` script) serializes to YAML → writes
     `docs/openapi.yaml`. Wired as `pnpm openapi:generate`.
   - `app/api/openapi/route.ts` (public `GET`) returns the doc as JSON, built in
     memory so it works in the standalone build.
5. **Drift gate** in `scripts/smoke.sh`: regenerate then `git diff --exit-code
   docs/openapi.yaml`. A stale committed spec fails the gate. This mechanizes "keep
   openapi.yaml latest" — regenerate, never hand-edit.

## Key Files

| File | Role |
|---|---|
| `next-app/lib/openapi/registry.ts` | `extendZodWithOpenApi(z)` once; `OpenAPIRegistry`; register Zod components + the real HTTP routes; export `buildOpenApiDocument()` (OpenApiGeneratorV31). **db-free.** |
| `next-app/lib/openapi/generate.ts` | `tsx` script → `buildOpenApiDocument()` → YAML → `../docs/openapi.yaml`. |
| `next-app/lib/openapi/registry.test.ts` | db-free unit test: asserts the real routes are present and the old fiction is gone. |
| `next-app/app/api/openapi/route.ts` | Public `GET` → `buildOpenApiDocument()` as `application/json` (in-memory build). |
| `docs/openapi.yaml` | **Generated** — never hand-edit. Regenerate with `pnpm openapi:generate`. |
| `scripts/smoke.sh` | Drift gate: regenerate + `git diff --exit-code` (skips if next-app deps absent). |
| `next-app/package.json` | `"openapi:generate"` script + `@asteasolutions/zod-to-openapi` (pinned `7.3.4`, zod-3 compatible) + `yaml` deps. |
| `docs/dev-guide/api-guide.md`, `CONTRIBUTING.md` | "API contract" doc note. |

## Implementation

### Dependencies

- `@asteasolutions/zod-to-openapi@7.3.4` — the 7.x line keeps `zod: ^3.20.2` as its
  peer dependency, which matches this repo's `zod ^3.25.76`. (8.x dropped zod-3
  support, requiring `zod ^4`.)
- `yaml` — to serialize the document (no YAML lib was a direct dependency before).

### `lib/openapi/registry.ts`

- `extendZodWithOpenApi(z)` is called **exactly once** at module load.
- A fresh `OpenAPIRegistry` is built inside `buildOpenApiDocument()` so the function
  is pure and re-callable.
- Register the shared validation schemas (`registerSchema`, `loginSchema`,
  `updateProfileSchema`, `changePasswordSchema`, `createItemSchema`,
  `updateItemSchema`) as **named components** — they document the typed-RPC contract
  shared by the Server Actions even though those actions are not HTTP paths.
- Register ONLY the **real** HTTP route handlers, matching their true shapes:
  - `GET /api/health` → `{ status: "ok", timestamp: <ISO> }`.
  - `POST /api/billing/stripe/webhook` → `Stripe-Signature` header; raw provider
    event body; `200 { received: true }`; `400` on missing/invalid signature.
  - `POST /api/billing/ecpay/return` + `POST /api/billing/ecpay/period` → ECPay
    `x-www-form-urlencoded` `CheckMacValue` callback; `200 "1|OK"` text ack;
    `400 "0|CheckMacValue invalid"` on bad signature.
  - `POST /api/billing/ecpay/renew` + `POST /api/billing/reconcile` → cron;
    require `CRON_SECRET` bearer; `200 { ok: true, ... }` / `401 { error }`.
- `buildOpenApiDocument()` returns the 3.1 doc via `OpenApiGeneratorV31`, with
  `info.title = "AI App Template API"`, `info.version` read from
  `next-app/package.json`, and an `info.description` documenting the contract model.

### `lib/openapi/generate.ts`

- `tsx` script: `buildOpenApiDocument()` → `yaml.stringify(...)` → write
  `../docs/openapi.yaml` (repo-root `docs/`).
- Wired as `"openapi:generate": "tsx lib/openapi/generate.ts"`.

### `app/api/openapi/route.ts`

- Public `GET` (no auth) returns `buildOpenApiDocument()` as JSON, built **in memory**
  from the registry (does NOT read the file at runtime → works in standalone build).

### Drift gate (`scripts/smoke.sh`)

- New step: if `next-app/node_modules` exists, run `pnpm openapi:generate` then
  `git diff --exit-code docs/openapi.yaml`. Fails the gate if the committed spec is
  stale vs the Zod source. Skips (does not fail) when next-app deps are missing.

### Conventions

- `lib/openapi/*` must NOT import `lib/db` (db-free, like the other unit-tested libs).
- `@/` alias for imports.
- Spec doc strings may be English/technical; user-facing copy stays 繁體中文.

## Acceptance Criteria

- `pnpm openapi:generate` regenerates `docs/openapi.yaml` and **replaces the stale
  content entirely** — no `/api/users/me`, no `/api/admin/users`; includes
  `/api/health` + all five billing routes.
- `GET /api/openapi` returns the same document as JSON (built in memory).
- `lib/openapi/registry.test.ts` (db-free) asserts the doc's paths contain
  `/api/health`, `/api/billing/stripe/webhook`, `/api/billing/reconcile`, and does
  NOT contain `/api/users/me` or `/api/admin/users`.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass.
- Smoke drift gate fails when `docs/openapi.yaml` is stale vs Zod.

## Out of Scope

- Documenting Server Actions as HTTP endpoints (they are typed RPC — TS + Zod
  compile-time contract, not REST).
- Auth.js `/api/auth/[...nextauth]` framework routes (framework-owned).
- Generating a client SDK from the spec.
- Runtime request/response validation against the spec.
