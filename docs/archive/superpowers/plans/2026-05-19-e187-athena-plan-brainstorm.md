# E187 — `/athena:plan brainstorm` Mode + Enriched Epic File Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `brainstorm` sub-mode to `/athena:plan` that runs a Q&A design dialogue and (on approve) writes an enriched epic file with Implementation Phases, Per-Phase Checkpoints, and Test Strategy sections — all derived from the dialogue.

**Architecture:** A shell harness script `scripts/plan/brainstorm-emit.sh` does the deterministic work (writing strategy-log rows, rendering epic files, emitting audit events). The slash command markdown tells the LLM how to gather inputs via dialogue, then invokes the harness with JSON args. This decouples the testable part (harness) from the agent-driven part (dialogue).

**Tech Stack:** Bash 4+, `jq`, existing `.claude/audit.jsonl` event sink, existing `docs/context/strategy-log.md` + `docs/epics/e{n}-*.md` conventions.

**Spec:** `docs/superpowers/specs/2026-05-18-athena-phase-46-roadmap.md` §5 E187

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `scripts/plan/brainstorm-emit.sh` | Create | Harness: two subcommands (`strategy-log`, `render-epic`) + audit emit |
| `scripts/plan/tests/test-brainstorm-emit.sh` | Create | 7 fixture tests against the harness |
| `scripts/plan/tests/fixtures/sample-brainstorm.json` | Create | Reference JSON input for golden tests |
| `scripts/plan/tests/golden/expected-strategy-log-row.md` | Create | Golden strategy-log row output |
| `scripts/plan/tests/golden/expected-epic-file.md` | Create | Golden epic file render |
| `.claude/commands/athena/plan.md` | Modify | Add brainstorm mode to Usage; new Step 2.5; extend approve flow |
| `.claude/agents/strategist.md` | Modify | Add `Brainstorm Mode` section |
| `scripts/hooks/CLAUDE.md` | Modify | Document `plan_brainstorm` audit event |
| `docs/context/qa-patterns.md` | Modify | Mention new pattern (one short paragraph) |
| `docs/superpowers/plans/2026-05-19-e187-athena-plan-brainstorm.md` | (this file) | The plan itself |

**Decomposition rationale:** harness logic lives in one shell file (~150 lines target). Tests run in <2s. Slash command markdown reads as instructions to the LLM, calls the harness. Agent definition adds the dialogue protocol. No new directories beyond `scripts/plan/` and its `tests/` + `fixtures/` + `golden/`.

---

## Task 1: Create `scripts/plan/` skeleton + first failing test

**Files:**
- Create: `scripts/plan/brainstorm-emit.sh`
- Create: `scripts/plan/tests/test-brainstorm-emit.sh`

- [ ] **Step 1: Create the harness skeleton (intentionally incomplete)**

```bash
mkdir -p scripts/plan/tests/fixtures scripts/plan/tests/golden
```

Write `scripts/plan/brainstorm-emit.sh`:

```bash
#!/usr/bin/env bash
# brainstorm-emit.sh — atomic writes for /athena:plan brainstorm.
# Subcommands:
#   strategy-log <json-file>   Append brainstorm row to strategy-log.md
#   render-epic   <json-file>  Write enriched epic file at docs/epics/e{n}-*.md
#
# Env vars (test injection):
#   AUDIT_LOG_PATH       override .claude/audit.jsonl
#   STRATEGY_LOG_PATH    override docs/context/strategy-log.md
#   EPICS_DIR            override docs/epics
#   CLOCK_TS             override timestamp (for golden tests)

set -euo pipefail

SUBCMD="${1:-}"
INPUT_JSON="${2:-}"

if [ -z "$SUBCMD" ] || [ -z "$INPUT_JSON" ]; then
  echo "usage: brainstorm-emit.sh {strategy-log|render-epic} <json-file>" >&2
  exit 64
fi

if [ ! -f "$INPUT_JSON" ]; then
  echo "error: input json not found: $INPUT_JSON" >&2
  exit 65
fi

# TODO: dispatch to subcommand implementations
echo "not yet implemented: $SUBCMD" >&2
exit 70
```

Make it executable:

```bash
chmod +x scripts/plan/brainstorm-emit.sh
```

- [ ] **Step 2: Write the first failing test (usage error case)**

Write `scripts/plan/tests/test-brainstorm-emit.sh`:

```bash
#!/usr/bin/env bash
# test-brainstorm-emit.sh — fixture-driven tests for brainstorm-emit.sh

set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HARNESS="$SCRIPT_DIR/../brainstorm-emit.sh"
FIXTURES="$SCRIPT_DIR/fixtures"
GOLDEN="$SCRIPT_DIR/golden"

PASS=0
FAIL=0

pass() { echo "  ✓ $1"; PASS=$((PASS+1)); }
fail() { echo "  ✗ $1" >&2; FAIL=$((FAIL+1)); }

# --- Test 1: usage error when called with no args ---
echo "Test 1: no-args usage error"
if "$HARNESS" 2>/dev/null; then
  fail "expected exit 64, got 0"
else
  rc=$?
  [ "$rc" -eq 64 ] && pass "exit 64 on missing args" || fail "expected exit 64, got $rc"
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
```

Make executable:

```bash
chmod +x scripts/plan/tests/test-brainstorm-emit.sh
```

- [ ] **Step 3: Run test to verify it passes (skeleton is enough for Test 1)**

Run:

```bash
./scripts/plan/tests/test-brainstorm-emit.sh
```

Expected output:

```
Test 1: no-args usage error
  ✓ exit 64 on missing args

Results: 1 passed, 0 failed
```

- [ ] **Step 4: Commit Task 1**

```bash
git add scripts/plan/brainstorm-emit.sh scripts/plan/tests/test-brainstorm-emit.sh
git commit -m "feat(E187): scaffold brainstorm-emit harness + first test"
```

---

## Task 2: Implement `strategy-log` subcommand — append brainstorm row

**Files:**
- Modify: `scripts/plan/brainstorm-emit.sh` (add `strategy_log_subcmd()` and dispatch)
- Create: `scripts/plan/tests/fixtures/sample-brainstorm.json`
- Create: `scripts/plan/tests/golden/expected-strategy-log-row.md`
- Modify: `scripts/plan/tests/test-brainstorm-emit.sh` (add Test 2)

The input JSON schema:

