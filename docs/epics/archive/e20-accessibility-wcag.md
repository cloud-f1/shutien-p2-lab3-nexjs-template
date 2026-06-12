# E20 — Accessibility (WCAG 2.1 AA)

> **Size**: M (1-2 sessions) | **Depends on**: E18 (domain pages must exist)
> **Status**: spec

---

## Goal

Bring the entire client application to WCAG 2.1 AA compliance by adding ARIA landmarks, skip-navigation, `aria-describedby` for form errors, accessible icon alternatives, focus management on route transitions, and focus trapping in modals.

## Problem Statement

The current codebase has **~25 ARIA attributes** scattered across components, but lacks systematic accessibility coverage:

### What exists (good)
- `role="dialog"` + `aria-modal` + `aria-label` on all 4 modals (PlaceFormModal, PlaceDeleteConfirm, PortfolioFormModal, portfolio delete)
- `role="alert"` on error banners (FormBanner, PlacesPage, PortfoliosPage)
- `aria-current="page"` on active nav items (DashboardLayout, DashboardPage)
- `aria-expanded` + `aria-haspopup` on user dropdown (DashboardLayout)
- `aria-hidden="true"` on decorative elements (user avatar, chevron, empty-state icons)
- `aria-label` on theme buttons (LandingPage) and password toggle (PasswordField)
- `aria-pressed` on theme selector buttons (DashboardPage settings)
- `aria-label` on nav TOC in legal pages

### What is missing (problems)

1. **No ARIA landmarks** — No `role="banner"`, `role="navigation"`, `role="main"`, `role="contentinfo"` on page-level structure. Screen readers cannot navigate by landmark.

2. **No skip-navigation link** — Keyboard users must tab through the entire sidebar (12+ items) and topbar to reach main content on every page load.

3. **No `aria-describedby` on form fields** — When validation errors appear, screen readers announce the error text via the `aria-live` banner, but individual fields do not programmatically reference their error message. Users tabbing between fields get no per-field error context.

4. **Unicode icons lack accessible names** — Nav items use unicode characters as icons (`\u2B21`, `\u25EB`, `\u25C8`, `\u25CE`, `\u2191`, `/`, `\uD83D\uDCCD`, `\uD83D\uDCCA`) without `aria-hidden` on the icon `<span>` or `aria-label` on the button. Screen readers announce these as gibberish characters.

5. **No focus management on route transitions** — When navigating between routes (e.g., `/signin` to `/dashboard`), focus stays on the body element. WCAG 2.4.3 requires focus to move to the new page's main content region.

6. **Modal focus trapping incomplete** — Modals have `role="dialog"` + `aria-modal` but do not trap keyboard focus. Tab key can escape the modal overlay into background content. No initial focus on the first interactive element when modal opens. No focus restoration to the trigger element on close.

7. **Loading states not announced** — `PlacesPage` and `PortfoliosPage` show "Loading places..." / "Loading portfolios..." text but do not use `aria-live` or `role="status"` to announce loading state to screen readers.

8. **Landing page structure** — The landing page `<nav>` and `<footer>` use semantic HTML elements but lack explicit `role` attributes for older screen readers. The hero section and content sections lack a `<main>` wrapper.

---

## OpenAPI Changes

**None.** This is a client-only epic.

---

## Implementation Plan

### 1. Skip Navigation Link

**New component**: `src/components/SkipNav.tsx`

```tsx
// Visually hidden, visible on focus, jumps to #main-content
<a className="skip-nav" href="#main-content">
  Skip to main content
</a>
```

**CSS** (add to `src/styles/globals.css`):
```css
.skip-nav {
  position: absolute;
  top: -100%;
  left: 16px;
  z-index: 9999;
  padding: 12px 24px;
  background: var(--primary);
  color: var(--bg);
  font-family: var(--font-body);
  font-size: 14px;
  font-weight: 600;
  border-radius: 0 0 8px 8px;
  text-decoration: none;
  transition: top 0.15s;
}
.skip-nav:focus {
  top: 0;
}
```

**Integration**: Add `<SkipNav />` as the first child inside `<ThemeProvider>` in `App.tsx`. Each page layout must have `id="main-content"` on its `<main>` element.

### 2. ARIA Landmarks

Add semantic landmark roles to all page layouts:

