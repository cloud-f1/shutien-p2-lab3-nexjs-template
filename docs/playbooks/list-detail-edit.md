# List → Detail → Edit Playbook

> The three-stage navigation flow for a domain whose records outgrew a modal. Pattern reference:
> `next-app/app/(dashboard)/dashboard/items/[id]/` (E339).

## Overview

Every CRUD domain in this template starts the same way: a `<DataTable>` list + create/edit modals
(E273). That's correct for most domains and should stay the default. This playbook covers the
**next** step — what to do when a record has too much information to fit in a modal — without
inventing a second editing flow or a bespoke page structure per fork.

The three stages:

1. **List** — `dashboard/<domain>/page.tsx` + `<DataTable>`, unchanged from E273.
2. **Detail** — `dashboard/<domain>/[id]/page.tsx` — a new **reading** surface. Fetches the full
   record + anything it needs to render (owner info, related rows, audit history) and renders it
   across purpose-built cards.
3. **Edit** — still the existing E273 modal, just opened from the detail page instead of (or in
   addition to) the list row. Saving stays on the detail page — no redirect, no second form.

```
List (/dashboard/items)          Detail (/dashboard/items/[id])       Edit
┌─────────────────────┐          ┌─────────────────────────────┐
│ title →─────────────┼─────────▶│ Header (title, status,       │
│ ...        [edit]───┼───┐      │   [編輯] [刪除])──────────────┼──┐
│            [delete] │   │      │ ┌───────────┐ ┌────────────┐ │  │
└─────────────────────┘   │      │ │ Activity  │ │ Side card  │ │  │
                           │      │ │ card      │ │ (owner/id/ │ │  │
                           │      │ └───────────┘ │ timestamps)│ │  │
                           │      │               └────────────┘ │  │
                           │      └─────────────────────────────┘  │
                           │                                       │
                           └──────────────▶ ItemDialog (E273) ◀────┘
                                     onSuccess → router.refresh()
                                     (stays on whichever page opened it)
```

## When a detail page is actually warranted

**Most records do not need one.** Adding a detail page is real surface area (a route, an IDOR
check, a not-found page, more tests) — don't pay that cost by default. Use this judgement, not a
rule of thumb about row count:

| Signal | Detail page? |
|---|---|
| A record's fields all fit comfortably in one modal form | **No** — keep it in the list + modal |
| The record has related data that doesn't belong in an edit form (audit history, related rows, attachments, computed stats) | **Yes** |
| Users want to bookmark/share a link to one specific record | **Yes** — the modal has no stable URL, the detail page does |
| The record has a lot of *read-only* context (owner, status history, who-did-what) that would clutter an edit form | **Yes** |
| The only reason is "the modal feels a bit small" | **No** — widen the modal (`DialogContent className="sm:max-w-lg"` etc.) first |
| The record needs its own permission model beyond the list's (e.g. an admin can view but not mutate someone else's row) | **Yes** — this is exactly the IDOR-relaxation shape the reference implementation demonstrates |

If in doubt, don't build it — a modal that's slightly too small is a much smaller problem than an
unused route nobody maintains.

## Building one — step by step

### 1. The route + fetch

`dashboard/<domain>/[id]/page.tsx` is an async Server Component. It is the **only** place that
touches `db` for this route:

```tsx
import { cache } from "react"

interface Viewer { userId: string; role: Role }

// ONE predicate, used by BOTH generateMetadata() and the page body below —
// see §2b. Writing this twice is exactly how the leak in §2b happens.
function canViewItem(row: { userId: string }, viewer: Viewer): boolean {
  return row.userId === viewer.userId || viewer.role === "admin"
}

const resolveViewer = cache(async (): Promise<Viewer> => {
  const session = await requireAuth()
  const role = (await getLiveRole(session.user.id)) ?? session.user.role
  return { userId: session.user.id, role }
})

const loadItemRow = cache(async (id: string) => { /* ...db.select()... */ })

export default async function ItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const viewer = await resolveViewer()

  const row = await loadItemRow(id)
  if (!row) notFound()
  if (!canViewItem(row, viewer)) notFound() // IDOR — see below
  // ...assemble a view-model, render _detail/* children with props
}
```

`cache()` (from `"react"`) is not optional polish here — it's what makes calling `resolveViewer()`/
`loadItemRow()` from two independent functions (§2b) cheap instead of doubling the session read and
the DB query on every request.