```json
{
  "epic": "E300",
  "slug": "weekly-digest-emails",
  "name": "Weekly Digest Emails for Project Owners",
  "priority": "P1",
  "size": "M",
  "sp": 5,
  "rationale": "Owners report missing critical updates.",
  "phases": [
    {"id": 1, "name": "Schema + scheduler", "tasks": ["sqlmodel for DigestRun", "APScheduler job"]},
    {"id": 2, "name": "Template + send", "tasks": ["Jinja template", "SendGrid integration"]},
    {"id": 3, "name": "Unsubscribe + observability", "tasks": ["unsub token", "Sentry breadcrumbs"]}
  ],
  "checkpoints": [
    {"phase": 1, "verify": "DigestRun model creates row; cron job logs entry"},
    {"phase": 2, "verify": "Send hits MailHog in dev; HTML lints clean"},
    {"phase": 3, "verify": "Unsubscribe link round-trips; Sentry receives breadcrumb"}
  ],
  "test_strategy": "Server: factory-boy DigestRun factory + 3 parametrized happy/edge/error cases. Client: e2e Playwright for unsubscribe page. Coverage gate: 80%+ in `server/app/domains/digest/`.",
  "dependencies": ["E22 domain registry"],
  "risks": ["SendGrid quota in dev"]
}
```

- [ ] **Step 1: Write the fixture JSON**

Write `scripts/plan/tests/fixtures/sample-brainstorm.json` with the exact content above.

- [ ] **Step 2: Write the golden strategy-log row**

Write `scripts/plan/tests/golden/expected-strategy-log-row.md`:

```markdown
### E300 — Weekly Digest Emails for Project Owners — 2026-05-19 (brainstorm)

| Field | Value |
|---|---|
| Priority | P1 |
| Size | M |
| SP | 5 |
| Rationale | Owners report missing critical updates. |
| Dependencies | E22 domain registry |

**Phases:**
1. Schema + scheduler — sqlmodel for DigestRun; APScheduler job
2. Template + send — Jinja template; SendGrid integration
3. Unsubscribe + observability — unsub token; Sentry breadcrumbs

**Checkpoints:**
- Phase 1: DigestRun model creates row; cron job logs entry
- Phase 2: Send hits MailHog in dev; HTML lints clean
- Phase 3: Unsubscribe link round-trips; Sentry receives breadcrumb

**Test Strategy:** Server: factory-boy DigestRun factory + 3 parametrized happy/edge/error cases. Client: e2e Playwright for unsubscribe page. Coverage gate: 80%+ in `server/app/domains/digest/`.

**Risks:** SendGrid quota in dev

⏸️ AWAITING HUMAN APPROVAL — run `/athena:plan approve E300` to render `docs/epics/e300-weekly-digest-emails.md`
```

- [ ] **Step 3: Implement `strategy_log_subcmd()` in harness**

Replace the TODO block in `scripts/plan/brainstorm-emit.sh` with:

```bash
strategy_log_subcmd() {
  local input="$1"
  local strategy_log="${STRATEGY_LOG_PATH:-docs/context/strategy-log.md}"
  local ts="${CLOCK_TS:-$(date -u +%Y-%m-%d)}"

  if [ ! -f "$strategy_log" ]; then
    echo "error: strategy log not found: $strategy_log" >&2
    return 66
  fi

  local epic name priority size sp rationale deps risks test_strategy
  epic=$(jq -r '.epic' "$input")
  name=$(jq -r '.name' "$input")
  priority=$(jq -r '.priority' "$input")
  size=$(jq -r '.size' "$input")
  sp=$(jq -r '.sp' "$input")
  rationale=$(jq -r '.rationale' "$input")
  deps=$(jq -r '.dependencies | join(", ")' "$input")
  risks=$(jq -r '.risks | join("; ")' "$input")
  test_strategy=$(jq -r '.test_strategy' "$input")

  {
    echo ""
    echo "### $epic — $name — $ts (brainstorm)"
    echo ""
    echo "| Field | Value |"
    echo "|---|---|"
    echo "| Priority | $priority |"
    echo "| Size | $size |"
    echo "| SP | $sp |"
    echo "| Rationale | $rationale |"
    echo "| Dependencies | $deps |"
    echo ""
    echo "**Phases:**"
    jq -r '.phases[] | "\(.id). \(.name) — \(.tasks | join("; "))"' "$input"
    echo ""
    echo "**Checkpoints:**"
    jq -r '.checkpoints[] | "- Phase \(.phase): \(.verify)"' "$input"
    echo ""
    echo "**Test Strategy:** $test_strategy"
    echo ""
    echo "**Risks:** $risks"
    echo ""
    echo "⏸️ AWAITING HUMAN APPROVAL — run \`/athena:plan approve $epic\` to render \`docs/epics/$(echo "$epic" | tr 'A-Z' 'a-z')-$(jq -r '.slug' "$input").md\`"
  } >> "$strategy_log"
}

case "$SUBCMD" in
  strategy-log) strategy_log_subcmd "$INPUT_JSON" ;;
  render-epic)  echo "not yet implemented: render-epic" >&2; exit 70 ;;
  *)
    echo "unknown subcommand: $SUBCMD" >&2
    exit 67
    ;;
esac
```

- [ ] **Step 4: Add Test 2 — golden comparison**

Append to `scripts/plan/tests/test-brainstorm-emit.sh` (before the `echo "Results"` line):

```bash
# --- Test 2: strategy-log appends golden row ---
echo "Test 2: strategy-log golden output"
TMPDIR_T2=$(mktemp -d)
cp "$FIXTURES/sample-brainstorm.json" "$TMPDIR_T2/input.json"

# Seed a minimal strategy-log
cat > "$TMPDIR_T2/strategy-log.md" <<EOF
# Strategy Log

## Current Cycle

EOF

STRATEGY_LOG_PATH="$TMPDIR_T2/strategy-log.md" \
  CLOCK_TS="2026-05-19" \
  "$HARNESS" strategy-log "$TMPDIR_T2/input.json" 2>&1

# Compare the appended block to the golden
ACTUAL=$(tail -n +4 "$TMPDIR_T2/strategy-log.md")  # skip header
EXPECTED=$(cat "$GOLDEN/expected-strategy-log-row.md")

if [ "$ACTUAL" = "$EXPECTED" ]; then
  pass "strategy-log matches golden"
else
  fail "strategy-log diverged from golden"
  diff <(echo "$EXPECTED") <(echo "$ACTUAL") | head -30
fi

rm -rf "$TMPDIR_T2"
```