| Layout | Element | Change |
|--------|---------|--------|
| **LandingPage** | `.landing-nav` | Already `<nav>` — add `aria-label="Main navigation"` |
| **LandingPage** | Hero + sections | Wrap in `<main id="main-content">` |
| **LandingPage** | `.landing-footer` | Already `<footer>` — add `role="contentinfo"` |
| **AuthLayout** | `.auth-nav` | Already `<nav>` — add `aria-label="Site navigation"` |
| **AuthLayout** | `.auth-main-content` | Already `<main>` — add `id="main-content"` |
| **AuthLayout** | `.auth-footer` | Already `<footer>` — add `role="contentinfo"` |
| **DashboardLayout** | `.sidebar` | Already `<aside>` — fine. `.sidebar-nav` is `<nav>` — add `aria-label="Dashboard navigation"` |
| **DashboardLayout** | `.main` | Change to `<main id="main-content">` |
| **DashboardLayout** | `.topbar` | Add `role="banner"` |
| **LegalLayout** | `.legal-nav` | Already `<nav>` — add `aria-label="Site navigation"` |
| **LegalLayout** | `.legal-wrap` | Already `<main>` — add `id="main-content"` |
| **LegalLayout** | `.legal-footer` | Already `<footer>` — add `role="contentinfo"` |
| **NotFoundPage** | Container | Wrap in `<main id="main-content">` |

### 3. `aria-describedby` on Form Error Messages

For every form field that renders a validation error, connect the error to its input via `aria-describedby`:

**Pattern** (applied consistently to all forms):
```tsx
<input
  id="si-email"
  aria-describedby={errors.email ? "si-email-error" : undefined}
  aria-invalid={!!errors.email}
  {...register("email")}
/>
{errors.email && (
  <div className="field-hint err" id="si-email-error">
    {errors.email.message}
  </div>
)}
```

**Files to modify**:
| File | Fields |
|------|--------|
| `SignInPage.tsx` | email, password |
| `SignUpPage.tsx` | display_name, email, password |
| `ForgotPasswordPage.tsx` | email |
| `ResetPasswordPage.tsx` | password (need to read file) |
| `PasswordField.tsx` | Accept `describedById` prop, add `aria-describedby` + `aria-invalid` |
| `PlaceFormModal.tsx` | name, latitude, longitude |
| `PortfolioFormModal.tsx` | name |

### 4. Accessible Icons (Replace Unicode Gibberish)

**Strategy**: Add `aria-hidden="true"` to all icon `<span>` elements so screen readers skip them. The button's text label already conveys meaning.

**DashboardLayout.tsx** — dropdown icons:
```tsx
<span className="dropdown-icon" aria-hidden="true">{"\u2699"}</span>
```
These already have visible text labels ("Settings", "Terms of Service", etc.), so `aria-hidden` on the icon span is sufficient.

**DashboardPage.tsx** — NAV_SECTIONS icon spans:
```tsx
// In DashboardLayout.tsx line 89:
<span className="nav-icon" aria-hidden="true">{item.icon}</span>
```
The `nav-icon` span renders unicode characters. Adding `aria-hidden="true"` here covers all sidebar nav items at once.

**LandingPage.tsx** — problem/agent/feature section icons:
```tsx
<span className="problem-icon" aria-hidden="true">&#x1F501;</span>
<span className="agent-icon" aria-hidden="true">&#x1F4D0;</span>
```
These are decorative — the adjacent text provides meaning.

**PlaceDetail.tsx** — back button arrow:
```tsx
<button>
  <span aria-hidden="true">{"\u2190"}</span> Back to list
</button>
```

### 5. Focus Management on Route Transitions

**New hook**: `src/hooks/useFocusOnNavigate.ts`

```tsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function useFocusOnNavigate() {
  const { pathname } = useLocation();

  useEffect(() => {
    // After route change, move focus to main content
    const main = document.getElementById("main-content");
    if (main) {
      main.setAttribute("tabindex", "-1");
      main.focus({ preventScroll: false });
    }
  }, [pathname]);
}
```

**Integration**: Call `useFocusOnNavigate()` inside `App.tsx` (within `<Routes>` context).

### 6. Modal Focus Trapping

**New hook**: `src/hooks/useFocusTrap.ts`

Handles:
- On open: save reference to trigger element, move focus to first focusable element inside modal
- On Tab/Shift+Tab: cycle focus within modal boundaries
- On close: restore focus to the saved trigger element
- On Escape: close modal

