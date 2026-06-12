# Design System — Unified UI Contract

> **Single source of truth** for shared UI primitives, page chrome, and Tailwind ↔ CSS-variable bridge.
> Read this before building a new page. Read the four "Page Recipe" sections before laying out a CRUD/dashboard view.

---

## 1. Goals

1. **One way to build a page** — every dashboard view uses the same `<PageContainer>` shell, breadcrumb, and section spacing.
2. **One way to build a table** — every list view uses `<DataTable>` with built-in search, filter, pagination, and row actions.
3. **One way to build a form** — every form uses `<FormField>` + react-hook-form + Zod (matches the existing client convention).
4. **Themeable end-to-end** — every primitive resolves to a `var(--token)` so `<html data-theme="...">` swaps the entire UI without re-renders.
5. **Tailwind-first for new code** — utilities are the default authoring surface; legacy `.btn`, `.form-*`, `.c-*` classes stay for back-compat but are no longer the recommended path.

## 2. Architecture

The system has **two orthogonal axes** so you can swap one without touching the other:

| Axis | What it controls | Where it lives | How to swap |
|---|---|---|---|
| **Theme** | colors, fonts, radii, shadows | `themes.css` (CSS vars) | `<html data-theme="rose">` |
| **Preset** | layout density, class strings, glyphs (`/` vs `›`), variant maps | `components/ui/preset.ts` | `setActivePreset(myPreset)` |

```
┌──────────────────────────────────────────────────────────────┐
│ themes.css       6 themes × 47 CSS vars  (single source)     │
│   ─ dark, indigo, navy, sage, rose, forest                   │
└────────────┬─────────────────────────────────────────────────┘
             │ var(--primary), var(--surface), var(--text-...)
             ▼
┌──────────────────────────────────────────────────────────────┐
│ tailwind.config.ts   Maps CSS vars → utilities               │
│   ─ bg-surface, text-text-primary, border-border, …          │
│   ─ corePlugins.preflight = false (coexist with legacy)      │
└────────────┬─────────────────────────────────────────────────┘
             │ utilities
             ▼
┌──────────────────────────────────────────────────────────────┐
│ preset.ts        Preset interface + defaultPreset +          │
│                  compactPreset + getActivePreset() +         │
│                  setActivePreset(). All Tailwind class       │
│                  strings, separator glyphs, and variant      │
│                  maps live here — NOT inside components.     │
└────────────┬─────────────────────────────────────────────────┘
             │ getActivePreset()
             ▼
┌──────────────────────────────────────────────────────────────┐
│ Shared primitives  (src/components/ui/)                      │
│   PageContainer · Breadcrumb · DataTable · Pagination ·      │
│   SearchInput · FilterBar · FormField · Button (Tailwind)    │
└────────────┬─────────────────────────────────────────────────┘
             │ composed by
             ▼
┌──────────────────────────────────────────────────────────────┐
│ Pages / Views  (src/pages/...)                               │
│   No new page-CSS files; compose primitives + utilities      │
└──────────────────────────────────────────────────────────────┘
```

**Rule:** New pages MUST NOT add a co-located `*.css` file. Compose primitives + Tailwind utilities. Legacy page CSS (`AuthPages.css`, `Dashboard.css`, …) stays in place — migrate opportunistically, never as a big-bang rewrite.

## 3. Token Map (Tailwind ↔ CSS var)

| Tailwind utility | CSS var | Purpose |
|---|---|---|
| `bg-bg` | `--bg` | App background |
| `bg-surface` | `--surface` | Cards, panels, table header |
| `bg-surface-2` | `--surface-2` | Sunken / hover surfaces |
| `text-text-primary` | `--text-primary` | Body / headings |
| `text-text-secondary` | `--text-secondary` | Labels / meta |
| `text-text-muted` | `--text-muted` | Placeholders / hints |
| `border-border` | `--border` | All dividers |
| `bg-primary text-bg` | `--primary` / `--bg` | Primary CTA |
| `bg-primary-bg text-primary` | `--primary-bg` / `--primary` | Tinted callout |
| `bg-success-light text-success` | `--success-light` / `--success` | Success badge |
| `bg-danger-light text-danger` | `--danger-light` / `--danger` | Destructive / error |
| `bg-warning-light text-warning` | `--warning-light` / `--warning` | Warning |
| `font-display` | `--font-display` | Page titles, hero |
| `font-body` | `--font-body` | Default text |
| `font-mono` | `--font-mono` | Code, IDs, timestamps |
| `rounded` / `rounded-lg` | `--radius-md` / `--radius-lg` | Standard corners |
| `shadow` / `shadow-lg` | `--shadow-md` / `--shadow-lg` | Elevation |