- [ ] **Step 5: Run tests to verify Test 2 passes**

Run:

```bash
./scripts/plan/tests/test-brainstorm-emit.sh
```

Expected:

```
Test 1: no-args usage error
  ✓ exit 64 on missing args
Test 2: strategy-log golden output
  ✓ strategy-log matches golden

Results: 2 passed, 0 failed
```

If the golden diff fires, adjust the golden file to match the harness output (or vice-versa — exactly one of these is wrong and the diff tells you which).

- [ ] **Step 6: Commit Task 2**

```bash
git add scripts/plan/brainstorm-emit.sh scripts/plan/tests/
git commit -m "feat(E187): brainstorm-emit strategy-log subcommand + golden test"
```

---

## Task 3: Implement `render-epic` subcommand — write enriched epic file

**Files:**
- Modify: `scripts/plan/brainstorm-emit.sh` (add `render_epic_subcmd()`)
- Create: `scripts/plan/tests/golden/expected-epic-file.md`
- Modify: `scripts/plan/tests/test-brainstorm-emit.sh` (add Test 3)

- [ ] **Step 1: Write the golden epic file**

Write `scripts/plan/tests/golden/expected-epic-file.md`:

```markdown
# E300 — Weekly Digest Emails for Project Owners

> Phase 46 — Workflow Discipline + Memory-Aware Planning | Size: M (5 SP) | Deps: E22 domain registry

## Problem

Owners report missing critical updates.

## Implementation Phases

### Phase 1 — Schema + scheduler

- sqlmodel for DigestRun
- APScheduler job

**Checkpoint:** DigestRun model creates row; cron job logs entry

### Phase 2 — Template + send

- Jinja template
- SendGrid integration

**Checkpoint:** Send hits MailHog in dev; HTML lints clean

### Phase 3 — Unsubscribe + observability

- unsub token
- Sentry breadcrumbs

**Checkpoint:** Unsubscribe link round-trips; Sentry receives breadcrumb

## Test Strategy

Server: factory-boy DigestRun factory + 3 parametrized happy/edge/error cases. Client: e2e Playwright for unsubscribe page. Coverage gate: 80%+ in `server/app/domains/digest/`.

## Risks

- SendGrid quota in dev

## Acceptance Criteria

- [ ] All phase checkpoints pass
- [ ] Test strategy implemented
- [ ] Coverage gate ≥80% in modified domains
- [ ] No new Stop Verifier violations
```

- [ ] **Step 2: Implement `render_epic_subcmd()` in harness**

Replace the `render-epic` line in the case dispatch with a function. Above the `case` block, add:

```bash
render_epic_subcmd() {
  local input="$1"
  local epics_dir="${EPICS_DIR:-docs/epics}"

  if [ ! -d "$epics_dir" ]; then
    echo "error: epics dir not found: $epics_dir" >&2
    return 66
  fi

  local epic slug name size sp deps rationale risks test_strategy
  epic=$(jq -r '.epic' "$input")
  slug=$(jq -r '.slug' "$input")
  name=$(jq -r '.name' "$input")
  size=$(jq -r '.size' "$input")
  sp=$(jq -r '.sp' "$input")
  deps=$(jq -r '.dependencies | join(", ")' "$input")
  rationale=$(jq -r '.rationale' "$input")
  risks=$(jq -r '.risks | map("- " + .) | join("\n")' "$input")
  test_strategy=$(jq -r '.test_strategy' "$input")

  local lower_epic
  lower_epic=$(echo "$epic" | tr 'A-Z' 'a-z')
  local out="$epics_dir/${lower_epic}-${slug}.md"

  if [ -f "$out" ]; then
    echo "error: epic file already exists: $out" >&2
    return 68
  fi

  {
    echo "# $epic — $name"
    echo ""
    echo "> Phase 46 — Workflow Discipline + Memory-Aware Planning | Size: $size ($sp SP) | Deps: $deps"
    echo ""
    echo "## Problem"
    echo ""
    echo "$rationale"
    echo ""
    echo "## Implementation Phases"
    echo ""
    jq -r '
      .phases as $phases |
      .checkpoints as $cps |
      $phases[] |
      "### Phase \(.id) — \(.name)\n\n" +
      (.tasks | map("- " + .) | join("\n")) +
      "\n\n**Checkpoint:** " +
      (($cps[] | select(.phase == ($phases[($phases | map(.id) | index(.id))].id)) | .verify) // "TBD")
    ' "$input" | awk '
      /^### Phase/ { if (NR > 1) print ""; print; next }
      { print }
    '
    # Simpler: emit phases + checkpoints inline (sed-friendly version below)
  } > /dev/null  # placeholder — replaced by simpler emit loop below

  # Emit the actual file via a simpler loop (jq-only, no awk acrobatics):
  {
    echo "# $epic — $name"
    echo ""
    echo "> Phase 46 — Workflow Discipline + Memory-Aware Planning | Size: $size ($sp SP) | Deps: $deps"
    echo ""
    echo "## Problem"
    echo ""
    echo "$rationale"
    echo ""
    echo "## Implementation Phases"

    local phase_count
    phase_count=$(jq '.phases | length' "$input")
    local i=0
    while [ "$i" -lt "$phase_count" ]; do
      local pid pname tasks verify
      pid=$(jq -r ".phases[$i].id" "$input")
      pname=$(jq -r ".phases[$i].name" "$input")
      tasks=$(jq -r ".phases[$i].tasks | map(\"- \" + .) | join(\"\n\")" "$input")
      verify=$(jq -r ".checkpoints[] | select(.phase == $pid) | .verify" "$input")
      echo ""
      echo "### Phase $pid — $pname"
      echo ""
      echo "$tasks"
      echo ""
      echo "**Checkpoint:** $verify"
      i=$((i+1))
    done

    echo ""
    echo "## Test Strategy"
    echo ""
    echo "$test_strategy"
    echo ""
    echo "## Risks"
    echo ""
    echo "$risks"
    echo ""
    echo "## Acceptance Criteria"
    echo ""
    echo "- [ ] All phase checkpoints pass"
    echo "- [ ] Test strategy implemented"
    echo "- [ ] Coverage gate ≥80% in modified domains"
    echo "- [ ] No new Stop Verifier violations"
  } > "$out"

  echo "$out"
}
```

