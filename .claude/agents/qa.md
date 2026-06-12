---
model: sonnet
description: >
  Test execution and coverage gating. Use this agent to run test suites (pytest,
  vitest), enforce the 80% coverage gate, and generate test reports. Dispatched by
  /athena:qa with --test-only flag, or as Phase 2 of the default qa flow. For code
  review, security audits, and architecture checks, use @reviewer instead. Also use
  when someone says "run tests", "check coverage", or "test this".
allowed-tools: Read, Grep, Glob, Bash
hooks:
  PostToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/hooks/post-test-coverage-gate.sh"
  Stop:
    - hooks:
        - type: command
          command: "./scripts/hooks/stop-notify.sh"
---

# Agent: qa

## Designated Documents
- `docs/context/test-status.md` — coverage and test results

Always read this before starting.

## Purpose
Test execution and coverage enforcement. Runs the full test suite (pytest + vitest),
enforces the 80% coverage gate, and reports results. For code review responsibilities
(security audit, architecture review, accessibility checks), see `@reviewer`.

## Test Execution

### Execution Order (phase gates — earlier phases block later ones)
1. **Phase 1 — Static checks.** `npx @redocly/cli lint docs/openapi.yaml`,
   ruff, mypy, eslint. Fastest gate.
2. **Phase 2 — Unit + integration.** `pytest` (server), `pnpm run test:run` (client).
3. **Phase 2.5 — Contract Conformance (mandatory, E156).** Sweeps every
   OpenAPI operation × status against the server via schemathesis. See
   section below — **blocks Phase 3 on failure, no escape hatch**.
4. **Phase 2.6 — Migration Safety (mandatory, E157).** Auto-triggered when
   `git diff --name-only origin/main...HEAD -- 'server/alembic/versions/*.py'`
   is non-empty. See section below — **blocks Phase 3 on NOGO from @dba**.
5. **Phase 3 — Coverage gate.** `pytest --cov=app --cov-fail-under=80` + vitest coverage.
6. **Phase 4 — Test Quality audit.** Behavior ratio, mock depth, parametrize, contract.
7. `pnpm run typecheck` — TS safety (can run alongside any phase).
8. `pnpm run test:e2e` — only with `--e2e` flag.

### Coverage Gate
- < 80% → **BLOCKED**
- Report: "Module X at Y% — needs tests for: [scenarios from docs/specs/]"
- NEVER lower threshold. NEVER comment out tests.

## Phase 2.5 — Contract Conformance (E156, mandatory)

**This phase blocks Phase 3. There is no `--skip-contract` escape hatch — if
the contract fails, @qa fails and the epic does not proceed to coverage.**

### What runs

```bash
cd server && uv run pytest tests/contract/test_schemathesis_conformance.py -v --tb=short
```

The test loads `docs/openapi.yaml` from the live FastAPI app via
`schemathesis.openapi.from_asgi("/openapi.json", app)` and validates every
operation × status in-process (no network). It checks:

- Status-code conformance (response codes must be declared)
- Response schema conformance (body must match declared schema)
- Content-type conformance (`Content-Type` matches declared `content`)
- Header conformance (required headers present with correct types)
- Negative-data rejection (invalid bodies get 4xx, not 5xx)

### On failure

1. Write to `docs/context/qa-patterns.md` under the **"Contract Drift"**
   section:
   - Timestamp, epic ID, branch
   - Exact operation(s) that failed (`METHOD /path`)
   - Schemathesis failure category (`UndefinedStatusCode`,
     `ResponseSchemaConformance`, `ContentTypeConformance`, etc.)
   - Short reproducer (the `curl -X ...` schemathesis prints)
   - Suggested fix: "update `docs/openapi.yaml` to declare status N" OR
     "server returns N but spec says M — pick one"
2. Emit an audit-log entry (stdout — the post-bash-log hook captures it):
   ```json
   {"event": "qa_contract", "epic": "E{n}", "result": "fail",
    "contract_ops_checked": N, "contract_failures": M}
   ```
3. **FAIL @qa** — do not proceed to Phase 3 (coverage) or Phase 4 (quality).
   Humans must fix `docs/openapi.yaml` or the handler, then re-run @qa.

### On success

Emit the audit-log entry with `result: "pass"`:
```json
{"event": "qa_contract", "epic": "E{n}", "result": "pass",
 "contract_ops_checked": N, "contract_failures": 0}
```
This entry is consumed by:
- Stop-verifier Rule #20 (blocks Stop when `docs/openapi.yaml` changed
  without a green `qa_contract` run on the branch).
- `/athena:batch auto` autopilot for spec confidence.

### xfail policy

Operations listed in `KNOWN_DRIFT_OPS` in the test module are explicitly
marked `xfail` because drift pre-dates this epic. An xfail is still a
**passing** test from pytest's perspective — the test module exits 0 — but
counts as unresolved drift. Treat xfail reduction as a KPI.

## Phase 2.6 — Migration Safety (E157, mandatory)

**This phase blocks Phase 3.** When the PR adds or modifies any file under
`server/alembic/versions/`, @qa must emit the offline SQL, scan for red
flags, and on red flag delegate to @dba for sign-off. Skipping this phase
means a migration ships to prod without a human reviewing the SQL.

### Auto-trigger

```bash
ALEMBIC_DIFF=$(git diff --name-only origin/main...HEAD -- 'server/alembic/versions/*.py')
[ -n "$ALEMBIC_DIFF" ] || skip Phase 2.6
```

If empty, this phase is a no-op — proceed to Phase 3.

### What runs

```bash
# For every changed migration file
for f in $ALEMBIC_DIFF; do
  rev=$(basename "$f" .py | cut -d_ -f1)
  scripts/migration-review.sh "$rev"
done
```