**Never** use `bg-white`, `text-gray-500`, `border-zinc-200`, etc. Those are theme-blind and break the light/dark/forest swap.

## 4. Primitives — API

All primitives live in `src/components/ui/` and are barrel-exported via `src/components/ui/index.ts`.

### `<PageContainer>`

The unified page chrome for every dashboard view.

```tsx
<PageContainer
  eyebrow="Security"
  title="Active Sessions"
  subtitle="Devices currently signed in to your account."
  breadcrumbs={[{ label: "Dashboard", to: "/dashboard" }, { label: "Sessions" }]}
  actions={<Button variant="primary">New session</Button>}
>
  {/* page content */}
</PageContainer>
```

| Prop | Type | Notes |
|---|---|---|
| `eyebrow` | `string?` | Small uppercase kicker above title. |
| `title` | `string` | Required. Renders as `<h1 class="font-display">`. |
| `subtitle` | `string?` | Single-line description. |
| `breadcrumbs` | `Crumb[]?` | If omitted, derived from current route via `useBreadcrumbs()`. |
| `actions` | `ReactNode?` | Right-aligned action cluster (buttons, dropdowns). |
| `children` | `ReactNode` | Page content. Wrapped in a `space-y-6` stack. |

### `<Breadcrumb>`

Standalone — also embedded inside `<PageContainer>`. Last crumb is the current page (no link).

```tsx
<Breadcrumb items={[
  { label: "Dashboard", to: "/dashboard" },
  { label: "Settings", to: "/dashboard/settings" },
  { label: "Sessions" },        // current page — no `to`
]} />
```

A11y: rendered as `<nav aria-label="Breadcrumb">`, current page marked `aria-current="page"`.

### `useBreadcrumbs()`

Hook that derives crumbs from `routeMap.ts` for any path under `/dashboard`. Returns `[{ label: "Dashboard", to: "/dashboard" }, { label: <current view label> }]`. Use when you don't want to hand-author the array.

### `<DataTable>`

The unified list-view primitive. Built-in search, filter, pagination, and row actions.

```tsx
<DataTable
  data={sessions}
  columns={[
    { id: "id",         header: "Session",   accessor: (r) => r.id.slice(0, 8), mono: true },
    { id: "created_at", header: "Created",   accessor: (r) => fmt(r.created_at) },
    { id: "ip",         header: "IP",        accessor: (r) => r.ip ?? "unknown" },
  ]}
  getRowId={(r) => r.id}
  searchable                       // adds <SearchInput> in toolbar
  searchPlaceholder="Search sessions"
  searchKeys={["id", "ip", "user_agent"]}   // fields to search across
  filters={[
    { id: "status", label: "Status", options: [
      { value: "active", label: "Active" },
      { value: "revoked", label: "Revoked" },
    ]},
  ]}
  pageSize={10}
  rowActions={(row) => [
    { label: "Revoke", onClick: () => revoke(row.id), variant: "danger" },
  ]}
  isLoading={query.isLoading}
  isError={query.isError}
  emptyMessage="No active sessions."
/>
```

