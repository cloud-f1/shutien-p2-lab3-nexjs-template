---
name: frontend-review
description: >
  Frontend code review checklist for React/TypeScript/CSS. Use this skill when reviewing
  .tsx or .css files, running quality checks on client code, fixing accessibility issues,
  or evaluating frontend PRs. Also use when someone asks about a11y requirements, React
  anti-patterns, CSS architecture, or frontend performance concerns in this project.
---

# Frontend Review Checklist — AI-Coding-Template

## Accessibility (a11y) — Block

Interactive elements must be semantic HTML:
- Clickable → `<button>` (not `<div onClick>`)
- Navigation → `<a>` or `<Link>` (not `<div onClick={() => navigate()}>`)
- Toggle → `<button aria-expanded={open}>` with `aria-haspopup` if dropdown

ARIA requirements:
- Dropdowns: trigger needs `aria-expanded`, `aria-haspopup="menu"`; menu needs `role="menu"`
- Current page: `aria-current="page"` on active nav item
- Icon-only buttons: `aria-label="descriptive text"`
- Decorative icons: `aria-hidden="true"`
- Breadcrumbs: `<nav aria-label="Breadcrumb">`
- Form inputs: always pair with `<label>` or `aria-label`

## React Patterns — Block/Warn

**Block:**
- Auth guards using raw `getAccessToken()` instead of reactive `useAuthStore`
- Raw HTML injection without sanitization (use safe React nodes and JSX)
- `fireEvent` in tests instead of `userEvent.setup()`

**Warn:**
- Side-effect buttons (logout, delete, submit) missing `disabled={mutation.isPending}`
- Click-outside handlers missing `e.target instanceof Node` guard before `.contains()`
- Uncontrolled checkboxes with `readOnly` instead of `defaultChecked`
- Missing `onSettled` invalidation on mutations (only `onSuccess` is incomplete)
- Hardcoded `staleTime` instead of importing from `CACHE_TIERS`
- `useEffect` for data fetching instead of React Query
- Inline MSW handlers in test files instead of `src/tests/handlers/`

## React Query Anti-Patterns — Warn

- `onSuccess` without `onSettled` for cache invalidation → stale data on error
- `enabled: true` when it should depend on auth state or a prerequisite query
- Missing `queryKey` specificity → cache collisions between different entities
- Calling `queryClient.setQueryData` without also invalidating → stale cache risk
- Not using `CACHE_TIERS` constants → inconsistent cache behavior

## CSS Patterns — Warn / Block

- **Block (Rule #21)**: New files matching `client/src/pages/**/*.css` → compose `components/ui/` primitives instead; stop-verifier will reject
- **Block (Rule #22)**: New CSS selectors added under `client/src/styles/common/` → new visuals belong in `components/ui/` Preset slots; stop-verifier will reject
- Design tokens (47 CSS vars, 6 themes) live in `src/styles/themes.css` — flag any `:root` token definitions placed elsewhere as duplicates
- Hardcoded hex/rgb values instead of CSS custom properties → warn
- Duplicate token definitions across CSS files → warn
- New page co-locating its own `.css` file instead of composing `components/ui/` primitives → block (Rule #21)
- Button reset missing when `<button>` styled as nav items:
  `background: none; border: none; font-family: inherit; width: 100%; text-align: left;`

## Security — Block

- Access token in `localStorage` or cookies → must use in-memory tokenCache
- API keys or secrets in client code → server-side only
- User input rendered without escaping → XSS risk
- `target="_blank"` without `rel="noopener noreferrer"` → tabnabbing

## Performance — Warn

- Large components (>500 lines) without splitting
- Missing `React.memo` on expensive pure components that re-render frequently
- Inline object/array creation in JSX props → unnecessary re-renders
- Missing `key` prop or using array index as key for dynamic lists
- Unoptimized images (missing width/height, no lazy loading for below-fold)
