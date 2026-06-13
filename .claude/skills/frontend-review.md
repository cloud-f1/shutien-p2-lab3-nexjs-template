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

## React / Next.js Patterns — Block/Warn

**Block:**
- Adding `"use client"` to a component that has no browser APIs, event handlers, or hooks — keep it a Server Component
- Auth guards on the client side (`useSession` redirect logic) instead of `middleware.ts` for route protection
- Raw HTML injection without sanitization (use safe React nodes and JSX)
- `fireEvent` in tests instead of `userEvent.setup()`

**Warn:**
- Side-effect buttons (logout, delete, submit) missing `disabled` while pending
- Click-outside handlers missing `e.target instanceof Node` guard before `.contains()`
- `useEffect` for data fetching — fetch in Server Components or Server Actions instead
- Passing sensitive data as props through many layers — fetch it in the nearest Server Component
- Not using `revalidatePath()` / `revalidateTag()` after a Server Action mutation → stale RSC cache

## Next.js Specific — Warn

- Missing `loading.tsx` for routes with async data fetching → no loading UI
- Missing `error.tsx` for routes that can throw → unhandled error boundary
- `NEXT_PUBLIC_*` env vars containing secrets → these are baked into the client bundle
- Fetching the same data in multiple Server Components without using `cache()` → duplicate DB calls
- Using `router.push()` for post-mutation navigation in a Server Action — use `redirect()` from `next/navigation`

## CSS Patterns — Warn / Block

- **Block (Rule #21)**: New co-located `*.css` files alongside page components → use Tailwind utilities; stop-verifier will reject
- **Block (Rule #22)**: New CSS selectors added to global CSS files → new visuals belong in `components/ui/` Tailwind classes; stop-verifier will reject
- CSS custom properties (design tokens) live in `next-app/app/globals.css` — flag any `:root` token definitions placed elsewhere as duplicates
- Hardcoded hex/rgb values instead of CSS custom properties or Tailwind tokens → warn
- Inline `style=` color overrides instead of `dark:` Tailwind variants → warn (also caught by stop-verifier)

## Security — Block

- `NEXT_PUBLIC_*` env vars containing API keys or secrets → server-only vars have no `NEXT_PUBLIC_` prefix
- API keys or secrets in Client Components → server-side only (Route Handlers, Server Actions)
- User input rendered without escaping → XSS risk
- `target="_blank"` without `rel="noopener noreferrer"` → tabnabbing

## Performance — Warn

- Large components (>500 lines) without splitting
- Missing `React.memo` on expensive pure components that re-render frequently
- Inline object/array creation in JSX props → unnecessary re-renders
- Missing `key` prop or using array index as key for dynamic lists
- Unoptimized images (missing width/height, no lazy loading for below-fold)
