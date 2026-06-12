# E135 — Context Budget Tracking [S, 3 SP]

## Goal
Add a measurable budget for `docs/context/` files and enforce it via a check script wired into `make doctor`.

## Deliverables
1. `docs/CONTEXT_BUDGET.md` — budget policy document (~30 lines)
2. `scripts/checks/check-context-budget.sh` — measures total + per-file line counts, exits non-zero on overage
3. Wire into `scripts/doctor.sh` as a new diagnostic section

## Budget Limits
- `docs/context/*.md` total: < 2,000 lines
- Individual file: < 200 lines (session-summary: < 300)
- `MEMORY.md`: < 200 lines
- SessionStart injection: < 500 lines

## Acceptance Criteria
- `bash scripts/checks/check-context-budget.sh` runs cleanly on current repo
- `bash scripts/doctor.sh` includes context budget section
- Script is executable (`chmod +x`)