| Prop | Type | Required | Notes |
|---|---|---|---|
| `data` | `T[]` | yes | Array of rows. |
| `columns` | `Column<T>[]` | yes | See below. |
| `getRowId` | `(row: T) => string` | yes | Stable row key. Used for React keys + action handlers. |
| `searchable` | `boolean` | no | Renders `<SearchInput>` in toolbar. |
| `searchKeys` | `(keyof T)[]` | no | Fields to match against. Defaults to all string fields. |
| `searchPlaceholder` | `string` | no | Defaults to `"Search"`. |
| `filters` | `FilterDef[]` | no | One `<select>` per def, rendered in toolbar. |
| `pageSize` | `number` | no | Defaults to 10. Set 0 to disable pagination. |
| `rowActions` | `(row: T) => Action[]` | no | Renders an actions column on the right. |
| `isLoading` / `isError` | `boolean` | no | Render skeleton / error state. |
| `emptyMessage` | `string` | no | Defaults to `"No data."`. |

`Column<T>`:

```ts
type Column<T> = {
  id: string;                          // unique, used for sort + a11y
  header: string;                      // <th> text
  accessor: (row: T) => ReactNode;     // cell renderer
  mono?: boolean;                      // monospace cell
  align?: "left" | "right" | "center"; // default left
  width?: string;                      // CSS width, e.g. "120px"
};
```

### `<Pagination>`

Standalone — used internally by `<DataTable>`. Exported for custom pagers (e.g. server-side query results).

```tsx
<Pagination
  page={page}              // 1-indexed
  pageSize={20}
  total={count}
  onPageChange={setPage}
/>
```

Renders: `← Prev | 1 2 … 8 9 10 | Next →` with `aria-current="page"` on the active number.

### `<SearchInput>` / `<FilterSelect>`

Toolbar primitives. Used standalone for ad-hoc filtering UIs that don't fit `<DataTable>`.

```tsx
<SearchInput value={q} onChange={setQ} placeholder="Search projects" />
<FilterSelect label="Status" value={status} onChange={setStatus} options={[
  { value: "", label: "All" },
  { value: "active", label: "Active" },
]} />
```

### `<FormField>`

Wraps an `<input>` / `<select>` / `<textarea>` with label + hint + error. Designed to plug into `react-hook-form`.

```tsx
<FormField
  label="Email"
  htmlFor="email"
  error={errors.email?.message}
  hint="We'll never share your email."
>
  <input id="email" type="email" {...register("email")} className="form-input" />
</FormField>
```

Prefer composing this with the existing `.form-input` / `.form-select` classes (see `src/styles/common/forms.css`) so we don't fork the input styling.

### `<Button>`

Tailwind-native button that mirrors the legacy `.btn` API. Use for new code; existing `.btn` markup keeps working.

```tsx
<Button variant="primary">Save</Button>
<Button variant="secondary" size="sm">Cancel</Button>
<Button variant="danger" loading={pending}>Delete</Button>
```

Variants: `primary` · `secondary` · `danger` · `ghost`. Sizes: `sm` · `md` (default) · `lg`.

## 5. Page Recipes

### Recipe A — A list/CRUD page

```tsx
import { PageContainer, DataTable, Button } from "@/components/ui";

export default function ProjectsView() {
  const query = useProjects();
  const [editId, setEditId] = useState<string | null>(null);

  return (
    <PageContainer
      eyebrow="Workspace"
      title="Projects"
      subtitle="All projects in your workspace."
      actions={<Button variant="primary" onClick={() => setEditId("new")}>New project</Button>}
    >
      <DataTable
        data={query.data ?? []}
        columns={projectColumns}
        getRowId={(p) => p.id}
        searchable
        searchKeys={["name", "slug"]}
        filters={[{ id: "status", label: "Status", options: STATUS_OPTIONS }]}
        rowActions={(p) => [
          { label: "Edit", onClick: () => setEditId(p.id) },
          { label: "Delete", onClick: () => del(p.id), variant: "danger" },
        ]}
        isLoading={query.isLoading}
      />
    </PageContainer>
  );
}
```

### Recipe B — A form page

```tsx
import { PageContainer, FormField, Button } from "@/components/ui";

export default function SettingsView() {
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(SettingsSchema) });
  return (
    <PageContainer eyebrow="Account" title="Settings">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-w-lg">
        <FormField label="Display name" htmlFor="display_name" error={errors.display_name?.message}>
          <input id="display_name" {...register("display_name")} className="form-input" />
        </FormField>
        <Button type="submit" variant="primary">Save</Button>
      </form>
    </PageContainer>
  );
}
```

