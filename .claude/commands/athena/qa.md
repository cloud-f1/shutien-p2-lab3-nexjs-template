---
description: "(epic) Quality gate → @reviewer review + @qa tests + @evaluator acceptance. Flags: --review-only / --test-only / --eval-only."
allowed-tools: Read, Grep, Glob, Bash
---
Parse $ARGUMENTS for flags:

- `--review-only`   → dispatch only to @reviewer (read-only code review)
- `--test-only`     → dispatch only to @qa (test execution + coverage)
- `--eval-only`     → dispatch only to @evaluator (independent acceptance tester)
- `--contract-only` → run ONLY Phase 2.5 schemathesis contract sweep (E156)
- `--plan`          → Phase 0 only (generate test plan document)
- `--effort <tier>` → `quick|standard|thorough|ultra` — scales fan-out, verification depth, and model tier (default: standard)
- (no flag)         → all phases sequentially: @reviewer → @qa → @evaluator

**Step 0 — Resolve effort tier:**
```bash
eval "$(./scripts/effort/resolve.sh "$ARGUMENTS" 2>/dev/null || true)"
```

**Posture routing** (reads `$ATHENA_VERIFY_POSTURE` exported by Step 0 above, E200):

| `$ATHENA_VERIFY_POSTURE` | Review Path |
|---|---|
| `standard` / `quick` / unset (i.e. `single-vote`) | `scripts/reviewer-loop.sh` — default, byte-identical to pre-E200 behavior |
| `thorough` (i.e. `adversarial-3+perspective`) | `scripts/qa/verify-panel.sh $EPIC_ID` — 4-lens panel + adversarial refute (N=3) + completeness critic |
| `ultra` (i.e. `judge-panel+adversarial+multimodal`) | `scripts/qa/verify-panel.sh $EPIC_ID` — thorough panel PLUS double-evaluator (two independent opus contexts, must both PASS) PLUS N=3 judge panel (coverage / correctness / regression). Evaluator disagreement → `ESCALATE` (needs_human, epic does NOT auto-advance). ≥2/3 judges mark AC open → blocking finding. 1/3 judge → advisory only. Emits `verify_panel_ultra` audit event. (E206) |

Posture dispatch for `--review-only` mode:
```bash
# Parse EPIC_ID from branch name
EPIC_ID=$(git branch --show-current | sed -nE 's|.*[Ee]([0-9]+)-.*|E\1|p')

# Route based on posture
if [[ "${ATHENA_VERIFY_POSTURE:-}" =~ ^(adversarial-3\+perspective|judge-panel) ]]; then
  # thorough / ultra → verify-panel.sh
  # ultra posture activates double-evaluator + N=3 judge panel (E206)
  bash scripts/qa/verify-panel.sh "${EPIC_ID:-unknown}" --diff HEAD
else
  # standard / quick / unset → reviewer-loop.sh (unchanged)
  # drive @reviewer ↔ @debugger rounds as documented below
  :
fi
```

> **Note**: `scripts/reviewer-loop.sh` is NOT modified by E200 — it remains the standard path and is kept byte-identical. The posture dispatch above only routes to `verify-panel.sh` when `$ATHENA_VERIFY_POSTURE` is the thorough or ultra string value.

## Phase 2.5 — Contract Conformance (--contract-only flag, E156)

Quick drift check during development — runs ONLY the schemathesis sweep,
skipping @reviewer, coverage, quality audit, and acceptance evaluation.
Useful during `/athena:implement` when you've just touched `docs/openapi.yaml`
or a route handler and want fast feedback.

```bash
cd server && uv run pytest tests/contract/test_schemathesis_conformance.py -v --tb=short
```

On pass: emits `{"event": "qa_contract", "result": "pass", "contract_ops_checked": N}`
to `.claude/audit.jsonl` — this satisfies Stop-verifier Rule #20 on branches
where `docs/openapi.yaml` changed.

On fail: emits `result: "fail"` + `contract_failures: M`. Writes the diff
summary to `docs/context/qa-patterns.md` under the "Contract Drift" section.
STOP — fix the spec or handler, then re-run.

## Phase 0 — Test Plan (--plan flag only)
1. Identify the feature scope from $ARGUMENTS or current epic
2. Generate a test plan document at `docs/specs/test-plan-{feature}.md`
4. Include: test categories, acceptance criteria, edge cases, integration points
5. STOP — plan is documentation only, does not execute tests

## Phase 1 — Code Review (dispatch to @reviewer)