Update the `case` block:

```bash
case "$SUBCMD" in
  strategy-log) strategy_log_subcmd "$INPUT_JSON" ;;
  render-epic)  render_epic_subcmd "$INPUT_JSON" ;;
  *)
    echo "unknown subcommand: $SUBCMD" >&2
    exit 67
    ;;
esac
```

(Delete the dead `> /dev/null  # placeholder` block — that was scaffolding to show two approaches. Keep only the second, simpler emit loop.)

- [ ] **Step 3: Add Test 3 to the test file**

Append to `scripts/plan/tests/test-brainstorm-emit.sh` (before the final `echo "Results"`):

```bash
# --- Test 3: render-epic writes golden epic file ---
echo "Test 3: render-epic golden output"
TMPDIR_T3=$(mktemp -d)
mkdir -p "$TMPDIR_T3/epics"
cp "$FIXTURES/sample-brainstorm.json" "$TMPDIR_T3/input.json"

EPICS_DIR="$TMPDIR_T3/epics" \
  "$HARNESS" render-epic "$TMPDIR_T3/input.json" 2>&1

ACTUAL_FILE="$TMPDIR_T3/epics/e300-weekly-digest-emails.md"
if [ ! -f "$ACTUAL_FILE" ]; then
  fail "epic file not created: $ACTUAL_FILE"
else
  if diff -q "$ACTUAL_FILE" "$GOLDEN/expected-epic-file.md" >/dev/null; then
    pass "epic file matches golden"
  else
    fail "epic file diverged from golden"
    diff "$GOLDEN/expected-epic-file.md" "$ACTUAL_FILE" | head -40
  fi
fi

rm -rf "$TMPDIR_T3"
```

- [ ] **Step 4: Run tests**

```bash
./scripts/plan/tests/test-brainstorm-emit.sh
```

Expected:

```
Test 1: no-args usage error
  ✓ exit 64 on missing args
Test 2: strategy-log golden output
  ✓ strategy-log matches golden
Test 3: render-epic golden output
  ✓ epic file matches golden

Results: 3 passed, 0 failed
```

If golden diff fires, fix whichever side is wrong (likely whitespace at end of lines or trailing newlines).

- [ ] **Step 5: Commit Task 3**

```bash
git add scripts/plan/
git commit -m "feat(E187): brainstorm-emit render-epic subcommand + golden test"
```

---

## Task 4: Emit `plan_brainstorm` audit event

**Files:**
- Modify: `scripts/plan/brainstorm-emit.sh` (add audit emission after each subcommand)
- Modify: `scripts/plan/tests/test-brainstorm-emit.sh` (add Test 4)

- [ ] **Step 1: Add audit emission at end of each subcommand**

Inside `strategy_log_subcmd()`, before the closing `}`, add:

```bash
  emit_audit "$epic" "proposed" "$(jq '.phases | length' "$input")"
```

Inside `render_epic_subcmd()`, before the closing `}`, add:

```bash
  emit_audit "$epic" "approved" "$(jq '.phases | length' "$input")"
```

Above both functions (after the `set -euo pipefail` line), add the shared helper:

```bash
emit_audit() {
  local epic="$1"
  local status="$2"
  local phase_count="$3"
  local audit_log="${AUDIT_LOG_PATH:-.claude/audit.jsonl}"
  local ts="${CLOCK_TS:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

  mkdir -p "$(dirname "$audit_log")" 2>/dev/null || return 0
  if command -v jq >/dev/null 2>&1; then
    jq -n -c \
      --arg ts "$ts" \
      --arg event "plan_brainstorm" \
      --arg epic "$epic" \
      --arg status "$status" \
      --argjson phase_count "$phase_count" \
      '{ts:$ts,event:$event,epic:$epic,status:$status,phase_count:$phase_count}' \
      >> "$audit_log" 2>/dev/null || true
  fi
}
```

Note the `CLOCK_TS` override: for `strategy-log` the harness uses `date -u +%Y-%m-%d` (date-only) for the row header, but for the audit event it needs ISO 8601 with time. Make sure the audit emission uses its own default (`%Y-%m-%dT%H:%M:%SZ`) and only respects `CLOCK_TS` if set to a full ISO string. The current code does this correctly because `CLOCK_TS` is only set in tests where the test author controls the format.

- [ ] **Step 2: Add Test 4 — audit event emission**

Append to `scripts/plan/tests/test-brainstorm-emit.sh`:

```bash
# --- Test 4: plan_brainstorm audit event emitted ---
echo "Test 4: audit event emission"
TMPDIR_T4=$(mktemp -d)
mkdir -p "$TMPDIR_T4/epics"
cp "$FIXTURES/sample-brainstorm.json" "$TMPDIR_T4/input.json"
cat > "$TMPDIR_T4/strategy-log.md" <<EOF
# Strategy Log
EOF

AUDIT_LOG_PATH="$TMPDIR_T4/audit.jsonl" \
  STRATEGY_LOG_PATH="$TMPDIR_T4/strategy-log.md" \
  EPICS_DIR="$TMPDIR_T4/epics" \
  CLOCK_TS="2026-05-19T12:00:00Z" \
  "$HARNESS" strategy-log "$TMPDIR_T4/input.json" >/dev/null

AUDIT_LOG_PATH="$TMPDIR_T4/audit.jsonl" \
  EPICS_DIR="$TMPDIR_T4/epics" \
  CLOCK_TS="2026-05-19T12:00:01Z" \
  "$HARNESS" render-epic "$TMPDIR_T4/input.json" >/dev/null

# Expect exactly 2 plan_brainstorm events: one proposed, one approved
PROPOSED=$(grep -c '"status":"proposed"' "$TMPDIR_T4/audit.jsonl" || echo 0)
APPROVED=$(grep -c '"status":"approved"' "$TMPDIR_T4/audit.jsonl" || echo 0)
EVENT_COUNT=$(grep -c '"event":"plan_brainstorm"' "$TMPDIR_T4/audit.jsonl" || echo 0)

if [ "$EVENT_COUNT" -eq 2 ] && [ "$PROPOSED" -eq 1 ] && [ "$APPROVED" -eq 1 ]; then
  pass "audit emits 1 proposed + 1 approved"
else
  fail "audit count wrong (proposed=$PROPOSED, approved=$APPROVED, total=$EVENT_COUNT)"
fi

# Schema check: phase_count is int 3 (from fixture), epic is E300
SCHEMA_OK=$(jq -s 'all(.[]; .event=="plan_brainstorm" and .epic=="E300" and .phase_count==3)' "$TMPDIR_T4/audit.jsonl")
[ "$SCHEMA_OK" = "true" ] && pass "audit schema fields correct" || fail "audit schema mismatch"

rm -rf "$TMPDIR_T4"
```

