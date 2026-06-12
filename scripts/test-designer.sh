#!/bin/bash
# scripts/test-designer.sh — Smoke test for E163 Part A scaffolding.
#
# Asserts:
#   1. .claude/agents/designer.md exists, has YAML frontmatter, declares model + description + allowed-tools
#   2. .claude/commands/athena/design.md exists, has frontmatter with description + allowed-tools
#   3. CLAUDE.md mentions @designer in the Agent Team list
#   4. CLAUDE.md mentions /athena:design in the Slash Commands list
#   5. Stop-verifier rules #13, #14, #17 are still present (not regressed)
#
# Bash 3.2 portable (macOS default — no associative arrays, no mapfile).
# Exit 0 = all asserts pass, exit 1 = at least one failed.

set -u
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")" || exit 1

PASS=0
FAIL=0
FAILURES=""

assert() {
  # $1 = description, $2 = command (eval'd, exit 0 = pass)
  local desc="$1"
  local cmd="$2"
  if eval "$cmd" >/dev/null 2>&1; then
    PASS=$((PASS + 1))
    echo "  PASS  $desc"
  else
    FAIL=$((FAIL + 1))
    FAILURES="${FAILURES}  - ${desc}\n"
    echo "  FAIL  $desc"
  fi
}

echo "=== E163 Part A scaffolding smoke test ==="

# 1. designer.md
DESIGNER=".claude/agents/designer.md"
assert "designer.md exists"                 "[ -f '$DESIGNER' ]"
assert "designer.md has YAML frontmatter"   "head -1 '$DESIGNER' | grep -q '^---$'"
assert "designer.md declares model"         "grep -qE '^model:' '$DESIGNER'"
assert "designer.md declares description"   "grep -qE '^description:' '$DESIGNER'"
assert "designer.md declares allowed-tools" "grep -qE '^allowed-tools:' '$DESIGNER'"
assert "designer.md mentions design_generated audit event" \
  "grep -q 'design_generated' '$DESIGNER'"

# 2. /athena:design command
DESIGN_CMD=".claude/commands/athena/design.md"
assert "design.md command exists"                  "[ -f '$DESIGN_CMD' ]"
assert "design.md has YAML frontmatter"            "head -1 '$DESIGN_CMD' | grep -q '^---$'"
assert "design.md declares description"            "grep -qE '^description:' '$DESIGN_CMD'"
assert "design.md declares allowed-tools"          "grep -qE '^allowed-tools:' '$DESIGN_CMD'"
assert "design.md uses \$ARGUMENTS"                "grep -q '\$ARGUMENTS' '$DESIGN_CMD'"
assert "design.md mentions @designer"              "grep -q '@designer' '$DESIGN_CMD'"

# 3 + 4. CLAUDE.md updates
assert "CLAUDE.md lists @designer"                 "grep -q '@designer' CLAUDE.md"
assert "CLAUDE.md lists /athena:design"            "grep -q '/athena:design' CLAUDE.md"
assert "CLAUDE.md says 11 agents"                  "grep -q '11 agent' CLAUDE.md"
assert "CLAUDE.md says 21 slash commands"          "grep -q '21 slash commands' CLAUDE.md"

# 5. Stop-verifier rules #13/#14/#17 still present (don't regress)
VERIFIER="scripts/hooks/stop-verifier.sh"
assert "stop-verifier has Rule 13 (Orphan Route)"   "grep -q 'Rule 13: Orphan Route' '$VERIFIER'"
assert "stop-verifier has Rule 14 (CSS Co-location)" "grep -q 'Rule 14: CSS Co-location' '$VERIFIER'"
assert "stop-verifier has Rule 17 (CSS Variable Drift)" "grep -q 'Rule 17: CSS Variable Drift' '$VERIFIER'"

# 6. design-review directory exists (created by Part A)
assert "docs/context/design-review/ exists" "[ -d 'docs/context/design-review' ]"

echo ""
echo "=== Result: ${PASS} passed, ${FAIL} failed ==="
if [ "$FAIL" -gt 0 ]; then
  printf "Failures:\n%b" "$FAILURES"
  exit 1
fi
exit 0
