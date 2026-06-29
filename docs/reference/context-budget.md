# Context Budget Strategy

## 1M Context Era
With Opus 4.6 defaulting to 1M context, session-start injection is no longer aggressively truncated.
However, unbounded growth of context documents degrades agent performance (noise drowns signal).

## Budget
- `docs/context/*.md` total: **< 2,000 lines**
- Individual file: **< 200 lines** (except session-summary which can reach 300)
- `MEMORY.md`: **< 200 lines** (index only, content in topic files)
- SessionStart injection: **< 500 lines** (< 0.05% of 1M)

## Enforcement
- `scripts/checks/check-context-budget.sh` measures total and flags overages
- `make doctor` includes context budget check
- `/athena:learn` command triggers periodic hygiene sweeps

## When Over Budget
1. Archive historical entries to `docs/context/archive/`
2. Summarize repetitive entries (e.g., merge 10 debug entries into 1 pattern)
3. Promote generalizable lessons to Tier 0 via `/athena:promote`