**Files to modify**:
| Modal | File |
|-------|------|
| PlaceFormModal | `src/pages/places/components/PlaceFormModal.tsx` |
| PlaceDeleteConfirm | `src/pages/places/components/PlaceDeleteConfirm.tsx` |
| PortfolioFormModal | `src/pages/portfolios/components/PortfolioFormModal.tsx` |
| Portfolio delete confirm | `src/pages/portfolios/PortfoliosPage.tsx` (inline modal) |

Each modal will call `useFocusTrap(ref, isOpen)` and add `onKeyDown` for Escape.

### 7. Loading State Announcements

Add `role="status"` and `aria-live="polite"` to loading indicators:

```tsx
// PlacesPage.tsx
<div className="places-loading" role="status" aria-live="polite">
  Loading places...
</div>

// PortfoliosPage.tsx
<div className="portfolios-loading" role="status" aria-live="polite">
  Loading portfolios...
</div>
```

### 8. Screen-Reader-Only Utility Class

Add `.sr-only` utility class to `globals.css`:

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
```

This is used for cases where visible text is absent but screen reader text is needed (e.g., icon-only buttons if any are added later).

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/components/SkipNav.tsx` | Skip-to-main-content link |
| `src/hooks/useFocusOnNavigate.ts` | Focus management on route change |
| `src/hooks/useFocusTrap.ts` | Focus trapping inside modals |

## Files to Modify

| File | Changes |
|------|---------|
| `src/App.tsx` | Add `<SkipNav />`, call `useFocusOnNavigate()` |
| `src/styles/globals.css` | Add `.skip-nav`, `.sr-only` styles |
| `src/components/DashboardLayout.tsx` | `aria-label` on `<nav>`, `<main>` with `id`, `aria-hidden` on nav-icon spans, `role="banner"` on topbar |
| `src/pages/LandingPage.tsx` | `<main>` wrapper, `aria-label` on nav, `aria-hidden` on decorative icons |
| `src/pages/auth/AuthLayout.tsx` | `id="main-content"` on `<main>`, `aria-label` on nav, `role="contentinfo"` on footer |
| `src/pages/auth/SignInPage.tsx` | `aria-describedby` + `aria-invalid` on email field |
| `src/pages/auth/SignUpPage.tsx` | `aria-describedby` + `aria-invalid` on display_name, email fields |
| `src/pages/auth/ForgotPasswordPage.tsx` | `aria-describedby` + `aria-invalid` on email field |
| `src/pages/auth/ResetPasswordPage.tsx` | `aria-describedby` + `aria-invalid` on password field |
| `src/pages/auth/components/PasswordField.tsx` | Accept error ID prop, add `aria-describedby` + `aria-invalid` |
| `src/pages/legal/LegalLayout.tsx` | `id="main-content"` on `<main>`, `aria-label` on nav, `role="contentinfo"` on footer |
| `src/pages/NotFoundPage.tsx` | Wrap in `<main id="main-content">` |
| `src/pages/places/PlacesPage.tsx` | `role="status"` on loading element |
| `src/pages/places/components/PlaceFormModal.tsx` | `aria-describedby` on fields, `useFocusTrap` |
| `src/pages/places/components/PlaceDetail.tsx` | `aria-hidden` on back arrow icon |
| `src/pages/places/components/PlaceDeleteConfirm.tsx` | `useFocusTrap` |
| `src/pages/portfolios/PortfoliosPage.tsx` | `role="status"` on loading, `useFocusTrap` on delete modal |
| `src/pages/portfolios/components/PortfolioFormModal.tsx` | `aria-describedby` on name field, `useFocusTrap` |
| `src/pages/portfolios/components/PortfoliosList.tsx` | Verify `role="button"` element has keyboard handler |
| `src/pages/dashboard/DashboardPage.tsx` | No structural changes (icons handled via DashboardLayout) |

---

## Test Plan

### axe-core Integration Tests

Install `vitest-axe` (or `jest-axe` adapter) and add `toHaveNoViolations` matcher.

**New test file**: `src/tests/a11y/accessibility.test.tsx`

| Test Case | What It Verifies |
|-----------|-----------------|
| LandingPage has no axe violations | Landmarks, headings, color contrast, link names |
| SignInPage has no axe violations | Form labels, error descriptions, landmarks |
| SignUpPage has no axe violations | Form labels, error descriptions, landmarks |
| ForgotPasswordPage has no axe violations | Form labels, landmarks |
| DashboardPage has no axe violations | Landmarks, nav labels, icon accessibility |
| PlacesPage (list) has no axe violations | Landmarks, table/list semantics |
| PlaceFormModal has no axe violations | Dialog role, form labels, error descriptions |
| PortfoliosPage (list) has no axe violations | Landmarks, card semantics |
| PortfolioFormModal has no axe violations | Dialog role, form labels, error descriptions |
| LegalPage (privacy) has no axe violations | Landmarks, heading hierarchy |
| NotFoundPage has no axe violations | Landmarks, heading hierarchy |

