#!/usr/bin/env bash
# scripts/staleness-check.sh — Advisory staleness detector for docs/.
#
# Scans docs/ and CLAUDE.md for embedded numbers that can silently go stale:
#   - Test counts ("N unit tests", "N tests", etc.)
#   - Migration counts (compared to next-app/drizzle/migrations/)
#   - Phase/epic number claims in session-summary.md vs EPIC_INDEX.md
#
# Exit 0 always — this is advisory, not a blocking gate.
# Run: bash scripts/staleness-check.sh
#   or: make staleness-check
#
# To wire into CI as a blocking gate, change the final exit to: exit $issues

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

issues=0
report=()

log_ok()   { report+=("  ✓ $*"); }
log_warn() { report+=("  ⚠ $*"); issues=$((issues + 1)); }
log_skip() { report+=("  – $*"); }

# ─── 1. Test count claims ────────────────────────────────────────────────────
# Look for patterns like "181 unit tests", "518 tests", "N passing" in docs/.
echo "Checking test count claims…"

doc_test_claims=$(grep -rn --include="*.md" -E "[0-9]+ (unit )?tests?" docs/ CLAUDE.md 2>/dev/null | \
  grep -vE "^\s*#|test file|test suite|test case|test runner|test:e2e|e2e test|playwright" | \
  head -20 || true)

if [ -z "$doc_test_claims" ]; then
  log_ok "No test-count claims found in docs/ or CLAUDE.md."
else
  # Try to get the actual test count from vitest
  actual_tests=""
  if command -v pnpm >/dev/null 2>&1 && [ -f "next-app/package.json" ]; then
    actual_tests=$(cd next-app && pnpm test --reporter=verbose 2>&1 | \
      grep -E "^Tests|passed|failed" | tail -3 || true)
  fi

  if [ -n "$actual_tests" ]; then
    log_warn "Test count claims in docs — verify against current count:"
    while IFS= read -r line; do
      report+=("      $line")
    done <<< "$doc_test_claims"
    report+=("    Current test output:")
    while IFS= read -r line; do
      report+=("      $line")
    done <<< "$actual_tests"
  else
    log_warn "Test count claims in docs — could not auto-verify (run 'pnpm test' in next-app/):"
    while IFS= read -r line; do
      report+=("      $line")
    done <<< "$doc_test_claims"
  fi
fi

# ─── 2. Migration count claims ───────────────────────────────────────────────
echo "Checking migration count claims…"

migration_dir="next-app/drizzle/migrations"
if [ -d "$migration_dir" ]; then
  actual_migrations=$(find "$migration_dir" -name "*.sql" | wc -l | tr -d ' ')
  doc_migration_claims=$(grep -rn --include="*.md" -E "[0-9]+ migration" docs/ CLAUDE.md 2>/dev/null | \
    head -10 || true)

  if [ -z "$doc_migration_claims" ]; then
    log_ok "No migration-count claims found. (Actual migration files: $actual_migrations)"
  else
    log_warn "Migration count claims in docs (actual: $actual_migrations .sql files in $migration_dir):"
    while IFS= read -r line; do
      report+=("      $line")
    done <<< "$doc_migration_claims"
  fi
else
  log_skip "Migration dir $migration_dir not found — skipping migration count check."
fi

# ─── 3. Phase / epic number claims in session-summary.md ────────────────────
echo "Checking phase/epic number claims…"

summary_file="docs/context/session-summary.md"
epic_index="docs/epics/EPIC_INDEX.md"

if [ -f "$summary_file" ] && [ -f "$epic_index" ]; then
  # Extract the highest phase number mentioned in session-summary
  doc_phase=$(grep -oE "Phase [0-9]+" "$summary_file" 2>/dev/null | \
    grep -oE "[0-9]+" | sort -n | tail -1 || true)

  # Extract the highest phase number in EPIC_INDEX
  index_phase=$(grep -oE "Phase [0-9]+" "$epic_index" 2>/dev/null | \
    grep -oE "[0-9]+" | sort -n | tail -1 || true)

  if [ -n "$doc_phase" ] && [ -n "$index_phase" ]; then
    if [ "$doc_phase" -lt "$index_phase" ]; then
      log_warn "session-summary.md mentions Phase $doc_phase but EPIC_INDEX.md goes up to Phase $index_phase — session-summary may be stale."
    else
      log_ok "Phase numbers consistent: session-summary=$doc_phase, EPIC_INDEX=$index_phase."
    fi
  else
    log_skip "Could not extract phase numbers for comparison."
  fi
else
  log_skip "session-summary.md or EPIC_INDEX.md not found — skipping phase check."
fi

# ─── 4. Specific high-signal stat claims in CLAUDE.md ───────────────────────
echo "Checking CLAUDE.md stat claims…"

# Check for explicit numeric agent/command counts
claude_agents_claim=$(grep -oE "[0-9]+ agents?" CLAUDE.md 2>/dev/null | head -1 || true)
if [ -n "$claude_agents_claim" ]; then
  actual_agents=$(find .claude/agents -maxdepth 1 \( -name "*.yml" -o -name "*.yaml" \) 2>/dev/null | wc -l | tr -d ' ')
  claimed_n=$(echo "$claude_agents_claim" | grep -oE "[0-9]+" | head -1)
  if [ "$claimed_n" != "$actual_agents" ]; then
    log_warn "CLAUDE.md claims '$claude_agents_claim' but found $actual_agents agent YAML files in .claude/agents/."
  else
    log_ok "Agent count claim in CLAUDE.md matches: $actual_agents agents."
  fi
fi

# ─── 5. Print report ─────────────────────────────────────────────────────────
echo ""
echo "─── Staleness Report ───────────────────────────────────────────────────────"
if [ ${#report[@]} -eq 0 ]; then
  echo "  (nothing checked)"
else
  for line in "${report[@]}"; do
    echo "$line"
  done
fi
echo "────────────────────────────────────────────────────────────────────────────"

if [ "$issues" -eq 0 ]; then
  echo ""
  echo "All looks current. ($issues warnings)"
else
  echo ""
  echo "$issues potential staleness warning(s) — review above and update docs if needed."
  echo "(Advisory only — this script always exits 0.)"
fi

# Advisory: always exit 0
exit 0