### Recipe C — A detail/read page

Use `<PageContainer>` + Tailwind grids for layout. No new primitives needed.

```tsx
<PageContainer eyebrow="Project" title={project.name} breadcrumbs={[…]}>
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <div className="md:col-span-2 bg-surface border border-border rounded-lg p-6">…</div>
    <aside className="bg-surface border border-border rounded-lg p-6">…</aside>
  </div>
</PageContainer>
```

### Recipe D — An empty state

Inside any container:

```tsx
<div className="text-center py-12">
  <div className="font-display text-lg text-text-primary">No projects yet</div>
  <div className="text-sm text-text-secondary mt-1">Create your first project to get started.</div>
  <Button variant="primary" className="mt-4">New project</Button>
</div>
```

## 6. Conventions & Bans

| ✅ Do | ❌ Don't |
|---|---|
| `bg-surface text-text-primary` | `bg-white text-gray-900` |
| `<PageContainer title="X">` | hand-roll `<div class="page-header">` |
| `<DataTable …>` for list views | hand-roll `<table>` with custom CSS |
| `<FormField>` + `.form-input` | new `*-input` CSS in a page CSS file |
| Co-locate test in `__tests__/` next to component | put tests under `src/tests/` |
| Tailwind utilities in JSX | inline `style={{ color: "..." }}` |

**Stop-verifier compatibility.** The legacy ban on hardcoded colors / inline styles still applies. Tailwind utilities are checked separately — the bridge ensures every color utility resolves to a CSS var, so no audit signal is lost.

## 7. Migration Status

Phase 43 (E167–E170) is complete: every page surface now renders through
`components/ui/` primitives. No `*.css` files remain under
`client/src/pages/`. The only page-adjacent CSS file is
`components/DashboardLayout.css` (owned by E175, decomposition pending).

| Surface | Page | Status | Notes |
|---|---|---|---|
| Dashboard | OverviewView | ✅ Migrated | Stats + recent projects |
| Dashboard | ProjectsView | ✅ Migrated | Card grid below header |
| Dashboard | MemoryHubView | ✅ Migrated | Tier 0/1 panels |
| Dashboard | AgentActivityView | ✅ Migrated | Activity feed panel |
| Dashboard | PromoteQueueView | ✅ Migrated | Promote items list |
| Dashboard | CommandsView | ✅ Migrated | Uses `<DataTable>` |
| Dashboard | SystemHealthView | ✅ Migrated | Health + SLI panels |
| Dashboard | SettingsView | ✅ Migrated | Form sections through primitives |
| Dashboard | SecuritySessionsView | ✅ Migrated | `<PageContainer>` + `<DataTable>` end-to-end |
| Auth | SignIn / SignUp / ForgotPwd / Reset / Verify / OAuthCallback | ✅ Migrated (E169) | Through `<AuthLayout>` + `<AuthCard>` + `<FormField>` + `<Banner>` |
| Public | LandingPage | ✅ Migrated (E168) | Hero + sections through primitives |
| Public | GettingStartedPage | ✅ Migrated (E168) | Bilingual onboarding flow |
| Legal | PrivacyPage / TermsPage | ✅ Migrated (E168) | Long-form documents through `<LegalLayout>` |
| Public | NotFoundPage | ✅ Migrated (E168) | Tiny page, primitive-only |

**Rules going forward:**

1. **New code uses primitives.** Any new page MUST go through
   `<PageContainer>` + appropriate primitives. Reviewers reject otherwise.
2. **No new page-co-located CSS.** All shared styling lives in primitives
   (composed via `preset.ts`); per-call-site overrides ride on `className`.
3. **Trim `styles/common/` only with grep proof.** A `.foo` rule may be
   deleted only when `grep -rn '\bfoo\b' client/src --include='*.tsx'`
   returns zero hits. The Banner preset still pins `.form-banner`; the
   `.form-toggle*` and `.c-*` rules are gated on E173 / E178.

## 8. Testing

Every primitive ships with a `__tests__/` co-located Vitest file using `userEvent`. Smoke checks:

- Renders without theme-leak (no hardcoded hex in computed styles when switching `data-theme`).
- A11y: `<table>` has `role="table"` implicitly, `<nav aria-label="Breadcrumb">`, current page `aria-current="page"`, action buttons have `aria-label` when icon-only.
- Pagination: clicking next/prev calls `onPageChange` with the right page; out-of-range clicks are no-ops.
- DataTable: search filters rows; filter select narrows rows; row action click forwards row id.

### Visual Regression (E171, Phase A)

Behavior is covered by Vitest. **Visuals** (real CSS, real layout, real fonts) are covered by Playwright screenshots. The infra ships in `client/e2e/visual.spec.ts` + `client/e2e/helpers/{theme-preset,visual-mask}.ts` and runs as a separate `visual` Playwright project so the existing functional E2E suite stays fast.

**Phase A — smoke matrix (current).** 14 routes × theme=`dark` × preset=`default` × viewport=1280×800 = **14 baselines** committed under `client/e2e/__snapshots__/`. Aim is sub-2-min CI confirmation that nothing visually regressed.

**Phase B (deferred).** Parametrize the spec across `THEMES = [dark, indigo, navy, sage, rose, forest]`, `PRESETS = [default, compact]`, viewports `[desktop 1280×800, mobile 375×667]` → 336 baselines. Tracked in `e171-playwright-visual-regression.md`.

**Phase C (deferred).** Stop-verifier rule + PR tag (`[VRT-OK]`) for intentional baseline updates.

**How to run locally.**

```bash
# From client/
pnpm test:e2e --project=visual                 # run the smoke matrix
pnpm test:e2e --project=visual --update-snapshots   # refresh baselines
```

The `chromium` project (functional E2E — `auth-flow.spec.ts`, `dashboard-smoke.spec.ts`, `a11y.spec.ts`) ignores `visual.spec.ts`, so `pnpm test:e2e` runs everything once without double-counting.

**Diffing a baseline in PR review.**

| Diff source | Action |
|---|---|
| Intentional design change (preset / theme / primitive update) | Re-run `pnpm test:e2e --project=visual --update-snapshots`, commit the new `*.png`, re-request review. The PR title or body should call out the visual change explicitly. |
| Unintentional regression (no design change in this PR) | Investigate. Don't update baselines. Fix the offending CSS / preset / primitive. |

**Volatile regions** (timestamps, request_ids, animated spinners) are masked via `client/e2e/helpers/visual-mask.ts`. Animations are frozen via the project's `reducedMotion: "reduce"` context option. Add new selectors to that list when a flake reveals one.

**Tolerance.** `playwright.config.ts` sets `toHaveScreenshot.maxDiffPixelRatio: 0.01` — small enough to catch real regressions, lenient enough to absorb sub-pixel font jitter across runners.

## 9. Swapping the visual preset

The preset is the second axis of the design system (the first being CSS-variable themes). It captures **everything that isn't a color**: padding, font sizes, border radii, separator glyphs (`/` vs `›`), button variant class maps. Components do NOT hard-code Tailwind class strings — they read from `getActivePreset()`. So you can replace any slot, or the whole preset, without touching a component.

### Two presets ship out of the box

| Preset | When to use |
|---|---|
| `defaultPreset` | The look that ships with this template — generous padding, mono labels. |
| `compactPreset` | Denser tables and tighter buttons; good for admin/data-heavy pages. |

### Recipe A — swap globally at app boot

```ts
// src/main.tsx, before <App /> mounts
import { setActivePreset, compactPreset } from "./components/ui";
setActivePreset(compactPreset);
```

Every primitive picks it up on the next render.

### Recipe B — partial override (keep most of `defaultPreset`)

```ts
import { setActivePreset, defaultPreset, type Preset } from "./components/ui";

const branded: Preset = {
  ...defaultPreset,
  name: "branded",
  breadcrumb: {
    ...defaultPreset.breadcrumb,
    separatorGlyph: "›",                            // chevrons instead of slashes
  },
  button: {
    ...defaultPreset.button,
    variants: {
      ...defaultPreset.button.variants,
      primary: "bg-primary text-bg border-primary rounded-full hover:bg-primary-dark",
    },
  },
};
setActivePreset(branded);
```