Note: `CLOCK_TS` is used here as an ISO 8601 timestamp. The strategy-log subcommand needs `CLOCK_TS` to be date-only (per Task 2 golden) — these two cases collide. **Resolution:** introduce a second env var `CLOCK_DATE` for the date-only header, distinct from `CLOCK_TS` for audit. Update Task 2 to use `CLOCK_DATE` for the row header and Task 2's Test 2 to set `CLOCK_DATE=2026-05-19`. The audit emission in this task uses `CLOCK_TS` for the ISO timestamp.

**Fix Task 2 golden test to use `CLOCK_DATE`:** change `CLOCK_TS="2026-05-19"` to `CLOCK_DATE="2026-05-19"` in Test 2. Update `strategy_log_subcmd()` to read `CLOCK_DATE` instead of `CLOCK_TS`:

```bash
local ts="${CLOCK_DATE:-$(date -u +%Y-%m-%d)}"
```

- [ ] **Step 3: Run tests**

```bash
./scripts/plan/tests/test-brainstorm-emit.sh
```

Expected: 4 passed, 0 failed.

- [ ] **Step 4: Commit Task 4**

```bash
git add scripts/plan/
git commit -m "feat(E187): emit plan_brainstorm audit event from harness"
```

---

## Task 5: Add 3 more edge-case tests (empty, missing fields, idempotency guard)

**Files:**
- Modify: `scripts/plan/tests/test-brainstorm-emit.sh` (add Tests 5, 6, 7)

- [ ] **Step 1: Add Test 5 — input JSON missing required field**

Append:

```bash
# --- Test 5: missing required field rejects ---
echo "Test 5: missing field rejection"
TMPDIR_T5=$(mktemp -d)
cat > "$TMPDIR_T5/bad.json" <<EOF
{"slug": "broken", "name": "Missing epic field"}
EOF
mkdir -p "$TMPDIR_T5/epics"

if EPICS_DIR="$TMPDIR_T5/epics" "$HARNESS" render-epic "$TMPDIR_T5/bad.json" 2>/dev/null; then
  fail "expected non-zero exit on missing field, got 0"
else
  pass "harness rejects malformed JSON"
fi

rm -rf "$TMPDIR_T5"
```

Note: this passes because `jq -r '.epic'` on a missing key returns `null` (string), and the render path constructs `e null-broken.md` which lacks an `epics` dir entry. To make this test meaningful, add a guard at the top of both subcommands:

```bash
for field in epic slug name; do
  val=$(jq -r ".$field // empty" "$input")
  if [ -z "$val" ]; then
    echo "error: missing required field: $field" >&2
    return 65
  fi
done
```

After adding the guard, the test passes deterministically (exit 65, not "no file created").

- [ ] **Step 2: Add Test 6 — render-epic refuses to overwrite existing file**

Append:

```bash
# --- Test 6: render-epic refuses overwrite ---
echo "Test 6: idempotency guard"
TMPDIR_T6=$(mktemp -d)
mkdir -p "$TMPDIR_T6/epics"
cp "$FIXTURES/sample-brainstorm.json" "$TMPDIR_T6/input.json"

# First render — should succeed
EPICS_DIR="$TMPDIR_T6/epics" "$HARNESS" render-epic "$TMPDIR_T6/input.json" >/dev/null

# Second render — should fail with exit 68
if EPICS_DIR="$TMPDIR_T6/epics" "$HARNESS" render-epic "$TMPDIR_T6/input.json" 2>/dev/null; then
  fail "expected exit 68 on existing file, got 0"
else
  rc=$?
  [ "$rc" -eq 68 ] && pass "harness refuses overwrite" || fail "expected exit 68, got $rc"
fi

rm -rf "$TMPDIR_T6"
```

- [ ] **Step 3: Add Test 7 — existing epic files (E180–E186) still parse**

This is the backward-compat check. We don't render them through the harness; we just assert they have the expected core sections so the new sections (Implementation Phases / Test Strategy) are additive, not breaking:

```bash
# --- Test 7: existing epic files have required core sections ---
echo "Test 7: existing epic files backward-compat"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
EXISTING_EPICS=("e180-memory-retrieval-logging.md" "e186-memory-metrics-dashboard.md")
BACKCOMPAT_OK=1
for ep in "${EXISTING_EPICS[@]}"; do
  if [ ! -f "$REPO_ROOT/docs/epics/$ep" ]; then
    fail "existing epic missing: $ep"
    BACKCOMPAT_OK=0
    continue
  fi
  if ! grep -q "^## Problem" "$REPO_ROOT/docs/epics/$ep"; then
    fail "epic $ep missing ## Problem section"
    BACKCOMPAT_OK=0
  fi
  if ! grep -q "^## Acceptance Criteria" "$REPO_ROOT/docs/epics/$ep"; then
    fail "epic $ep missing ## Acceptance Criteria section"
    BACKCOMPAT_OK=0
  fi
done
[ "$BACKCOMPAT_OK" -eq 1 ] && pass "existing epics retain core sections"
```

- [ ] **Step 4: Run all 7 tests**

```bash
./scripts/plan/tests/test-brainstorm-emit.sh
```

Expected: `Results: 7 passed, 0 failed`.

- [ ] **Step 5: Commit Task 5**

```bash
git add scripts/plan/
git commit -m "test(E187): edge-case fixtures (missing fields, idempotency, back-compat)"
```

---

## Task 6: Extend `.claude/commands/athena/plan.md` Usage + add Step 2.5

**Files:**
- Modify: `.claude/commands/athena/plan.md`

- [ ] **Step 1: Read current plan.md Usage section**

Reference (already read in exploration): lines 12–24 contain the Usage block. The current modes are `research / audit / comply / evolve / auto / status / approve / reject / defer`.

- [ ] **Step 2: Edit Usage section to add brainstorm mode**

Replace the Usage code block in `.claude/commands/athena/plan.md` (lines 12–24):