### 2. The security check (read this even if you skip everything else)

- **A missing id and an unauthorized id must be indistinguishable** — both call `notFound()`. If
  the unauthorized case used `redirect()` instead, a visitor could tell "this id exists but I
  can't see it" apart from "this id doesn't exist" — an IDOR information leak.
- **Re-read the role from the DB** (`getLiveRole`, E323) — never trust `session.user.role`, which
  is a JWT snapshot from sign-in time.
- **Mirror your Server Actions' existing ownership check — don't invent a parallel one.** If
  `updateItem`/`deleteItem` already scope their `WHERE` clause to the owner (`eq(userId,
  actorId)`), then an admin who can *view* someone else's record still can't *mutate* it through
  those actions — so the detail page's edit/delete buttons must only render for the true owner,
  not for every admin. Showing a button the underlying action will reject is a worse UX than not
  showing it.
- **Button/nav visibility is a UX courtesy, never the authorization.** Hiding the 編輯/刪除 buttons
  for a non-owner (`canMutate = isOwner && canEdit(role)`) only prevents an honest client from
  offering an action the server will reject anyway — it is not what makes the mutation safe. The
  real gate is, and must stay, the ownership-scoped SQL `WHERE` in the Server Action
  (`actions/<domain>.ts`). If you ever find yourself thinking "the button's hidden, so this is
  covered" — it isn't; check what the action itself enforces.
- **Every route with an ownership check needs a test that actually exercises it** — not just "the
  function exists." See `next-app/test/int/items-detail.int.test.ts` for the reference: it drives
  the real page function (and `generateMetadata()` — see §2b) with a mocked session for the owner, a
  different non-owner user, and an admin, and asserts each one deterministically 404s, renders, or
  gets a generic title. Read `.claude/skills/testing-strategy/SKILL.md` before writing this test —
  it documents this repo's test pyramid and known traps (the "orphan tested function" and
  "conditional-skip" traps both apply here: don't write a test that could pass without ever hitting
  `notFound()` or the metadata guard).

### 2b. `generateMetadata()` is a SEPARATE entry point — it needs its OWN guard

**This is the trap that matters most in this whole playbook — read it even if you skim everything
else, and do not drop it as "just boilerplate" when copying the pattern.**

In the Next.js App Router, `generateMetadata()` and the page component **resolve independently**.
Next calls both for the same request, but neither's result depends on the other having run first —
a `notFound()` thrown inside the page body does **NOT** retroactively cancel metadata that
`generateMetadata()` already computed. They are two separate entry points into the same route, not
one guarded by the other.

Concretely: if `generateMetadata()` fetches the record and returns `{ title: row.title }` with no
ownership check, then ANY authenticated user — a viewer, an unrelated editor, anyone logged in at
all — who visits `/dashboard/<domain>/<someone-else's-id>` gets that record's real title rendered
into the page `<title>`, **even though the page body correctly 404s them a moment later**. The
dashboard layout's `requireAuth()` only proves "logged in", not "allowed to see this specific
record" — it does nothing to close this.

