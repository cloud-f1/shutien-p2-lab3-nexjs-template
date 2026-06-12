# E172 — i18n for Primitive-Internal Strings

> Phase 44 — Design System Completion & Validation | Size: S (3 SP) | Deps: E167

## Problem

The 18 primitives shipped in E167–E169 hardcode English strings that surface in every locale:

| Primitive | Hardcoded strings |
|---|---|
| `<DataTable>` | `"Loading…"`, `"Search"` (default placeholder), `"Actions"` (default actions header), `"No data."` (default empty), `"Failed to load data."` (default error) |
| `<Pagination>` | `"Previous page"`, `"Next page"`, `"Page {n}"`, `"X–Y of N"` summary |
| `<SearchInput>` | `"Search"` (default placeholder + aria-label fallback) |
| `<FormField>` | (no internal strings — labels come from consumer) |
| `<Banner>` (E169) | (no internal strings) |

This SaaS ships **English + 繁中 (zh-TW)** today and the `i18next` setup already has detection, namespaces, and fallback wired. A 繁中 user landing on `/dashboard/sessions` sees Chinese page titles but English pagination chrome — visible inconsistency.

## Solution

Add a `ui` i18n namespace (`client/src/locales/{en,zh-TW}/ui.json`) holding every primitive-internal string. Each primitive imports `useTranslation("ui")` and reads the relevant key, with the existing prop (`searchPlaceholder`, `emptyMessage`, etc.) overriding the i18n default when supplied.

### Keys to register

```json
{
  "table": {
    "loading": "Loading…",
    "actions": "Actions",
    "noData": "No data.",
    "loadError": "Failed to load data."
  },
  "pagination": {
    "previous": "Previous page",
    "next": "Next page",
    "page": "Page {{n}}",
    "summary": "{{start}}–{{end}} of {{total}}"
  },
  "search": {
    "placeholder": "Search"
  },
  "breadcrumb": {
    "label": "Breadcrumb"
  }
}
```

繁中 (zh-TW) translations:
```json
{
  "table": {
    "loading": "載入中…",
    "actions": "操作",
    "noData": "沒有資料。",
    "loadError": "載入失敗。"
  },
  "pagination": {
    "previous": "上一頁",
    "next": "下一頁",
    "page": "第 {{n}} 頁",
    "summary": "{{start}}–{{end}} / 共 {{total}}"
  },
  "search": {
    "placeholder": "搜尋"
  },
  "breadcrumb": {
    "label": "麵包屑導覽"
  }
}
```

### Prop precedence

Existing props win:

```ts
const { t } = useTranslation("ui");
// `searchPlaceholder` consumer-supplied prop overrides the i18n key
const placeholder = searchPlaceholder ?? t("search.placeholder");
```

That keeps SecuritySessionsView's `"Search sessions"` working without churn.

## Key Files

| File | Action |
|---|---|
| `client/src/locales/en/ui.json` | New — base translations |
| `client/src/locales/zh-TW/ui.json` | New — 繁中 translations |
| `client/src/i18n.ts` | Edit — register `ui` namespace |
| `client/src/components/ui/{DataTable,Pagination,SearchInput,Breadcrumb}.tsx` | Edit — `useTranslation("ui")`, fall back to prop or key |
| `client/src/components/ui/__tests__/i18n.test.tsx` | New — render `<Pagination>` under both locales, assert different rendered glyphs |
| `docs/design/design.md` | Edit — § 4 prop tables note "defaults pull from `ui` namespace"; new § 8.5 "Adding a locale" recipe |

## Implementation

1. Create `ui.json` files (EN + zh-TW). Keep flat structure; namespace via i18next dot keys.
2. Register `ui` namespace in `i18n.ts` alongside `dashboard`, `auth`, etc.
3. Edit each affected primitive: add `useTranslation("ui")`, replace string literal with `prop ?? t(key)`.
4. Add a focused i18n test that mounts `<Pagination>` with `i18n.changeLanguage("zh-TW")` and asserts "上一頁" / "下一頁" appear.
5. Update existing tests if they query by English text — switch to role-based queries where possible (`getByRole("button", { name: /previous/i })` works for both locales when the test is locale-set to EN).
6. Spot-check the dashboard pages under `/?lng=zh-TW` — pagination + search + actions should all render in 繁中.

## Acceptance Criteria

- [ ] `ui` namespace registered, both locale files committed
- [ ] Every hardcoded English string in `components/ui/*.tsx` replaced with `t(key)` or prop fallback
- [ ] One co-located test asserts a primitive renders the 繁中 string when locale is set
- [ ] No existing test fails (locale defaults to EN in test setup)
- [ ] `pnpm build` green, no new bundle size beyond ~1 kB for the locale files
- [ ] `design.md` documents the namespace + recipe for adding a third locale (e.g. `ja`, `es`)
- [ ] Manual sweep: switch the dashboard to 繁中, every primitive renders Chinese chrome

## Alignment / Cross-Epic Hooks

- **Hard-depends on E167** — uses the primitives shipped there.
- **Soft-depends on E168/E169** — those add public/auth primitives that may need their own keys; this epic handles the existing dashboard primitives.
- **Establishes the contract for E173/E174/E175/E178** — every new primitive shipped in Phase 44 MUST register its internal strings in `locales/{en,zh-TW}/ui.json` as part of its own PR (e.g. `<Modal>` close button label, `<Toast>` dismiss button, `<Tabs>` keyboard hint). Each epic's acceptance criteria should reference E172's namespace; reviewer checks for "primitive added but no `ui.json` entry" during code review.
- **Pairs with E177** (a11y) — translated `aria-label` text is a real a11y win for screen-reader users in non-EN locales.
- **Reads from**: existing `i18n.ts`, `dashboard.json`, `auth.json` namespace patterns.

## Out of Scope

- **Translating user-visible English strings in pages** (e.g. `LandingPage` hero copy) — page i18n is owned by each page's existing namespace, not this epic.
- **RTL languages** (Arabic, Hebrew) — no current demand; would need additional CSS `dir="rtl"` work.
- **Pluralization rules** — ICU MessageFormat is not yet wired; current strings don't need it. Revisit when a primitive ships a "{count} item|items" string.
- **Number / date / currency formatting** — `Intl` API is enough; no formatter primitive in this epic.