```markdown
## Usage

Parse $ARGUMENTS for mode:

```
/athena:plan research     # Competitor + industry analysis
/athena:plan audit        # Codebase weakness scan
/athena:plan comply       # Compliance gap analysis (OWASP + WCAG)
/athena:plan evolve       # Dependency + security scan
/athena:plan auto         # All modes, prioritized output
/athena:plan brainstorm "feature idea"  # Design dialogue → enriched epic proposal (E187)
/athena:plan status       # Show current strategy-log state (no analysis)
/athena:plan approve E{n},E{m}  # Approve specific proposed epics
/athena:plan reject E{n}        # Reject with reason
/athena:plan defer E{n}         # Move to "Deferred Ideas"
```

Default mode (no argument): `auto`
```

- [ ] **Step 3: Add Step 2.5 (Brainstorm Mode) after Step 2**

After the existing `## Step 2 — Analysis` section (which ends around line 40), insert:

```markdown
## Step 2.5 — Brainstorm Mode (E187)

If `$ARGUMENTS` starts with `brainstorm`:

1. Extract the feature idea string: everything after `brainstorm ` (strip surrounding quotes).
2. Spawn `@strategist` via the Agent tool with prompt:
   - "Run brainstorm protocol for feature idea: `{idea}`. Read `.claude/agents/strategist.md` § Brainstorm Mode. Conduct Q&A dialogue with the user; capture phases, checkpoints, test_strategy, dependencies, risks. When user approves the design, emit the result as a JSON file at `/tmp/brainstorm-<epic>.json` matching the schema in `scripts/plan/brainstorm-emit.sh` header."
3. After @strategist returns with a written JSON path:
   - Run: `./scripts/plan/brainstorm-emit.sh strategy-log /tmp/brainstorm-<epic>.json`
   - Verify exit 0
4. Report to user:
   - "Brainstorm complete. Epic E{n} proposed in `docs/context/strategy-log.md`. Run `/athena:plan approve E{n}` to render the enriched epic file."
5. STOP (do not proceed to approval — user must approve explicitly).
```

- [ ] **Step 4: Extend Step 1 of `approve` flow to call render-epic**

Find the `### approve E{n},E{m},...` block. After step "1. Read the proposal from strategy-log.md" and before step "2. Create `docs/epics/E{n}_{slug}.md`...":

Change step 2 to:

```markdown
2. Create the epic file:
   - **If the proposal row has "(brainstorm)" suffix in its heading** (indicates brainstorm mode):
     - Locate the brainstorm JSON at `/tmp/brainstorm-E{n}.json` (or wherever @strategist wrote it; if absent, reconstruct from the strategy-log row)
     - Run: `./scripts/plan/brainstorm-emit.sh render-epic /tmp/brainstorm-E{n}.json`
     - This writes the enriched epic file with Implementation Phases / Per-Phase Checkpoints / Test Strategy sections
   - **Otherwise** (legacy / non-brainstorm modes):
     - Create `docs/epics/e{n}-{slug}.md` with the existing template (Problem / Solution / Key Files / Implementation / AC / Cross-Epic / Out of Scope)
```

- [ ] **Step 5: Run a syntax sanity check on the markdown**

```bash
# No real validator — just confirm the file is still parseable as markdown
wc -l .claude/commands/athena/plan.md
grep -c "^##" .claude/commands/athena/plan.md
```

Expected: line count increased by ~25 lines; section header count increased by 1 (new Step 2.5).

- [ ] **Step 6: Commit Task 6**

```bash
git add .claude/commands/athena/plan.md
git commit -m "feat(E187): /athena:plan brainstorm sub-mode + approve render-epic dispatch"
```

---

## Task 7: Add `Brainstorm Mode` section to `@strategist.md`

**Files:**
- Modify: `.claude/agents/strategist.md`

- [ ] **Step 1: Add new Brainstorm Mode section**

Append to `.claude/agents/strategist.md` (after the existing `### auto — All Modes Combined` section, before `## Output Format`):

```markdown
### brainstorm — Design Dialogue Mode (E187)

Refine a single feature idea via Q&A dialogue before any spec or code. Output is a JSON file at `/tmp/brainstorm-<epic>.json` consumable by `scripts/plan/brainstorm-emit.sh`.

**Protocol:**

1. **Explore context** — read `epic-progress.md`, recent `strategy-log.md` entries, any relevant code paths the idea touches. Cap to 5 file reads.
2. **One question at a time** — ask clarifying questions to refine:
   - Purpose (what problem does this solve, for whom)
   - Constraints (technical / business / time)
   - Success criteria (how do we know it worked)
   - Hard cap: 7 questions total. Override only on user instruction.
3. **Propose 2-3 approaches** with trade-offs. Lead with your recommendation.
4. **Present design sections** scaled to complexity:
   - Architecture (1-3 sentences)
   - Components / files
   - Data flow
   - Error handling
   - Testing strategy
   - Ask after each section: "Looks right?"
5. **Capture phases / checkpoints / test_strategy** during the dialogue (write to scratchpad, not yet to disk).
6. **Write JSON** to `/tmp/brainstorm-<epic>.json` matching this schema:

```json
{
  "epic": "E{n}",
  "slug": "kebab-slug",
  "name": "Title Case Name",
  "priority": "P0|P1|P2|P3",
  "size": "S|M|L",
  "sp": 3,
  "rationale": "one-paragraph why",
  "phases": [{"id": 1, "name": "Phase name", "tasks": ["task1", "task2"]}, ...],
  "checkpoints": [{"phase": 1, "verify": "what to check"}, ...],
  "test_strategy": "what to test, how, with what",
  "dependencies": ["E{x}", "..."],
  "risks": ["risk1", "..."]
}
```

7. **Output to user**: "Brainstorm captured at `/tmp/brainstorm-E{n}.json`. Next: `/athena:plan` command will run `brainstorm-emit.sh strategy-log` to write the proposal row. Then `/athena:plan approve E{n}` to render the enriched epic file."

**Safety:**
- Do NOT modify code files during brainstorm — read-only context exploration
- Do NOT write to `strategy-log.md` directly — the harness does it
- Do NOT bypass the approval gate
- Phase count ≥3 (forces meaningful decomposition)
- Each phase ≥1 task; each checkpoint must reference a phase id present in the phases array
```

- [ ] **Step 2: Sanity check the agent file**

```bash
wc -l .claude/agents/strategist.md
grep -c "^###" .claude/agents/strategist.md  # should have one more sub-section
```