### Recipe C — ship a brand-new preset file

1. Copy `preset.ts` → `myBrandPreset.ts`, rename to `myBrandPreset`.
2. Replace any class strings, glyphs, or variant maps you want to change. Keep the `Preset` interface intact — TypeScript will error if you drop a slot.
3. `setActivePreset(myBrandPreset)` at app boot.
4. Add a test mirroring `__tests__/preset.test.tsx` to assert the swap.

### What the preset covers

```
button         — base, variants (primary/secondary/danger/ghost), sizes (sm/md/lg), spinner
table          — shell, toolbar, th/td/tr, align, state, rowAction (default + danger)
pagination     — shell, summary, list, button (base/idle/active/disabled), ellipsis, prev/next glyphs
breadcrumb     — shell, list/item, link, current, separator + separatorGlyph
searchInput    — shell, icon + iconGlyph, input
filterSelect   — shell, label, select
formField      — shell, label, required, hint, error
pageContainer  — shell, breadcrumbWrap, header, eyebrow, title, subtitle, actionsWrap, body
```

### What the preset does NOT cover

- **Colors / fonts / radii / shadows** — those are theme-level (CSS vars in `themes.css`). Presets compose Tailwind utilities that resolve to those vars, so a preset stays theme-agnostic.
- **Behavior / interaction** — pagination logic, search filtering, row-action wiring stay in the components. Presets are pure styling.
- **Component shape / accessibility contracts** — the `<nav aria-label="Breadcrumb">`, `<th scope="col">`, `aria-current="page"` markup is invariant across presets.

### Swapping in tests

The active preset is module-level. Tests reset it in `afterEach` to keep parallel test files isolated:

```ts
import { afterEach } from "vitest";
import { resetActivePreset } from "../preset";

afterEach(() => resetActivePreset());
```

## 10. Component Change Process

Use this flow when you need a primitive to look or behave differently. Following the right path keeps the design system consistent and reversible.

### Decision tree — pick one

```
Q: Do you want the change to apply EVERYWHERE the primitive is used?
├─ YES, only colors/fonts/radii/shadows differ
│      → Edit themes.css. (Theme axis. No primitive change.)
├─ YES, layout/density/glyphs/variant maps differ
│      → Edit preset.ts (or ship a new Preset). (Preset axis.)
├─ NO, only this one call site needs it
│      → Pass `className` (or `actions`/`children`) at the call site.
│        Don't fork the component.
├─ The primitive needs a NEW capability (e.g. sortable columns)
│      → Extend the primitive's props + the relevant Preset slot.
│        Update design.md § 4 (Primitives — API). Add tests.
└─ The behavior is genuinely page-specific (e.g. one-off detail layout)
       → Compose primitives + Tailwind utilities at the page level.
         No new shared primitive.
```

### Recipe — change ONE primitive globally

Worked example: switch every breadcrumb separator from `/` to `›`.

1. Open `client/src/components/ui/preset.ts`.
2. Change `defaultPreset.breadcrumb.separatorGlyph` from `"/"` to `"›"`.
3. `pnpm test:run` — Breadcrumb tests should still pass (the assertion is on
   the `aria-current` link structure, not the glyph).
4. Commit. Done. All 9 dashboard pages now show chevrons.

### Recipe — add a NEW capability to a primitive

Worked example: add sortable columns to `<DataTable>`.

1. **Spec the change** here in `design.md` § 4 first (API + behavior). One sentence per prop.
2. **Extend the type**: add `column.sortable?: boolean` and `onSortChange?: (id, dir) => void` to `Column<T>` / `DataTableProps<T>` in `DataTable.tsx`.
3. **Extend the preset**: add `table.thSortable`, `table.sortIcon` slots to `TablePreset` in `preset.ts`. Update `defaultPreset` AND `compactPreset` so the swap axis stays complete.
4. **Implement** in `DataTable.tsx` — render an interactive `<th>` when `column.sortable`, call `onSortChange` on click.
5. **Test** in `__tests__/DataTable.test.tsx` — render a sortable column, click the header, assert `onSortChange` called with `(id, "asc"|"desc")`.
6. **Migrate one consumer** (e.g. `SecuritySessionsView`) to prove the API is ergonomic.
7. **Run** `pnpm test:run` and `pnpm build` — both must be green before committing.

