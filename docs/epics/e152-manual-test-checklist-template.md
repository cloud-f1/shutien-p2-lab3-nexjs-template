# E152 — Manual Test Checklist Template

> Phase 38 — Cross-Project Extraction | Size: S (2 SP) | Deps: none
> Source: ai-casino-shift E220

## Problem

Automated tests can't catch everything — visual regressions, UX flow issues, mobile responsiveness, and cross-browser quirks need human eyes. But without a structured checklist, manual QA is ad-hoc and inconsistent. Casino-shift's 30-scenario checklist caught bugs that 1,100+ automated tests missed.

## Solution

Create `docs/templates/manual-test-checklist.md` — a role-based manual testing template with scenarios grouped by user role (Admin, User, Guest) and cross-cutting concerns (a11y, mobile, security).

## Key Files

| File | Action |
|------|--------|
| `docs/templates/manual-test-checklist.md` | New — reusable checklist (~80 lines) |
| `docs/templates/` | Exists — created by E151 if not present |
| `docs/epics/e152-manual-test-checklist-template.md` | New — this spec |

## Acceptance Criteria

1. Scenarios grouped by role: Admin (5+), User (5+), Guest (3+), Cross-cutting (5+)
2. Each scenario has: description, steps, expected result, pass/fail column
3. Cross-cutting section covers: keyboard navigation, mobile viewport, error states, loading states, auth expiry
4. Template uses placeholder markers for project-specific routes and accounts
5. Header includes "last tested" date field and tester name
6. Markdown table format — pasteable into GitHub issue for tracking

## Design Notes

- Casino-shift's checklist is 30 scenarios across 4 roles — GA gate requirement
- Manual testing fills the gap between E2E automation and real user experience
- Template should be lean (30-40 scenarios) — projects customize by adding domain-specific rows
- Companion to E151 (unified test plan) — the plan defines *what* to test, this checklist defines *how* to verify manually