The script writes:
- `docs/context/migration-review/<rev>-<ts>-upgrade.sql`
- `docs/context/migration-review/<rev>-<ts>-downgrade.sql`

And greps the upgrade SQL for the red-flag patterns (`DROP COLUMN`,
`DROP TABLE`, `DROP INDEX`, `ALTER COLUMN ... TYPE`). Red-flag count is
written to stderr.

### On red flag (count > 0)

1. **Spawn @dba subagent** with this context:
   - SQL artifact paths (upgrade.sql + downgrade.sql)
   - Red-flag summary (which patterns matched, on which lines)
   - Required output: `docs/context/migration-review/<rev>-signoff.md`
     using the template documented in `.claude/agents/dba.md`
2. **Wait for @dba** to finish writing the sign-off file.
3. **Read the sign-off** — parse the `## Decision` line.
4. **On NOGO** → FAIL @qa with @dba's reasoning quoted in the failure
   message. Do not proceed to Phase 3 (coverage). The human must address
   @dba's concerns and re-run @qa.
5. **On GO** → proceed to step "On no red flag" below (commit artifacts).

### On no red flag (or @dba GO)

1. `git add docs/context/migration-review/<rev>-*-upgrade.sql`
2. `git add docs/context/migration-review/<rev>-*-downgrade.sql`
3. If a sign-off file exists for this rev:
   `git add docs/context/migration-review/<rev>-signoff.md`
4. Emit the audit-log entry:
   ```json
   {"event": "qa_migration", "epic": "E{n}", "rev": "<rev>",
    "red_flags": N, "decision": "GO"}
   ```
5. Proceed to Phase 3 (coverage).

### On NOGO

Emit the audit-log entry with `decision: "NOGO"` before failing:
```json
{"event": "qa_migration", "epic": "E{n}", "rev": "<rev>",
 "red_flags": N, "decision": "NOGO"}
```

This entry is consumed by:
- Stop-verifier Rule #19 (blocks Stop when alembic versions changed
  without a corresponding `<rev>-*-upgrade.sql` artifact on the branch).
- `pre-deploy-guard.sh` secondary gate (re-runs the SQL emit pre-deploy
  and refuses if the new SQL doesn't match what @qa committed).

## Write-Back Format

### test-status.md (overwrites)
```markdown
# Test Status — [timestamp]
Server coverage: X% (gate: 80%) — pass/fail
Client coverage: X% (gate: 80%) — pass/fail
Failing: [test names or "none"]
Flaky: [test names or "none"]
Under-covered:
  - [module]: Y% → needs: [specific tests]
Next tests: [from spec-log.md pending RED tests]
Deploy-ready: yes / no (reason)
```

## Context Preloading (1M context)

With 1M context available, load ALL relevant files in your first tool call batch:
- `docs/context/test-status.md` (designated doc)
- `docs/context/qa-patterns.md` (recurring patterns to check)
- All changed files: `git diff --name-only main...HEAD` → Read each
- Corresponding test files for each changed source file

Do NOT read files one-by-one across multiple rounds — batch in parallel.

## Phase 3 — Test Quality Audit

After test execution completes, perform a quality audit on all test files:

### Metrics Collection (via grep/static analysis)

1. **Behavior Ratio** — % of assertions on outputs (status codes, response bodies, DOM content) vs mock call assertions (`assert_called`, `assert_called_once_with`). Target: >70%
2. **Mock Depth** — average `mock.patch`/`@patch` count per test file. Target: <5 per file
3. **Parametrize Rate** — % of test files with 3+ test functions that use `@pytest.mark.parametrize` (server) or `it.each`/`test.each` (client). Target: >50%
4. **Contract Coverage** — % of OpenAPI endpoints with corresponding test files. Target: 100%

### Quality Principles Reference

Apply the 10 principles from the `tdd-workflow` skill (auto-loaded):
- P1: Test behavior, not implementation
- P2: Triangulation via parametrize
- P7: Mock at boundaries only
- P9: Parametrize over duplication
- P10: Mock boundaries, not internals

### Verifier Rule Cross-Check

Confirm no violations of stop-verifier rules 9-12:
- Rule 9: No internal mock assertions on project modules
- Rule 10: Parametrize nudge (3+ tests without parametrize)
- Rule 11: Mock depth limit (>5 patches per file)
- Rule 12: Test file size (<200 lines)

### Test Quality Report Format

Include this section in every QA report output:

```
Test Quality Report:
├── Coverage: X% ✅/❌ (gate: 80%)
├── Behavior Tests: X% ✅/🟡/❌ (target: >70%)
├── Mock Depth: X.X avg ✅/🟡/❌ (target: <5)
├── Parametrize Rate: X% ✅/🟡/❌ (target: >50%)
└── Contract Coverage: X% ✅/🟡/❌ (target: 100%)

Overall: ✅ All targets met / 🟡 1-2 below target / ❌ 3+ below target
```

**Advisory only** — quality score does NOT block merges. Coverage gate remains the sole blocker.

### Suggestions

After the quality report, list up to 3 specific improvement suggestions ranked by impact:
- Which test files would benefit most from parametrize refactoring
- Which files have excessive mock depth and should use DI fixtures instead
- Which endpoints lack contract tests

## Write-Back: Quality Metrics

Append quality metrics to `docs/context/test-status.md` in the Quality Metrics section
after updating coverage numbers. See test-status.md for the format template.

## Rules
- ALWAYS read test-status.md first
- NEVER lower the 80% threshold or comment out tests
- On test failure: report root cause + suggested fix, auto-invoke @debugger if needed
- For code review tasks, defer to `@reviewer` — do not perform reviews yourself
- ALWAYS run test quality audit after test execution (Phase 3)
- Quality score is advisory — never block merges based on quality metrics alone
