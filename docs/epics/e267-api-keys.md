# E267 — API Keys

**Phase:** 62 | **Status:** ⬜ | **Depends:** none

## Problem

A B2B SaaS needs programmatic access. There's no way for a user to mint/revoke API keys or for the app to authenticate a bearer token.

## Solution

A Drizzle `api_keys` table + owner-scoped create/revoke Server Actions + a bearer-auth verify helper + a System UI panel. Plaintext key shown once at creation; only a hash is stored.

## Key Files

- `next-app/lib/schema.ts` — `apiKeysTable` (additive; see migration note)
- `next-app/lib/api-keys.ts` — `generateKey()`, `hashKey()`, `verifyKey(bearer)` (prefix lookup + constant-time hash compare)
- `next-app/actions/api-keys.ts` — `createApiKey` (returns plaintext once), `revokeApiKey` (`"use server"`)
- `next-app/app/(dashboard)/dashboard/system/api-keys/*` — list/create/revoke UI
- `next-app/lib/api-keys.test.ts` — hash+verify roundtrip, revoke

## Implementation

1. `apiKeysTable`: `id` uuid pk · `userId` fk→users(cascade) · `name` · `prefix` (8-char, indexed, shown) · `hashedKey` (sha256) · `scopes` text[] · `lastUsedAt` · `createdAt` · `revokedAt` (nullable).
2. Generate `sk_<prefix>_<secret>`; store `prefix` + `hash(secret)`; return plaintext ONCE.
3. `verifyKey`: parse prefix → lookup active row → constant-time compare → bump `lastUsedAt`.
4. RBAC: actions owner-scoped (a user manages only their keys). Revoke = set `revokedAt`.

## Acceptance Criteria

- [ ] Create returns plaintext once; only hash persisted; revoke disables verify.
- [ ] `verifyKey` accepts a valid live key, rejects revoked/unknown.
- [ ] Owner-scoped; `pnpm test` covers hash/verify/revoke; typecheck+lint+build green.

## Out of Scope

- Per-route scope enforcement middleware (helper only). Rate limiting per key.

## Migration note

Adds a table to `lib/schema.ts`. Generate ONE Drizzle migration after all Phase 62 schema additions land (avoid migration-number conflicts); never per-worktree.
