---
name: verification-discipline
description: >
  Verification-before-completion discipline for all agents. Use before claiming
  "done", "completed", "shipped", "fixed", "passing", or "verified". Agents must
  run the relevant verification command and emit a `verification_check` audit event
  before writing a completion-verb commit message. Applies to @qa, @reviewer,
  @debugger, @deployer, @spec-writer, and @orchestrator when closing epics.
---

# Verification Discipline

## The Rule

**Never claim completion without evidence.** Before writing any commit message
that starts with `feat:`, `fix:`, `refactor:`, `perf:`, `test:`, or `style:`,
you must:

1. Run the relevant verification command(s)
2. Emit a `verification_check` audit event via `scripts/hooks/audit-emit-verification.sh`
3. Only then write the commit

## Trigger Verbs

These verbs in commit messages trigger Stop Rule #23:

```
feat:      fix:      refactor:    perf:      test:      style:
```

These prefixes do NOT require verification (whitelisted):

```
wip:       chore(state):    docs:    chore:    chore(memory):    chore(roadmap):    build:    ci:
```

## How to Emit the Audit Event

```bash
# After running tests / checks:
scripts/hooks/audit-emit-verification.sh <check-name> <exit-code>

# Examples:
scripts/hooks/audit-emit-verification.sh "pnpm test" 0
scripts/hooks/audit-emit-verification.sh "pnpm test:e2e" 0
scripts/hooks/audit-emit-verification.sh "coverage-gate" 0
scripts/hooks/audit-emit-verification.sh "typecheck" 0
```

The script emits a JSONL event to `.claude/audit.jsonl`:

```json
{"ts":"2026-05-20T10:00:00Z","event":"verification_check","check":"pnpm test","exit":0,"agent":"qa","epic":"E188"}
```

Rule #23 scans for any `verification_check` event with `exit=0` within the
last 10 minutes. A single passing emit clears the gate for the entire session
window.

## Per-Agent Protocol

### @qa

```bash
# 1. Run the full unit test suite (Vitest)
cd next-app && pnpm test -- --run
scripts/hooks/audit-emit-verification.sh "pnpm test" $?
# 2. Run e2e tests (Playwright)
cd next-app && pnpm test:e2e
scripts/hooks/audit-emit-verification.sh "pnpm test:e2e" $?
```

### @reviewer

```bash
# After completing code review, emit a review-complete event:
scripts/hooks/audit-emit-verification.sh "code-review" 0
```

### @debugger

```bash
# After verifying the fix resolves the issue:
cd next-app && pnpm test -- --run path/to/relevant/test
scripts/hooks/audit-emit-verification.sh "pnpm test" $?
```

### @deployer

```bash
# After smoke-testing the deployment:
scripts/hooks/audit-emit-verification.sh "deploy-smoke" 0
```

### @orchestrator / @spec-writer

```bash
# After confirming all acceptance criteria are met:
scripts/hooks/audit-emit-verification.sh "acceptance-criteria" 0
```

## Honest skipping ≫ claiming to have run it (E345)

This skill's rule is "never claim completion without evidence" — it is **not** "every
gate must always run." Those are different rules, and conflating them produces the
wrong incentive. Skipping a gate for a real, stated reason (the shared `nextapp_postgres`
container is owned by another project, there's no seeded DB in this environment, etc.)
is a legitimate engineering decision. **Doing so and saying so honestly in your report
is correct behavior, not a violation of this skill.**

The Phase 82 incident that motivated E345 is the concrete case: 8 epics each wrote
an honest "e2e not run, here's why" in their own report. Every one of those statements
was *true* and *correct to write*. The failure was structural, not behavioral: the
honest prose evaporated the moment the report was filed, while `epic-progress.md`,
the gate results, and the phase-complete record all still read PASS — so a real
combination defect (E336/E337's clashing `/dashboard/admin` selector) rode into `main`
undetected.

**So: the moment you decide a gate is infeasible this session, emit the structured
skip in the same breath as the prose explanation** — do not let the honest statement
live only in your final report:

```bash
bash scripts/hooks/audit-emit-gate.sh <gate> skipped --reason "<why, specifically>" --epic $EPIC --phase $PHASE || true
```

`--reason` is enforced non-empty by the script (a reason-less skip is refused outright,
not silently accepted with an empty field) — an unaccountable skip is exactly what this
epic exists to prevent. When you DO run a gate, emit its real pass/fail the same way:

```bash
bash scripts/hooks/audit-emit-gate.sh <gate> pass --epic $EPIC --phase $PHASE || true
bash scripts/hooks/audit-emit-gate.sh <gate> fail --epic $EPIC --phase $PHASE || true
```

`scripts/gate-ledger.sh --phase N` aggregates these into a per-phase summary, and
`scripts/hooks/stop-verifier.sh` Rule 24 refuses to let a phase close ✅ Complete while
it carries an unreconciled skip. The ONLY reconciliation path is a **human** explicitly
running `scripts/gate-ledger.sh --phase N --accept-skips "reason"` (never from cron,
`/athena:loop`, `/athena:batch auto`, or an agent's own initiative — same hard rule as
`/athena:approve`) — a later pass elsewhere does NOT retroactively clear a recorded
skip; once accepted, a phase's acceptance is durable (it covers that phase's skips
permanently, not just the ones that existed at acceptance time — see `gate-ledger.sh`'s
header for the reasoning). See `docs/epics/e345-gate-ledger.md` for the full design.

**The two rules together, stated plainly:** Rule #23 (this skill) blocks *claiming*
you verified something you didn't. Rule 24 (E345) blocks *silently* skipping something
at phase-close without a trace. Neither blocks an honest, recorded skip.

## Why This Exists

Agents frequently write `feat(E{n}): X complete` without ever having run
`pnpm test`, `pnpm typecheck`, or the relevant lint — and the Stop verifier waves it
through because its structural rules (8 in the current Next.js set) don't check behavior evidence.

This is the most common athena failure mode that escapes Stop verifier. Rule #23
closes that gap.

## Pilot Mode

During the first 5 days post-merge, Rule #23 is gated behind the
`STOP_RULE_23_ENABLED=1` env var (default: OFF). Set it in `.env` or
in the shell before committing to activate early. After the fixture-replay
window, the default flips to ON.

To disable manually:
```bash
STOP_RULE_23_ENABLED=0 git commit -m "feat: ..."  # bypass for a single commit
```