Expected: file grew ~60 lines; `###` count up by 1.

- [ ] **Step 3: Commit Task 7**

```bash
git add .claude/agents/strategist.md
git commit -m "feat(E187): @strategist Brainstorm Mode protocol"
```

---

## Task 8: Document `plan_brainstorm` event in `scripts/hooks/CLAUDE.md`

**Files:**
- Modify: `scripts/hooks/CLAUDE.md`

- [ ] **Step 1: Add new section in JSONL Audit Log area**

Find the `### Memory Retrieval Events (E180)` section in `scripts/hooks/CLAUDE.md`. After the `### Lesson Archive / Revive Events (E184)` section, add:

```markdown
### Plan Brainstorm Events (E187)

`scripts/plan/brainstorm-emit.sh` emits one `plan_brainstorm` event per subcommand invocation — one for the proposal write, one for the epic-file render on approve:

```json
{"ts":"2026-05-19T12:00:00Z","event":"plan_brainstorm","epic":"E300","status":"proposed","phase_count":3}
{"ts":"2026-05-19T13:00:00Z","event":"plan_brainstorm","epic":"E300","status":"approved","phase_count":3}
```

| Event | Emitted by | Trigger |
|-------|------------|---------|
| `plan_brainstorm` (status=proposed) | `brainstorm-emit.sh strategy-log` | After appending the brainstorm proposal row to `docs/context/strategy-log.md`. |
| `plan_brainstorm` (status=approved) | `brainstorm-emit.sh render-epic` | After rendering the enriched epic file at `docs/epics/e{n}-*.md` via `/athena:plan approve E{n}`. |

| Field | Type | Notes |
|-------|------|-------|
| `ts` | ISO 8601 UTC | Override via `CLOCK_TS` env var (test fixtures only) |
| `event` | string | Always `"plan_brainstorm"` |
| `epic` | string | `E{n}` of the brainstormed epic |
| `status` | enum | `proposed` (pre-approval) or `approved` (post-approval render) |
| `phase_count` | int | Number of Implementation Phases in the JSON (typically 3-5) |

Test injection env vars (mirrors E180–E184 convention):

| Variable | Purpose |
|----------|---------|
| `AUDIT_LOG_PATH` | Override `.claude/audit.jsonl` |
| `STRATEGY_LOG_PATH` | Override `docs/context/strategy-log.md` |
| `EPICS_DIR` | Override `docs/epics/` |
| `CLOCK_DATE` | Override `date -u +%Y-%m-%d` (date-only, for strategy-log row header) |
| `CLOCK_TS` | Override `date -u +%Y-%m-%dT%H:%M:%SZ` (ISO 8601, for audit event timestamp) |

Tests live in `scripts/plan/tests/test-brainstorm-emit.sh` (7 cases, runs in <2s).

#### Example `jq` queries

```bash
# All brainstorm events
jq 'select(.event == "plan_brainstorm")' .claude/audit.jsonl

# Per-status counts
jq -s 'map(select(.event == "plan_brainstorm")) | group_by(.status) | map({status: .[0].status, count: length})' .claude/audit.jsonl

# Brainstorm phase-count distribution
jq -s 'map(select(.event == "plan_brainstorm")) | group_by(.phase_count) | map({phase_count: .[0].phase_count, epics: length})' .claude/audit.jsonl
```
```

- [ ] **Step 2: Sanity check**

```bash
grep -c "plan_brainstorm" scripts/hooks/CLAUDE.md  # should be ≥4 (table row + json examples + section heading)
```

- [ ] **Step 3: Commit Task 8**

```bash
git add scripts/hooks/CLAUDE.md
git commit -m "docs(E187): document plan_brainstorm audit event in hooks/CLAUDE.md"
```

---

## Task 9: Update `docs/context/qa-patterns.md`

**Files:**
- Modify: `docs/context/qa-patterns.md`

- [ ] **Step 1: Add one-paragraph note**

Append to `docs/context/qa-patterns.md`:

```markdown

## Pattern: Brainstorm-First Planning (E187, Phase 46)

`/athena:plan brainstorm "feature idea"` runs `@strategist` in dialogue mode (Q&A capped at 7 questions, 2-3 proposed approaches, section-by-section design review) and writes a JSON spec to `/tmp/brainstorm-<epic>.json`. The harness `scripts/plan/brainstorm-emit.sh strategy-log` appends an enriched row to `strategy-log.md`. On `/athena:plan approve E{n}`, the harness's `render-epic` subcommand writes the epic file at `docs/epics/e{n}-*.md` with **Implementation Phases**, **Per-Phase Checkpoints**, and **Test Strategy** sections — derived from dialogue, not retroactively backfilled. Backward compat: epic files without these sections (E180–E186 et al.) still validate; the sections are additive. Audit emits `plan_brainstorm {status: proposed|approved, phase_count}`.
```

- [ ] **Step 2: Commit Task 9**

```bash
git add docs/context/qa-patterns.md
git commit -m "docs(E187): qa-patterns note for brainstorm-first planning"
```

---

## Task 10: End-to-end integration test

**Files:**
- Create (temp): `/tmp/e187-smoke-input.json`
- No code changes — this task is a manual smoke run to confirm the pieces fit

- [ ] **Step 1: Construct a sample brainstorm JSON**

```bash
cat > /tmp/e187-smoke-input.json <<'EOF'
{
  "epic": "E999",
  "slug": "smoke-test-feature",
  "name": "E187 Smoke Test Feature",
  "priority": "P2",
  "size": "S",
  "sp": 2,
  "rationale": "Smoke-test the brainstorm-emit harness end-to-end.",
  "phases": [
    {"id": 1, "name": "Setup", "tasks": ["foo", "bar"]},
    {"id": 2, "name": "Wire", "tasks": ["baz"]},
    {"id": 3, "name": "Verify", "tasks": ["qux"]}
  ],
  "checkpoints": [
    {"phase": 1, "verify": "Foo and bar exist"},
    {"phase": 2, "verify": "Baz wired"},
    {"phase": 3, "verify": "Qux green"}
  ],
  "test_strategy": "Smoke test only — no real assertions.",
  "dependencies": [],
  "risks": []
}
EOF
```

- [ ] **Step 2: Run strategy-log against a throwaway dir**