### Iterative Convergence Loop (E162, default for --review-only)

`/athena:qa --review-only` runs an **iterative convergence loop** instead of a
single @reviewer pass:

```
round 0: @reviewer → finds N issues → appends ## Round 0 to review-findings.md
         scripts/reviewer-loop.sh --check-round 0 → OPEN (N issues)
         @debugger (round mode N=0) → fixes only Round 0 items → commits
round 1: @reviewer → re-runs against fix diff → appends ## Round 1
         scripts/reviewer-loop.sh --check-round 1 → CONVERGED (0 issues) → EXIT
```

Convergence criteria (any one stops the loop, enforced by
`scripts/reviewer-loop.sh`):

- 0 open `- [ ]` findings in current round → **CONVERGED** (exit 0)
- Findings hash identical to previous round → **STUCK** (exit 2, human required)
- Round counter reaches `MAX_ITERATIONS` (default 4) → **MAX_REACHED** (exit 0)
- Token usage exceeds `REVIEW_LOOP_BUDGET` (default 50000) → **BUDGET_EXCEEDED**

### Env vars

| Var | Default | Purpose |
|-----|---------|---------|
| `MAX_ITERATIONS` | `4` | Hard ceiling on rounds — prevents runaway |
| `REVIEW_LOOP_BUDGET` | `50000` | Token budget across all rounds combined |
| `FINDINGS_FILE` | `docs/context/review-findings.md` | Override for testing |
| `AUDIT_FILE` | `.claude/audit.jsonl` | Override for testing |

### Driver loop (executed by /athena:qa --review-only)

```
N=0
while [[ $N -lt ${MAX_ITERATIONS:-4} ]]; do
  invoke @reviewer with round=$N         # appends ## Round N
  result=$(scripts/reviewer-loop.sh --check-round $N)
  case "$result" in
    CONVERGED*) break ;;
    OPEN*)      invoke @debugger with round=$N  # fixes only round-N items
                N=$((N+1)) ;;
  esac
done
scripts/reviewer-loop.sh                   # walks all rounds, emits audit + final verdict
```

### Stuck signal to user

When `reviewer-loop.sh` exits with code 2 (STUCK), the command MUST
report this prominently to the user:

```
⚠️  REVIEW LOOP STUCK at Round N
Findings hash identical to Round N-1 — the latest @debugger fix did not
change the open finding set. Human review required.

Open findings: docs/context/review-findings.md (## Round N section)
Audit:        .claude/audit.jsonl ({"event":"review_loop","verdict":"STUCK"})
```

### Single-pass fallback (Phase 1 inside the no-flag `/athena:qa`)

When `/athena:qa` runs WITHOUT `--review-only`, Phase 1 still uses a single
@reviewer pass (not the loop). The loop is opt-in via `--review-only` so
the full pipeline doesn't multiply by 4× rounds.

After: agent writes to docs/context/review-findings.md

## Phase 2 — Test Execution (dispatch to @qa)

> **Stack note (Phase 53 migration):** this repo is now **Next.js-only** (`next-app/`).
> The old Python `server/` + `client/` SPA were removed, so `uv run pytest` and the
> server openapi-lint steps no longer apply. The gate commands are now, all from `next-app/`:
>
> | # | Gate | Command | Blocks merge? |
> |---|------|---------|---------------|
> | 1 | Typecheck | `pnpm typecheck` | yes |
> | 2 | Lint | `pnpm lint` | yes |
> | 3 | Unit (Vitest) | `pnpm test` (coverage: `pnpm test:coverage`) | yes |
> | 4 | **E2E (Playwright)** | `pnpm test:e2e` (needs DB seeded + dev server) | **yes — see below** |
>
> One-shot: `scripts/pre-merge-check.sh [--e2e] [--allow-deletions]` runs gates 1–4 + repo hygiene.

### The "must actually run it" rule (Phase 53 retro — non-negotiable)

Static review and unit tests are necessary but **not sufficient**. In Phase 53 a
single-reviewer-per-epic pass missed two *critical* integration bugs that only an
end-to-end run surfaced: (a) credentials login was 100% broken (Auth.js Credentials
provider is incompatible with DrizzleAdapter's default database sessions → `auth()`
returned null → dashboard crash), and (b) the dashboard crashed for any zero-item
user. The old "smoke test" reported 6/6 green because it never logged in.

