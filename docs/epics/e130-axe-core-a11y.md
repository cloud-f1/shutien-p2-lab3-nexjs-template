# E130 — Axe-Core A11y Scaffold

> **Size**: S (3 SP) | **Phase**: 33 | **Deps**: none

## Goal

Add automated accessibility testing using `@axe-core/playwright` to the E2E suite.
Three auth pages (`/signin`, `/signup`, `/forgot-password`) scanned for WCAG 2.0 A/AA violations.

## Design

- Install `@axe-core/playwright` as devDependency in `client/`
- Create `client/e2e/a11y.spec.ts` with 3 tests (one per page)
- Each test navigates to the page, runs AxeBuilder with `wcag2a` + `wcag2aa` tags
- Filter results to `critical` and `serious` impact only
- Log violation details on failure for debugging

## Files Changed

| File | Action |
|------|--------|
| `client/package.json` | add `@axe-core/playwright` devDep |
| `client/e2e/a11y.spec.ts` | new — 3 WCAG tests |