The fix is NOT "add a second, similar-looking check in generateMetadata" — a second hand-written
copy of the predicate is one future edit away from drifting out of sync with the first (someone
fixes the page body's rule and forgets the metadata one, or vice versa). Extract **one**
`canViewItem()` (or equivalent) predicate and call it from both:

```tsx
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const row = await loadItemRow(id)
  if (!row) return { title: "項目" } // generic — do not leak "exists vs doesn't"

  const viewer = await resolveViewer()
  if (!canViewItem(row, viewer)) return { title: "項目" } // generic — do not leak the real title

  return { title: `${row.title} · 項目` }
}
```

Note `generateMetadata()` returns a **generic title**, not `notFound()`, for the disallowed case —
calling `notFound()` here would still work, but a plain fallback string is simpler and this function
has no page body to redirect out of. Whichever you pick, it must produce the SAME allow/deny
decision as the page body for the same `(row, viewer)` — that is exactly what sharing `canViewItem()`
guarantees and a hand-copied predicate does not.

**Test this path explicitly.** A test suite that only calls the page's default export gives zero
signal on `generateMetadata()` — it is a distinct exported function with its own code path. See the
three `generateMetadata` cases in `next-app/test/int/items-detail.int.test.ts` (intruder gets a
generic title, owner gets the real one, admin gets the real one) for the reference shape.

### 3. The `_detail/` children — hard rule

```
_detail/
  header.tsx          title + status badge + edit/delete actions
  side-card.tsx        attribute summary (owner / timestamps / id)
  activity-card.tsx     this record's audit entries only
  readonly-banner.tsx   shown when the viewer can view but not mutate
  types.ts              shared view-model types
```

**`page.tsx` does ALL fetching and authorization; every child receives props only.** No child
imports `db` or any server-only query module. Enforce this with a grep before merging:

```bash
grep -rn "from \"@/lib/db\"\|drizzle-orm" app/\(dashboard\)/dashboard/<domain>/\[id\]/_detail/
# must return nothing
```

Why this matters beyond style: it keeps the security check in exactly one place. If a child could
run its own query, a future edit could add a second, un-audited path to the same data that skips
the IDOR check in `page.tsx`.

A child becomes `"use client"` only when it needs interactivity (opening the edit modal, a
delete-confirm dialog) — it still takes its data as props; client-vs-server is about *where the
code runs*, not *where the data comes from*.

### 4. Wiring the edit modal in from a new surface

The detail page opens the **same** `ItemDialog`/`ConfirmDialog` the list already uses (E273) — do
not build a second form. Its existing `onSuccess` calls `router.refresh()`, which re-runs the
Server Component `page.tsx` and re-fetches — so saving from the detail page naturally stays on the
detail page with fresh content. Delete redirects back to the list (`router.push("/dashboard/...")`)
since the record it was viewing no longer exists.

### 5. Breadcrumb + tab title

- `generateMetadata()` on the page sets the browser tab title from the record's own title/name —
  not a static string. **This function needs its own ownership check — see §2b.** It is a genuinely
  separate code path from the page body, not metadata "attached to" an already-guarded page; skipping
  its guard is a real, shipped information leak, not a theoretical one.
- The global breadcrumb (`components/app-breadcrumb.tsx`) derives labels from `NAV_LABELS`
  (`lib/nav.ts`), which has no entry for a dynamic id segment. Render
  `<DynamicBreadcrumbLabel label={record.title} />` from a client child (e.g. `_detail/header.tsx`)
  to announce the record's title for the current route — see `lib/breadcrumb-label.ts` for how the
  override plumbing works and why it exists (there's no prop path from a leaf page down to a
  breadcrumb that lives in the shared dashboard layout).

### 6. Wiring the list in

- List rows and mobile cards (E338) link to `/dashboard/<domain>/<id>` instead of (or in addition
  to) opening the edit modal directly. Keep the list's own quick edit/delete row actions if there's
  room for them (desktop) — the detail page is an additional way in, not necessarily the only one.
  On mobile, where there's no room for per-row action buttons, routing the tap through the detail
  page is usually the right call — see `_items-table.tsx`'s `renderMobileCard`.

## Gotchas

- **Don't build a parallel visibility rule.** If your domain uses `@saas/rbac-scoped-visibility` or
  a bespoke `canSeeX()` helper for the list, the detail page's guard must call the exact same
  helper — not a hand-rolled equivalent that can drift from it.
- **`notFound()` inside a nested route renders the nearest `not-found.tsx` up the tree** — put one
  at `dashboard/<domain>/[id]/not-found.tsx` so it renders inside the dashboard layout (sidebar
  visible) instead of falling back to the app-root splash page.
- **Audit-log filtering must happen server-side** (`WHERE targetType = ... AND targetId = ...`),
  not by fetching the global log and filtering in a component — see `getAuditLogForTarget` in
  `lib/audit.ts`. A client-side filter of an unfiltered fetch is both slower as the log grows and
  one refactor away from silently leaking another record's entries into the "wrong" component.
- **Out of scope for a first detail page:** tabbed sub-resources and version history/diffing are
  real features but a separate epic once a domain actually needs them — don't build them
  speculatively into the first exemplar.
- **Hiding a button is not authorization.** `canMutate`/similar flags decide what the UI *offers*;
  they never decide what's *allowed*. The Server Action's own ownership-scoped `WHERE` is the real
  gate, every time — see §2.
- **`generateMetadata()` guards itself, or it leaks.** It's a separate entry point from the page
  component, not metadata bolted onto an already-checked page — see §2b. This is the single most
  important trap in this playbook to carry into a new domain.
