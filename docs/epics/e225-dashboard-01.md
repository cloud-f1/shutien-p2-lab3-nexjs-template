# E225 — shadcn dashboard-01

**Phase:** 54 | **Status:** 🔄 | **Depends:** E224

## Problem

The dashboard page is a simple items list + count card. Adopt the rich `dashboard-01` block (stat cards row + interactive area chart + data table) shown in the reference image.

## Solution

- `npx shadcn@latest add dashboard-01` (pulls recharts area chart, @tanstack/react-table data-table, @dnd-kit, section-cards, etc.).
- Mount behind auth using the E224 sidebar.
- **Hybrid data (confirmed):**
  - Stat cards → real data where clean: e.g. total items (user) / total users (admin) / verified-user count; keep a couple of demo cards for visual parity.
  - Data table → real `items` (admin: all users) rather than the block's demo rows.
  - Area chart → representative/demo series (visual only) — acceptable per Hybrid decision.
- Preserve "+ New Item" → `/dashboard/items/create` and item edit/delete actions.

## Acceptance

- [ ] Dashboard visually matches dashboard-01 (cards + chart + table layout)
- [ ] Stat cards + table reflect real DB data
- [ ] typecheck/lint/unit/e2e green; dashboard loads for both admin and non-admin
