# Manual Test Plan — Run Results: 2026-07-08

> 1st run. Scaffold run for E321 — verifies the manual-test-plan structure itself
> (suite files exist, case format is followable, cross-references to the automated
> test files resolve) rather than a full P0-through-P2 execution pass.

## Summary

| Suite | Cases | Pass | Fail | Not run |
|---|---:|---:|---:|---:|
| S1 — Auth + RBAC | 10 | 0 | 0 | 10 |
| S2 — Items CRUD + List/Filter | 10 | 0 | 0 | 10 |
| **Total** | **20** | **0** | **0** | **20** |

## Notes

- This is the **scaffold run** accompanying E321 (Test Pyramid Middle Layer + QA
  Process) — the suites were authored and cross-checked against the real UI copy
  (button labels, field labels, placeholder text) but not yet walked end-to-end by
  a human tester against a running instance.
- Before the next dated run: `docker compose up --build -d` (repo root), confirm
  `pnpm db:seed` has run, then execute S1 → S2 in priority order per
  [README.md §6](./README.md#6-execution--reporting) and fill in this table for
  real, with Fail root-causes annotated directly on the case in `s1-auth.md` /
  `s2-items.md` (not just here — see README §6's Fail-triage rule).
- Once a real pass exists, add its own `test-results-YYYY-MM-DD.md` file rather
  than overwriting this one.
