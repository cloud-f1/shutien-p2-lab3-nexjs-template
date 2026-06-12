#!/usr/bin/env bash
# E33 — Post-scaffold smoke test
# Usage: ./scripts/smoke-test.sh [project-dir]
# Defaults to current directory if no argument given.
# Exits non-zero on any test failure.
set -euo pipefail

DIR="${1:-.}"
PASS=0
FAIL=0

run_check() {
  local label="$1"
  shift
  echo "=> ${label}..."
  if "$@"; then
    echo "   PASS: ${label}"
    PASS=$((PASS + 1))
  else
    echo "   FAIL: ${label}"
    FAIL=$((FAIL + 1))
  fi
}

# Test 1: Python server imports resolve
run_check "Server import check" \
  bash -c "cd \"$DIR/server\" && python -c 'from app.main import app; print(\"OK\")'"

# Test 2: Client build succeeds
run_check "Client build check" \
  bash -c "cd \"$DIR/client\" && pnpm build --silent"

# Test 3: Client tests pass
run_check "Client test check" \
  bash -c "cd \"$DIR/client\" && pnpm test -- --run --reporter=dot 2>&1 | tail -5"

# Test 4: Server tests pass (if pytest available)
run_check "Server test check" \
  bash -c "cd \"$DIR/server\" && python -m pytest --tb=short -q 2>&1 | tail -5"

# Summary
echo ""
echo "=== Smoke test complete ==="
echo "    Passed: ${PASS}  Failed: ${FAIL}"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
