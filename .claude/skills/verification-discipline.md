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
scripts/hooks/audit-emit-verification.sh pytest 0
scripts/hooks/audit-emit-verification.sh "pnpm test" 0
scripts/hooks/audit-emit-verification.sh "coverage-gate" 0
scripts/hooks/audit-emit-verification.sh "contract-test" 0
```

The script emits a JSONL event to `.claude/audit.jsonl`:

```json
{"ts":"2026-05-20T10:00:00Z","event":"verification_check","check":"pytest","exit":0,"agent":"qa","epic":"E188"}
```

Rule #23 scans for any `verification_check` event with `exit=0` within the
last 10 minutes. A single passing emit clears the gate for the entire session
window.

## Per-Agent Protocol

### @qa

```bash
# 1. Run the full test suite
pytest --cov=app -q
# 2. Emit if exit 0
scripts/hooks/audit-emit-verification.sh pytest $?
# 3. Run client tests
pnpm --filter client test:run
scripts/hooks/audit-emit-verification.sh "pnpm test" $?
```

### @reviewer

```bash
# After completing code review, emit a review-complete event:
scripts/hooks/audit-emit-verification.sh "code-review" 0
```

### @debugger

```bash
# After verifying the fix resolves the issue:
pytest path/to/relevant/test.py -q
scripts/hooks/audit-emit-verification.sh pytest $?
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

## Why This Exists

Agents frequently write `feat(E{n}): X complete` without ever having run
`pytest`, `pnpm test`, or the relevant lint — and the Stop verifier waves it
through because its 22 structural rules don't check behavior evidence.

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