```bash
TMPDIR_E2E=$(mktemp -d)
mkdir -p "$TMPDIR_E2E/epics"
cat > "$TMPDIR_E2E/strategy-log.md" <<EOF
# Strategy Log

## Current Cycle
EOF

STRATEGY_LOG_PATH="$TMPDIR_E2E/strategy-log.md" \
  AUDIT_LOG_PATH="$TMPDIR_E2E/audit.jsonl" \
  ./scripts/plan/brainstorm-emit.sh strategy-log /tmp/e187-smoke-input.json

tail -30 "$TMPDIR_E2E/strategy-log.md"
```

Expected: strategy-log row appended with E999 / Phase 1-3 / checkpoints / test strategy.

- [ ] **Step 3: Run render-epic against the same throwaway dir**

```bash
EPICS_DIR="$TMPDIR_E2E/epics" \
  AUDIT_LOG_PATH="$TMPDIR_E2E/audit.jsonl" \
  ./scripts/plan/brainstorm-emit.sh render-epic /tmp/e187-smoke-input.json

cat "$TMPDIR_E2E/epics/e999-smoke-test-feature.md"
```

Expected: enriched epic file with Implementation Phases / Per-Phase Checkpoints / Test Strategy sections.

- [ ] **Step 4: Verify audit events**

```bash
jq 'select(.event == "plan_brainstorm")' "$TMPDIR_E2E/audit.jsonl"
```

Expected: two events — one `status: "proposed"`, one `status: "approved"`, both `epic: "E999"`, both `phase_count: 3`.

- [ ] **Step 5: Cleanup**

```bash
rm -rf "$TMPDIR_E2E" /tmp/e187-smoke-input.json
```

No commit for this task — manual smoke test only.

---

## Task 11: Full test suite + final commit + branch push

**Files:**
- All previously modified files

- [ ] **Step 1: Run the harness test suite**

```bash
./scripts/plan/tests/test-brainstorm-emit.sh
```

Expected: `Results: 7 passed, 0 failed`.

- [ ] **Step 2: Run the existing server + client suites to catch regressions**

```bash
cd server && uv run pytest -x --tb=short -q 2>&1 | tail -10
cd ../client && pnpm test --run --reporter=dot 2>&1 | tail -10
cd ..
```

Expected: no new failures vs. main. Server: ~398 passing. Client: ~515 passing.

- [ ] **Step 3: Run the Stop verifier dry-run by attempting a git commit on a tracked but clean change**

```bash
git status --short
```

Expected: clean working tree (all changes committed task-by-task).

- [ ] **Step 4: Push the branch**

```bash
git push origin "$(git branch --show-current)"
```

Expected: push succeeds. (If working on main directly — switch to a `feat/E187-athena-plan-brainstorm` branch before pushing.)

- [ ] **Step 5: Open PR via `gh`**

```bash
gh pr create --title "feat(E187): /athena:plan brainstorm mode + enriched epic file template" --body "$(cat <<'BODY'
## Summary
- Adds `/athena:plan brainstorm "idea"` sub-mode — Q&A dialogue with `@strategist` produces JSON spec
- `scripts/plan/brainstorm-emit.sh` harness writes strategy-log row + enriched epic file
- Enriched epic file template now includes **Implementation Phases**, **Per-Phase Checkpoints**, **Test Strategy** sections
- New `plan_brainstorm` audit event (status: proposed | approved)
- Backward-compatible: existing E180–E186 epic files unchanged

## Test plan
- [ ] `./scripts/plan/tests/test-brainstorm-emit.sh` → 7 passed, 0 failed
- [ ] Server suite: `cd server && uv run pytest` → no new failures
- [ ] Client suite: `cd client && pnpm test --run` → no new failures
- [ ] Smoke: brainstorm a throwaway feature E999 end-to-end (see Task 10)
- [ ] Verify `jq 'select(.event=="plan_brainstorm")' .claude/audit.jsonl` shows events

Spec: `docs/superpowers/specs/2026-05-18-athena-phase-46-roadmap.md` §5 E187
Plan: `docs/superpowers/plans/2026-05-19-e187-athena-plan-brainstorm.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
BODY
)"
```

Expected: PR URL printed to stdout.

---

## Acceptance Criteria (mirrors spec §5 E187)

- [ ] `/athena:plan brainstorm "X"` extends the strategy-log row with phases / checkpoints / test_strategy
- [ ] On `/athena:plan approve`, the generated `docs/epics/e{n}-{slug}.md` contains: Implementation Phases (≥3), Per-Phase Checkpoints, Test Strategy section
- [ ] Audit log emits `plan_brainstorm` event with `{epic, status, phase_count}` fields
- [ ] Existing `/athena:plan` modes (audit/research/comply/evolve/auto) work unchanged
- [ ] `@strategist` agent definition has `Brainstorm Mode` section
- [ ] 7 fixture tests pass in `scripts/plan/tests/test-brainstorm-emit.sh`
- [ ] Backward compat: E180–E186 epic files still have core sections (Problem / AC)
- [ ] `scripts/hooks/CLAUDE.md` documents `plan_brainstorm` event
- [ ] `docs/context/qa-patterns.md` notes the new pattern

---

## Self-Review Notes

**Spec coverage:** all 8 spec AC items map to a task (see checklist above).

**Placeholder scan:** no TBDs in shipped tasks (Task 3 golden `**Checkpoint:**` uses real values from the fixture, not placeholders).

**Type consistency:** the JSON schema is defined once in Task 2 fixture and referenced consistently in Tasks 3, 4, 7. Field names (`epic`, `slug`, `name`, `priority`, `size`, `sp`, `rationale`, `phases`, `checkpoints`, `test_strategy`, `dependencies`, `risks`) match across the harness, the test goldens, the `@strategist` protocol, and the audit event.

**Known cliff:** Task 4 introduces both `CLOCK_DATE` (for date-only header) and `CLOCK_TS` (for ISO 8601 audit ts). Task 2 originally used `CLOCK_TS` for the date — Task 4 Step 2 explicitly fixes this divergence. The fix is in-place; if executed out of order, the test would fail loudly with a golden diff, surfacing the issue.

---

## Provenance

- Drafted: 2026-05-19 via `superpowers:writing-plans` skill
- Spec: `docs/superpowers/specs/2026-05-18-athena-phase-46-roadmap.md` §5 E187
- Foundation epic for Phase 46 (E188, E189, E190, E191 depend on this shipping first)