### Recipe — one-off override at a single call site

Don't fork the component. Use the escape hatches the API already provides.

```tsx
// Wider search box, custom danger button, in this page only:
<DataTable
  data={…}
  columns={…}
  className="max-w-3xl"                      // override shell width
  toolbarTitle={<span className="text-warning">Audit log</span>}
/>
<Button variant="primary" className="rounded-full">Save</Button>
```

`className` on every primitive is concatenated AFTER preset classes, so Tailwind's later-class-wins rule lets you override anything.

### Recipe — replace the entire skin

See § 9 ("Swapping the visual preset"). Three options:

1. `setActivePreset(compactPreset)` at app boot (uses the bundled compact preset).
2. Spread + override one slot — `setActivePreset({ ...defaultPreset, breadcrumb: {...} })`.
3. Ship a brand-new preset file (`brandPreset.ts`) and call `setActivePreset(brandPreset)`. Always update the `Preset` interface IF you add slots — TypeScript will keep both presets in sync.

### What NOT to do

| ❌ Anti-pattern | Why it's wrong | Do instead |
|---|---|---|
| Fork `<DataTable>` into `<DataTableV2>` for one page | Diverges. Bug fixes don't propagate. | Add a prop on `<DataTable>` OR override via `className`/`children`. |
| Hand-roll `<table>` again because "DataTable doesn't quite fit" | Loses search/filter/pagination/a11y for free. | Extend `<DataTable>`. If truly bespoke, add a comment in design.md explaining why. |
| Add Tailwind classes inline that hardcode hex/colors (`bg-zinc-200`) | Theme-blind. Breaks light/dark/forest swap. | Use `bg-surface`, `text-text-primary`, etc. |
| Edit a primitive's class strings inline (`<div className="bg-surface px-6 …">`) | Bypasses preset. New presets won't affect this code path. | Move the strings into `preset.ts`. |
| Update one preset slot but not the matching slot in `compactPreset` | TypeScript catches missing slots, but logically the alt skin is now incomplete. | Update both presets together. |
| Add a new `*.css` file under `client/src/pages/` | All page CSS was deleted in Phase 43 (E167–E170). New page styling goes through primitives. | Compose primitives + Tailwind utilities at the page level. If a shared pattern emerges, extract a primitive. |
| Add a new rule to `client/src/styles/common/*.css` | The `common/` layer is in legacy-trim mode; its remaining rules are all gated on a future epic deletion. | Add the styling to the relevant primitive's preset slot. |

### Checklist before merging a primitive change

- [ ] `pnpm test:run` passes
- [ ] `pnpm build` passes
- [ ] If a Preset slot was added: BOTH `defaultPreset` and `compactPreset` updated
- [ ] If API changed: `design.md` § 4 updated
- [ ] At least one consumer migrated to the new API in the same PR
- [ ] No new hardcoded Tailwind class strings appear in any primitive file (`grep -nE '"[^"]*(bg-|text-|border-|font-|rounded|px-|py-)[^"]*"' src/components/ui/*.tsx | grep -v preset.ts | grep -v __tests__` returns empty)

## 11. Future Extensions (not in this PR)

- `<Modal>` / `<Drawer>` — currently no shared primitive; build when 2+ pages need one.
- Server-side pagination — `<DataTable>` is currently client-side. When we wire server pagination, add a `pagination={{ controlled: true, page, total, onPageChange }}` prop.
- Sortable columns — add `column.sortable: true` + `onSortChange`. Trivial extension; ship when needed.
- `<Toast>` — owned by a future notifications epic.
- **More presets** — a `dense` (Bloomberg-terminal-ish) and a `roomy` (consumer SaaS) variant once we have evidence that two product surfaces want different densities.

---

**Owner:** design system primitives — `client/src/components/ui/`.
**Spec status:** ratified. Changes require a PR that updates this doc + at least one consumer.
