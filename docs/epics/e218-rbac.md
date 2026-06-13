# E218 — Role-Based Access Control (RBAC)

**Phase:** 53 | **Status:** ✅ Implemented | **Branch:** main (inline, no PR)

## Problem

All authenticated users had identical access. No way to distinguish admin from regular users, and the Next.js middleware (proxy.ts) imported `lib/auth.ts` which uses DrizzleAdapter — incompatible with the Edge runtime.

## Solution

### Database

`lib/schema.ts` — added `pgEnum("role", ["user", "admin"])` and `role` column to `usersTable`. Migration: `drizzle/migrations/0002_handy_lady_bullseye.sql`.

### Auth split (Edge compatibility)

- `auth.config.ts` — minimal NextAuthConfig (no adapter, no Node.js imports). Contains `trustHost: true`, `pages`, and `authorized` callback that enforces `/dashboard` (login required) and `/dashboard/admin` (admin only).
- `proxy.ts` — imports only `auth.config.ts` (Edge-safe)
- `lib/auth.ts` — full config with DrizzleAdapter + session callback that propagates `role`

### Permission helpers

- `lib/is-admin.ts` — pure function `isAdmin(role)`, no imports, safe to use in client components
- `lib/permissions.ts` — server-only: `requireAuth()`, `requireAdmin()`, re-exports `isAdmin`

### Type augmentation

`auth.d.ts` — extends `Session["user"]` with `id: string` and `role: Role`; extends `AdapterUser` with `role?: Role`

## Acceptance Criteria

- [x] `/dashboard` redirects to `/login` when unauthenticated
- [x] `/dashboard/admin` redirects to `/dashboard` when role !== "admin"
- [x] Admin user sees admin badge and nav link in sidebar
- [x] `pnpm typecheck` passes with no errors on the role types
- [x] Smoke test 6/6 probes pass (including dashboard→redirect)

## Dependencies

- Requires E217 (for `passwordSchema` used in settings actions)