**Therefore: no epic touching an auth flow, a Server Action, a DB query, or a route
may pass QA on review + unit tests alone.** A real `pnpm test:e2e` run that exercises
the actual user flow (login → land on the page → perform the mutation) is a required
gate. A probe that only checks status codes / redirects does NOT satisfy this.

After: agent writes to docs/context/test-status.md

After the coverage gate result is determined (pass or fail), emit the audit event.
Parse `$EPIC` from the current branch (`git branch --show-current | sed -nE 's|.*[Ee]([0-9]+)-.*|E\1|p'`),
the coverage percentage from pytest/vitest output, and set verdict to `pass` or `fail`:

```bash
bash scripts/hooks/audit-emit-pipeline.sh qa_result epic=$EPIC coverage=$COV verdict=$VERDICT || true
```

## Phase 3 — Test Quality Report (included in @qa output)

After test execution, @qa analyzes test quality and appends a report:

```
Test Quality Report:
├── Coverage: X% ✅/❌ (gate: 80%)
├── Behavior Tests: X% ✅/🟡/❌ (target: >70%)
├── Mock Depth: X.X avg ✅/🟡/❌ (target: <5)
├── Parametrize Rate: X% ✅/🟡/❌ (target: >50%)
└── Contract Coverage: X% ✅/🟡/❌ (target: 100%)

Overall: ✅ All targets met / 🟡 1-2 below target / ❌ 3+ below target

Suggestions:
1. [highest-impact improvement]
2. [second improvement]
3. [third improvement]
```

Metric definitions:
- **Behavior Tests**: % of assertions on outputs (status codes, response JSON, DOM) vs mock assertions
- **Mock Depth**: average `mock.patch`/`@patch` count per test file
- **Parametrize Rate**: % of test files (with 3+ tests) using `parametrize`/`it.each`
- **Contract Coverage**: % of OpenAPI endpoints with corresponding test coverage

Status thresholds: ✅ = meets target, 🟡 = within 20% of target, ❌ = below 20% of target

**Advisory only** — quality score does NOT block merges. Coverage gate (>=80%) remains the sole blocker.

## Phase 4 — Independent Acceptance Evaluation (dispatch to @evaluator)

Runs ONLY after Phase 2 (@qa) passes its coverage gate. Implements the
Generator/Evaluator split — the agent that runs tests is not the agent that
judges whether the implementation meets the spec.

Dispatch logic:
1. Determine the current epic ID from `$ARGUMENTS` or `docs/context/epic-progress.md`.
2. Invoke @evaluator with the epic ID (e.g. `E147`). The agent reads
   `docs/epics/e{n}-*.md` in a clean context, walks each numbered acceptance
   criterion, and emits a verdict table with concrete evidence.
3. After: agent appends to `docs/context/evaluation-log.md`.

Final verdict logic (from @evaluator output):
- `PASS`     — every acceptance criterion is ✅
- `BLOCKED`  — at least one criterion is ❌ (merge gate — fix before merge)
- `ADVISORY` — no ❌, but at least one 🟡 (human review recommended, not blocking)

Missing spec: if `docs/epics/e{n}-*.md` does not exist, @evaluator reports
"no spec found for E{n}" and exits cleanly without crashing.

Read-only enforcement: @evaluator's `allowed-tools` omits `Write` and `Edit`
entirely — the agent literally cannot modify files. Evidence of a ❌ must be
fixed by the generator (`@qa` / implementation agents), not by the evaluator.

## Dispatch Logic

If `--review-only`:
  → Run the **iterative convergence loop** (see Phase 1 section above):
    drive @reviewer ↔ @debugger rounds via `scripts/reviewer-loop.sh`
    until CONVERGED, STUCK, or MAX_ITERATIONS. Report final verdict +
    audit event. STOP.

If `--test-only`:
  → Invoke @qa. Report test results. STOP.

If `--eval-only`:
  → Invoke @evaluator with the current epic ID. Report verdict. STOP.

If `--contract-only`:
  → Run `cd server && uv run pytest tests/contract/test_schemathesis_conformance.py -v --tb=short`.
  → Report pass/xfail/fail counts. STOP.

If `--plan`:
  → Generate test plan document. STOP.

If no flag:
  → Invoke @reviewer (Phase 1). Wait for completion.
  → Invoke @qa (Phase 2 + Phase 3). Wait for completion.
  → If @qa coverage gate passed, invoke @evaluator (Phase 4). Wait for completion.
  → If @qa blocked on coverage, skip Phase 4 and report the coverage failure.
  → Report combined results (review findings + test results + acceptance verdict).