### Skip Navigation Tests

| Test Case | What It Verifies |
|-----------|-----------------|
| Skip link is hidden by default | Not visible in normal flow |
| Skip link becomes visible on focus | CSS `:focus` positioning |
| Skip link targets `#main-content` | `href` attribute value |
| Clicking skip link moves focus to main | `document.activeElement` check |

### Form `aria-describedby` Tests

| Test Case | What It Verifies |
|-----------|-----------------|
| SignIn email field has `aria-describedby` when error shown | Attribute matches error element ID |
| SignIn email field has `aria-invalid="true"` when error shown | Boolean attribute |
| SignUp all fields connect errors via `aria-describedby` | 3 fields validated |
| PlaceFormModal connects name/lat/lng errors | `aria-describedby` IDs match |
| PortfolioFormModal connects name error | `aria-describedby` ID matches |
| No `aria-describedby` when no errors | Attribute absent or undefined |

### Focus Management Tests

| Test Case | What It Verifies |
|-----------|-----------------|
| Focus moves to main content on route change | `document.activeElement` after navigation |
| PlaceFormModal traps focus | Tab cycles within modal |
| PlaceFormModal restores focus on close | Focus returns to trigger button |
| PlaceDeleteConfirm traps focus | Tab cycles within modal |
| PortfolioFormModal traps focus | Tab cycles within modal |
| Portfolio delete modal traps focus | Tab cycles within modal |
| Escape key closes modals | `onClose` called on Escape |
| Modal focuses first interactive element on open | Initial focus check |

### Icon Accessibility Tests

| Test Case | What It Verifies |
|-----------|-----------------|
| Nav icon spans have `aria-hidden="true"` | All `.nav-icon` elements |
| Dropdown icon spans have `aria-hidden="true"` | All `.dropdown-icon` elements |
| Landing page decorative icons have `aria-hidden="true"` | `.problem-icon`, `.agent-icon` elements |

### Loading State Tests

| Test Case | What It Verifies |
|-----------|-----------------|
| Places loading has `role="status"` | Live region for screen readers |
| Portfolios loading has `role="status"` | Live region for screen readers |

---

## Acceptance Criteria

- [ ] Skip-navigation link renders as first focusable element, visible on focus, targets `#main-content`
- [ ] All page layouts have proper ARIA landmarks (`<main id="main-content">`, `<nav aria-label>`, `<footer>`)
- [ ] All form fields with validation errors have `aria-describedby` pointing to their error message element
- [ ] All form fields with validation errors have `aria-invalid="true"`
- [ ] All decorative unicode icon spans have `aria-hidden="true"`
- [ ] Focus moves to `#main-content` on every route transition
- [ ] All 4 modals trap focus (Tab cycles within, Escape closes)
- [ ] All 4 modals restore focus to trigger element on close
- [ ] All 4 modals focus the first interactive element on open
- [ ] Loading states use `role="status"` for screen reader announcement
- [ ] `.sr-only` utility class available in `globals.css`
- [ ] axe-core integration tests pass with zero violations on all pages
- [ ] All new tests pass, existing tests unbroken
- [ ] Coverage remains >= 80%

---

## WCAG 2.1 AA Success Criteria Addressed

| Criterion | Description | How Addressed |
|-----------|-------------|---------------|
| 1.3.1 | Info and Relationships | ARIA landmarks, `aria-describedby` on form errors |
| 2.1.1 | Keyboard | Focus trapping in modals, skip-nav link |
| 2.1.2 | No Keyboard Trap | Escape key closes modals, focus restored |
| 2.4.1 | Bypass Blocks | Skip-navigation link |
| 2.4.3 | Focus Order | Focus management on route transitions, modal focus trapping |
| 2.4.6 | Headings and Labels | `aria-label` on navigation regions |
| 3.3.1 | Error Identification | `aria-describedby` connects fields to error messages |
| 3.3.2 | Labels or Instructions | All fields already have `<label htmlFor>` (verified) |
| 4.1.2 | Name, Role, Value | `aria-hidden` on decorative icons, `role="dialog"` on modals |
| 4.1.3 | Status Messages | `role="status"` on loading indicators, `role="alert"` on errors |
