# E98 — Stop Verifier v3 — Test Quality Rules

> **Phase 28** | Priority: P0 | Points: 8 | Size: M
> **Depends on**: none

---

## Problem Statement

The stop verifier (8 rules) enforces code quality but has zero test quality rules. Agents can write tests that pass coverage gates yet violate core testing principles: testing implementation details via `assert_called_once_with` on internal functions, duplicating test logic instead of using `parametrize`, over-mocking with excessive `mock.patch`, and writing monolithic test files.

These anti-patterns are the most common failures identified in test-master.md's AI Agent Guidelines section. Automated guardrails catch them before they land.

## Stories

### S1: Rule 9 — No Internal Mock Assertions

**AC:**
- [ ] Verifier flags `assert_called_once_with`, `assert_called_with`, `assert_any_call` when the target is a project-internal function (path contains `server/app/` or `client/src/`)
- [ ] Does NOT flag mocks of external dependencies (third-party libs, DB, network)
- [ ] Exit code 2 (warning) not blocking — educates agents without hard-blocking (same as existing convention)
- [ ] Shell script uses labeled comments: `# Rule 9: No Internal Mock Assertions`
- [ ] Test: create a test file with internal mock assertion → verifier warns

### S2: Rule 10 — Parametrize Nudge

**AC:**
- [ ] Verifier warns when a test file contains 3+ test functions with near-identical structure
- [ ] Detection heuristic: same assertion pattern with only input values differing
- [ ] Suggests `@pytest.mark.parametrize` (server) or `it.each` (client)
- [ ] Exit code 2 (warning)

### S3: Rule 11 — Mock Depth Limit

**AC:**
- [ ] Verifier warns when a single test file has >5 `mock.patch` or `@patch` decorators
- [ ] Suggests refactoring to use DI fixtures instead of patching
- [ ] Exit code 2 (warning)

### S4: Rule 12 — Test File Size Warning

**AC:**
- [ ] Verifier warns when any `test_*.py` or `*.test.ts` file exceeds 200 lines
- [ ] Suggests splitting into focused test modules
- [ ] Exit code 2 (warning)

### S5: Update Documentation

**AC:**
- [ ] `scripts/hooks/CLAUDE.md` updated with rules 9-12
- [ ] Root `CLAUDE.md` updated: "8 rules" → "12 rules"
- [ ] All references to verifier rule count updated across docs

## Risk Notes

- Rule 10 (parametrize nudge) has highest false-positive risk — heuristic detection of "similar structure" is imprecise. Start with conservative detection.
- All new rules are warnings (exit 2), not blockers (exit 1). Can be promoted to blockers after tuning.

## Files to Touch

```
scripts/hooks/stop-verifier.sh       — update: add rules 9-12
scripts/hooks/CLAUDE.md              — update: document new rules
CLAUDE.md                            — update: rule count 8→12
docs/reference/commands.md           — update: verifier description
```
