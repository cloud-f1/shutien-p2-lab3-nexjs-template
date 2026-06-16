# E291 — Public REST API (authenticated by E267 API keys)

## Problem

The E267 API Keys settings panel mints `sk_<prefix>_<secret>` keys (prefix + SHA-256
hash stored, `scopes` column, `lastUsedAt`), and `lib/api-keys.ts` exposes
`verifyApiKey()` to resolve a bearer key → owning user. But `verifyApiKey` has **zero
callers** — the keys authenticate nothing. There is no public HTTP surface a key holder
can call, so the whole feature is decorative.

## Solution

Add a real authenticated public REST endpoint that the issued keys unlock:

- `app/api/v1/items/route.ts`
  - `GET /api/v1/items` — list the key-owner's items (requires the `read` scope).
  - `POST /api/v1/items` — create an item `{ title }` for the key-owner (requires `write`).
- Auth: `Authorization: Bearer sk_..._...` → `verifyApiKey()` resolves the owning
  `userId` (401 if missing/invalid). Scope enforced from `apiKeysTable.scopes`
  (403 if the key lacks the required scope). All queries are scoped to the resolved
  `userId`. `lastUsedAt` is bumped on every successful verify (inside `verifyApiKey`).
- POST body is validated with the shared Zod `createItemSchema` (`lib/validations/items`).
- The **pure, db-free** bearer-extraction + scope-check logic lives in
  `lib/api-auth-utils.ts` (`extractBearer`, `hasScope`, `requireScope`) with a unit test
  — keeping it out of the route handler so it is testable without a DB.
- Registered in the E281 OpenAPI contract: an `apiKey` (http bearer) security scheme +
  `GET`/`POST /api/v1/items` with request/response/401/403, then `docs/openapi.yaml`
  regenerated via `pnpm openapi:generate`. The coverage guard
  (`lib/openapi/coverage.test.ts`) requires every `app/api/**` route be registered.

## Key Files

- `lib/api-auth-utils.ts` (new) — pure `extractBearer` / `hasScope` / `requireScope`.
- `lib/api-auth-utils.test.ts` (new) — unit tests for the pure helpers.
- `app/api/v1/items/route.ts` (new) — GET + POST route handlers.
- `app/api/v1/items/route.test.ts` (new) — 401 / 403 / 200 / 201 integration tests.
- `lib/openapi/registry.ts` — add `apiKey` bearer scheme + register the two paths.
- `docs/openapi.yaml` — regenerated (never hand-edited).
- Reads: `lib/api-keys.ts` (`verifyApiKey`), `lib/api-keys-utils.ts`,
  `lib/schema/system.ts` (`apiKeysTable.scopes/lastUsedAt`), `lib/schema/items.ts`,
  `lib/validations/items.ts`, `actions/items.ts` (domain reference).

## Acceptance

- `GET /api/v1/items` with no `Authorization` header → **401**.
- `GET`/`POST` with an invalid/revoked key → **401**.
- `GET` with a key lacking `read` → **403**; `POST` with a key lacking `write` → **403**.
- `GET` with a `read` key → **200** with `{ items: [...] }`, scoped to the key owner.
- `POST` with a `write` key + valid `{ title }` → **201** with the created item.
- `POST` with an invalid body (empty / >255 title) → **400** with `{ error }`.
- `verifyApiKey` now has a real caller; `lastUsedAt` is bumped on success.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass.
- `pnpm openapi:generate` leaves `docs/openapi.yaml` unchanged (`git diff --exit-code`).
- The OpenAPI coverage guard passes (the new route is registered).

## Out of scope

- Update / delete (`PATCH`/`DELETE`) over the public API.
- Pagination / filtering query params.
- Rate limiting.
- Per-key scope management UI changes (scopes already exist on the key row).
- Documenting Server Actions as HTTP paths (they remain typed RPC).
