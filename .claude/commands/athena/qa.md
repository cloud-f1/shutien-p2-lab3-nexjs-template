---
description: "(epic) Quality gate → @reviewer review + @qa tests + @evaluator acceptance. Flags: --review-only / --test-only / --eval-only."
allowed-tools: Read, Grep, Glob, Bash
---
Parse $ARGUMENTS for flags:

- `--review-only`   → dispatch only to @reviewer (read-only code review)
- `--test-only`     → dispatch only to @qa (test execution + coverage)
- `--eval-only`     → dispatch only to @evaluator (independent acceptance tester)
- `--contract-only` → run ONLY a targeted route/action conformance check — a focused Playwright pass against the affected route (Next.js equivalent of the removed schemathesis sweep, E156)
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

> **Stack note (Phase 53 migration):** The Python `server/` and its schemathesis contract
> suite have been removed. `cd server && uv run pytest ...` is a dead command.
> The `--contract-only` flag is now a no-op for this stack.
>
> **Next.js equivalent** — quick route conformance check: run a targeted Playwright test
> against the affected endpoint/route. This gives faster feedback than a full e2e suite
> without requiring the old Python toolchain:
> ```bash
> cd next-app && npx playwright test -g "<route or feature name>" --workers=2
> ```

On pass: emits `{"event": "qa_contract", "result": "pass", "contract_ops_checked": N}`
to `.claude/audit.jsonl`.

On fail: emits `result: "fail"` + `contract_failures: M`. Writes the diff
summary to `docs/context/qa-patterns.md` under the "Contract Drift" section.
STOP — fix the route or handler, then re-run.

## Phase 0 — Test Plan (--plan flag only)
1. Identify the feature scope from $ARGUMENTS or current epic
2. Generate a test plan document at `docs/specs/test-plan-{feature}.md`
3. Include: test categories, acceptance criteria, edge cases, integration points
4. STOP — plan is documentation only, does not execute tests

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

### If a gate genuinely cannot run this session (E345)

Sometimes a gate is legitimately infeasible in the current environment — the shared
`nextapp_postgres` container is owned by another project, there's no seeded DB / dev
server available, etc. **Skipping is a legitimate call. Saying so only in prose is
not** — Phase 82 shipped 8 epics that each honestly declared "e2e not run, here's why"
in their own report, and every one of those honest statements evaporated the moment
the report was written: the state files, the gate results, and the phase-complete
record all still read PASS. Do not repeat that. The moment you decide to skip a gate,
emit the structured record in the same breath as writing the prose explanation:

```bash
bash scripts/hooks/audit-emit-gate.sh <gate> skipped --reason "<why, specifically>" --epic $EPIC --phase $PHASE || true
```

`<gate>` ∈ `typecheck|lint|unit|int|e2e`. `--reason` is enforced non-empty by the
script itself (a reason-less skip is refused, not silently accepted) — this is not
optional decoration, it's what makes the skip visible later via
`scripts/gate-ledger.sh --phase $PHASE`, and what the Phase-Complete guard (Rule 24,
`scripts/hooks/stop-verifier.sh`) checks before the phase can close. If you DID run a
gate, emit its actual pass/fail instead: `audit-emit-gate.sh <gate> pass --epic $EPIC --phase $PHASE || true`.

After: agent writes to docs/context/test-status.md

After the coverage gate result is determined (pass or fail), emit the audit event.
Parse `$EPIC` from the current branch (`git branch --show-current | sed -nE 's|.*[Ee]([0-9]+)-.*|E\1|p'`),
the coverage percentage from vitest output, and set verdict to `pass` or `fail`:

```bash
bash scripts/hooks/audit-emit-pipeline.sh qa_result epic=$EPIC coverage=$COV verdict=$VERDICT || true
```

---

## Speed & Reliability Practices (Required — QA context)

These rules were extracted from the Phase 53 retrospective. They are **required** for any QA agent running in this framework.

### 1. Green baseline before accepting the epic

