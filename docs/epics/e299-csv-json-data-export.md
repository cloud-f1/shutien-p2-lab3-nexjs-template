# E299 — CSV/JSON Data Export

> Phase 70 · data portability · GDPR baseline
> Status: ⬜ pending

## Problem

No data export of any kind exists. GDPR Article 20 requires data portability for personal data. B2B SaaS products at scale (Linear, Notion, Stripe-level) all offer one-click data export. Fork teams building compliance-sensitive products need this as a baseline.

Two surfaces are immediately useful:
1. **Audit log export** — admin-only CSV export of the audit trail
2. **Items export** — per-user JSON/CSV export of their own items data

## Solution

1. **Server Actions** — `exportAuditLog()` (admin-only, CSV) + `exportItems()` (user-scoped, JSON)
   - Each returns `{ data: string, filename: string, contentType: string }`
   - The client triggers a browser download via `<a href="data:...">` or `URL.createObjectURL`
2. **API route** — `/api/v1/export/items` (bearer-authenticated via API key)
   - Returns CSV for programmatic consumption
3. **UI** — Export buttons in the Audit Log panel + Items page
4. **Utils** — `lib/export-utils.ts` (pure: array → CSV string, array → JSON string)

## Key Files

- `next-app/lib/export-utils.ts` (NEW) — `toCsv(rows, headers)`, `toJson(rows)`
- `next-app/lib/export-utils.test.ts` (NEW) — unit tests
- `next-app/actions/admin.ts` — add `exportAuditLog()` Server Action
- `next-app/actions/items.ts` — add `exportItems()` Server Action
- `next-app/app/api/v1/export/items/route.ts` (NEW) — bearer-auth CSV route
- `next-app/app/(dashboard)/dashboard/system/_audit-panel.tsx` — add Export button
- `next-app/app/(dashboard)/dashboard/items/page.tsx` — add Export button

## Implementation

### Phase 1 — Pure utils + unit tests
- `toCsv(rows: Record<string,unknown>[], headers: string[]): string` — RFC 4180 CSV
- `toJson(rows: unknown[]): string` — `JSON.stringify(rows, null, 2)`
- Unit tests: empty array, special chars (commas/quotes), unicode

### Phase 2 — Server Actions
- `exportAuditLog()` — requires `admin` role; queries `auditLog` table ordered by `createdAt` desc
- `exportItems()` — scoped to session user
- Both return `{ success: true, data, filename, contentType }` (no redirect)
- Client: on success, trigger `<a download>` programmatically

### Phase 3 — API route + UI
- `GET /api/v1/export/items` — reads `Authorization: Bearer <api-key>`, validates via `validateApiKey()`, returns streaming CSV with `Content-Disposition: attachment`
- Add "Export CSV" button to audit panel (admin only)
- Add "Export JSON" button to items page DataTable header area

## Acceptance Criteria

- [ ] `lib/export-utils.ts` has unit tests covering CSV escaping and edge cases
- [ ] `exportAuditLog()` only works for admin role (returns error for editor/viewer)
- [ ] `exportItems()` scoped to the authenticated user's items only
- [ ] `/api/v1/export/items` validates API key and returns 401 if missing/invalid
- [ ] Export buttons visible in audit panel + items page
- [ ] Downloaded files are valid CSV/JSON
- [ ] `pnpm typecheck` + `pnpm build` + `pnpm test` pass

## Out of Scope

- Excel/XLSX format
- Scheduled/recurring exports
- Export of all other tables (webhooks, API keys, etc.) — items + audit as MVP
- Async/background export for large datasets
