# E309 — Data Export Expansion (webhooks / api-keys / team)

> Phase 72 · data portability (builds on E299)
> Status: ⬜ pending

## Problem

E299 shipped CSV/JSON export for items + the audit log, plus the reusable `lib/export-utils.ts` (`toCsv` / `toJson`). The other system panels — **webhooks, api-keys, team** — have no export, so admins can't pull those records for audit/portability.

## Solution

Add export to the three remaining system panels, reusing `lib/export-utils.ts` (no new util logic):
1. **Server Actions** — `exportWebhooks()`, `exportApiKeys()` (redact the secret — export prefix/metadata only), `exportTeam()` (members + roles + status). Each admin/owner-gated, returns `{ success, data, filename, contentType }` (no redirect), matching E299's shape.
2. **UI** — an Export button in each panel header (admin-only, same component/pattern as E299's audit/items buttons; client-side download trigger).
3. **Tests** — extend `export-utils.test.ts` only if a new shaping helper is needed; otherwise unit-test the per-action row-mapping (pure mapper extracted to `*-utils.ts`).

No migration, no shadcn-add. **api-keys export MUST NOT include raw secrets** — only the stored prefix + metadata (security gate).

## Key Files

- `next-app/actions/webhooks.ts` — `exportWebhooks()`
- `next-app/actions/api-keys.ts` — `exportApiKeys()` (redacted)
- `next-app/actions/team.ts` — `exportTeam()`
- `next-app/app/(dashboard)/dashboard/system/_webhooks-panel.tsx` · `_api-keys-panel.tsx` · `_team-panel.tsx` (or team location) — Export buttons
- `next-app/lib/export-utils.ts` — reuse (read-only)
- `next-app/lib/*-utils.ts` — pure row-mappers + tests

## Acceptance Criteria

- [ ] Export buttons on webhooks, api-keys, team panels (admin/owner-gated)
- [ ] api-keys export contains NO raw secret (prefix/metadata only) — asserted in a test
- [ ] Each action returns the E299 result shape; client triggers download
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm build` pass
- [ ] Reuses `lib/export-utils.ts` (no duplicate CSV/JSON logic)

## Out of Scope

- Async/background export for very large datasets
- Export of billing/usage tables
