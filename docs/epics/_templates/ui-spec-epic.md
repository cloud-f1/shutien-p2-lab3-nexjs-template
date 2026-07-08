# E{n} — {Screen Name}

> Phase {p} · {entities|surfaces}
> Status: ⬜ pending · Deps: {E…}
> Design SSOT: `{path/to/source}` (read in full) + `{modal/source}`
> Visual refs: `{screenshots/NN-screen.png}` (+ role/mobile variants)
> Port rule: recreate the **visual output**; replace any prototype global-state mutation +
> inline styles with Server Components + Server Actions + Drizzle + shadcn/Tailwind tokens.
> Do NOT copy a prototype's inline-style structure. User-facing copy in {language}.

## Surface contract (machine-readable — `/athena:align` diffs the build against this)

```yaml
route: /dashboard/{slug}            # the page this epic ships (+ /[id] if a detail route)
nav: { label: "{label}", group: main|user, lockFor: [viewer] }   # how it's reached; omit if not in nav
tabs: ["{tab1}", "{tab2}"]          # the page's tab labels (omit if none)
sections: ["{section1}", "{section2}"]   # the major cards/regions a reviewer should see
deepLinks:                          # every cross-page navigation this page MUST emit
  - to: /dashboard/{other}?filter={value}   # target route (+ query the destination must honor)
    from: "{element}"
rbac:                               # per-control gating → which flag/role
  "{control}": "{flag or role}"     # e.g. "Delete": "editor+ (viewer read-only)"
copy_lang: {language}               # e.g. 繁體中文 | English
```

The `## Problem … Acceptance Criteria` prose below is the human spec; this block is the
checkable contract. Keep them in sync — the linter (`scripts/align/surface-check.cjs`) checks
links/labels/orphans mechanically; the `alignment-audit` skill diffs tabs/sections/deepLinks/rbac.

## Problem
{What this screen is for, why it's load-bearing, what's hard about it (modes, RBAC, audit).}

## Route & Data
- Route `{app/.../page.tsx}` (Server Component); loads {entities + relations}.
- Visibility / 404 rule: {who can see what} via `{guard, e.g. requireEditor / requireAdmin}`.
- Server-derived: {computed values} via `{source}`.

## Layout (desktop)
```
{ASCII sketch: header, banners, grid columns with px/fr, sidebar, cards}
```
Mobile (<768px): {collapse rule}. Bottom nav via `components/mobile-tab-bar`.

## Component Tree
`{Root}` → { {named children, optional?, variant branches} } + modals.

---

## {Section} — element table
| Element | Spec (size/copy/dimension) | RBAC / state |
|---|---|---|
| … | … | … |

## Tables / lists
- Columns: {exact list}. Filters: {chips/search}. Sort: {columns + asc/desc/off}.
  Pagination: {page-size options}. Empty: "{copy}". Row actions: {…}.
- Use `<DataTable>` (`components/data-table-generic`) — never a hand-rolled `<table>`.

## Modals (fields + validation)
| Modal | Fields | Validation | Default | Copy |
|---|---|---|---|---|
| `{Modal}` | {field*: type} | {rule, e.g. required / sum=100%} | {default} | {label/placeholder} |

## RBAC matrix (per control)
| Action | admin | editor | viewer |
|---|---|---|---|
| {control} | ✓ | ✓ / ✗ | ✗ |
Gated controls show a **lock hint** with exact copy — not a hidden button.

## Mutations → audit
`{action}`({log verb}) … — each returns success (no redirect) → modal closes + list refreshes
(`revalidatePath` + `router.refresh()`); each writes the permanent audit log.
Prefer building mutations through `lib/define-action.ts` (guard → validate → authorize →
handler → audit → revalidate) so the audit entry can't be forgotten.

## Style mapping → shadcn / Tailwind
| Prototype element / token | Port target |
|---|---|
| `Card` | `<Card>` |
| `Modal` | `<Dialog>` (desktop) / `<Sheet>` bottom-sheet (mobile) via `components/responsive-modal` |
| `Btn` primary/default/ghost/danger | `<Button variant=default/outline/ghost/destructive size=sm>` |
| `ProgressBar` | `<Progress>` |
| list/table | `<DataTable>` |
| confirm | `<ConfirmDialog>` (`components/confirm-dialog`) |
| date field | `<DatePicker>` (`components/ui/date-picker`) |
| `var(--brand)` `#…` | `bg-primary`/`text-primary` (token) |
| status colors | `success`/`warning`/`destructive` tokens |
| icons | `lucide-react` |
Layout: left-align main (no max-width centering); exact grid columns; mobile single-col + bottom-tab.

## States
Empty · loading · error · lock (per-role) · mobile · {variant-specific}.

## Acceptance Criteria
- [ ] {Tied to a specific UI element + behavior + copy}
- [ ] {Validation rule enforced}
- [ ] {RBAC branch enforced + lock-hint copy shown}
- [ ] `pnpm typecheck` + `pnpm test` + `pnpm build` green

## Out of Scope
{What a sibling epic owns.}