Before running any QA for a new phase, confirm the base branch is clean:
```bash
cd next-app
git stash                      # if any uncommitted changes
pnpm build && pnpm test:coverage
```
If the base is already red, stop and file a baseline fix. Stacking QA on a red baseline means every gate will fail for ambiguous reasons.

### 2. Real critical-path smoke is non-negotiable

For epics touching auth, Server Actions, DB, or routes — run the actual login→dashboard flow before declaring QA pass:
```bash
# Confirm dev server is up (reuse existing if possible):
pnpm test:e2e -- --grep "login"
```
Status-code probes return 200 even when the login flow crashes. Only a test that asserts page content after login counts as a valid smoke.

### 3. Log-first on failures — read before re-running

When a test fails, read the error before doing anything else:
```bash
# Server log (if dev server is backgrounded):
tail -50 /tmp/next-dev.log

# Build log:
pnpm build 2>&1 | tail -40

# Playwright trace (on e2e failure):
# Open next-app/playwright-report/index.html or:
cat next-app/test-results/*/error.txt 2>/dev/null
```
Re-running without reading the log is a 2–4 min wasted cycle. The log almost always identifies the exact line.

### 4. Targeted warm-server testing

Keep the dev server warm across QA runs:
```bash
# Run a named test against the warm server (fast):
npx playwright test -g "login and reach dashboard" --workers=2

# Run a specific spec file only:
npx playwright test e2e/auth-flow.spec.ts --workers=2
```
`playwright.config` has `reuseExistingServer: true` — Playwright attaches automatically if port 3000 is already listening. A targeted run takes ~5–10s vs 2–4min for a full cold re-run. Reserve full-suite runs for the pre-merge gate only.

### 5. Parallel review, then execute

Fan out `@reviewer` agents per epic in parallel (they are read-only and independent), then run a single final "execute the real flow" pass:
```bash
# After all reviewer passes complete, execute the real flow:
pnpm test:e2e
```
This avoids the single-reviewer-per-epic miss that let Phase 53's login breakage slip through.

### 6. Pre-merge gate reference

`scripts/pre-merge-check.sh [--e2e]` is the final gate. It runs typecheck + lint + unit + (optionally) e2e in one shot. Always run it before declaring QA complete for the merge step. It exits non-zero on any failure.

---

## Phase 3 — Test Quality Report (included in @qa output)

After test execution, @qa analyzes test quality and appends a report:

```
Test Quality Report:
├── Coverage: X% ✅/❌ (gate: 80%)
├── Behavior Tests: X% ✅/🟡/❌ (target: >70%)
├── Mock Depth: X.X avg ✅/🟡/❌ (target: <5)
├── Parametrize Rate: X% ✅/🟡/❌ (target: >50%)
└── Route/Action Coverage: X% ✅/🟡/❌ (target: 100%)

Overall: ✅ All targets met / 🟡 1-2 below target / ❌ 3+ below target

Suggestions:
1. [highest-impact improvement]
2. [second improvement]
3. [third improvement]
```

Metric definitions:
- **Behavior Tests**: % of assertions on outputs (returned values, response JSON, DOM) vs mock assertions
- **Mock Depth**: average `vi.mock`/`vi.fn` count per test file
- **Parametrize Rate**: % of test files (with 3+ tests) using `it.each`/`test.each`
- **Route/Action Coverage**: % of Server Actions + Route Handlers with corresponding test coverage

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
  → **Not applicable for the current Next.js stack** — the Python `server/` and schemathesis
    contract suite have been removed (Phase 53 migration). The equivalent quick-feedback path
    for Next.js is a targeted Playwright run against the affected route:
    `cd next-app && npx playwright test -g "<route name>" --workers=2`
  → Report pass/fail. STOP.

If `--plan`:
  → Generate test plan document. STOP.

If no flag:
  → Invoke @reviewer (Phase 1). Wait for completion.
  → Invoke @qa (Phase 2 + Phase 3). Wait for completion.
  → If @qa coverage gate passed, invoke @evaluator (Phase 4). Wait for completion.
  → If @qa blocked on coverage, skip Phase 4 and report the coverage failure.
  → Report combined results (review findings + test results + acceptance verdict).
