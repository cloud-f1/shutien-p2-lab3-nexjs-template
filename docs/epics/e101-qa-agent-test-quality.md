# E101 — QA Agent Enhancement — Test Quality Audit

> **Phase 28** | Priority: P1 | Points: 8 | Size: M
> **Depends on**: E97, E98

---

## Problem Statement

The `@qa` agent currently measures test quality by a single metric: coverage percentage. A codebase can achieve 90% coverage with entirely brittle tests that mock everything and test implementation details. Coverage is necessary but not sufficient.

After E97 (skill with 10 principles) and E98 (verifier with 4 test quality rules), the QA agent needs to synthesize these into a **Test Quality Score** that goes beyond coverage — measuring behavior-vs-implementation ratio, mock hygiene, triangulation usage, and contract coverage.

## Stories

### S1: Test Quality Metrics Collection

**AC:**
- [ ] `@qa` agent collects 4 metrics during test runs:
  1. **Behavior ratio**: % of test assertions on outputs vs % on mock calls
  2. **Mock depth**: average `mock.patch` count per test file
  3. **Parametrize rate**: % of test functions using `parametrize` or `it.each`
  4. **Contract coverage**: % of endpoints with contract tests (from E99)
- [ ] Metrics collected via grep/analysis of test files (no new runtime deps)
- [ ] Results stored in `docs/context/test-status.md` alongside coverage numbers

### S2: Test Quality Score Report

**AC:**
- [ ] `/athena:qa` output includes Test Quality Score section:
  ```
  Test Quality Report:
  ├── Coverage: 92.65% ✅ (gate: 90%)
  ├── Behavior Tests: 85% ✅ (target: >70%)
  ├── Mock Depth: 2.1 avg ✅ (target: <5)
  ├── Parametrize Rate: 60% 🟡 (target: >50%)
  └── Contract Coverage: 100% ✅ (target: 100%)
  ```
- [ ] Overall score: ✅ if all targets met, 🟡 if 1-2 below, ❌ if 3+ below
- [ ] Score does NOT block merges (advisory only) — coverage gate remains the blocker

### S3: QA Agent Prompt Enhancement

**AC:**
- [ ] `.claude/agents/qa.md` updated to include test quality audit in its workflow
- [ ] Agent reads E97 skill principles when auditing test quality
- [ ] Agent references E98 verifier rules for automated checks
- [ ] Suggestions section in QA report: specific improvements ranked by impact

### S4: Update Test Status Context Doc

**AC:**
- [ ] `docs/context/test-status.md` format extended with quality metrics columns
- [ ] Historical quality scores tracked (append-only)
- [ ] `@qa` agent writes quality metrics on every `/athena:qa` run

## Risk Notes

- Metric collection via grep/static analysis is approximate — not perfect accuracy
- "Behavior ratio" is the hardest to measure statically (heuristic: assertions on `response.status_code`, `response.json()` = behavior; `mock.assert_called` = implementation)
- Advisory-only scoring avoids blocking legitimate test patterns while nudging toward better ones
- Depends on both E97 (defines what "good" tests look like) and E98 (provides automated rule checks)

## Files to Touch

```
.claude/agents/qa.md                 — update: add test quality audit workflow
docs/context/test-status.md          — update: extend format with quality metrics
.claude/commands/athena/qa.md        — update: add quality score to output format
```
