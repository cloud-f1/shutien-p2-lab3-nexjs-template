#!/bin/bash
# Test fixture for Rule 18 — QA Gate Enforcement (E155)
#
# Runs stop-verifier.sh in isolated temp git repos with fixture epic-progress
# files, exercising the impl/qa column parsing and branch-name detection.
#
# Injection pattern: the verifier supports BRANCH_OVERRIDE and
# EPIC_PROGRESS_PATH env vars, but this test uses real git branches + real
# progress files so the full integration (grep, awk, git) is exercised.

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
STOP_VERIFIER="$REPO_ROOT/scripts/hooks/stop-verifier.sh"

PASS=0
FAIL=0

run_test() {
  local name="$1"
  local branch="$2"
  local impl="$3"
  local qa="$4"
  local expected_exit="$5"

  local tmpdir
  tmpdir=$(mktemp -d)
  (
    cd "$tmpdir"
    git init -q
    git config user.email test@test.example
    git config user.name Test
    mkdir -p docs/context
    cat > docs/context/epic-progress.md <<EOF
| Epic | Spec | Impl | QA | Commit | Merge | Notes |
|------|------|------|-----|--------|-------|-------|
| E999 | ✅ | $impl | $qa | ⬜ | ⬜ | Rule 18 test fixture |
EOF
    git add .
    git commit -q -m "init"
    if [ "$branch" != "main" ] && [ "$branch" != "master" ]; then
      git checkout -q -b "$branch"
    fi
    # Touch a dummy file so CHANGED is non-empty (stop-verifier early-exits otherwise)
    echo "dummy" > touched.txt
    git add touched.txt
  )

  local actual_exit
  set +e
  (cd "$tmpdir" && bash "$STOP_VERIFIER") > /tmp/rule18-out.$$.txt 2>&1
  actual_exit=$?
  set -e

  if [ "$actual_exit" = "$expected_exit" ]; then
    echo "  ✅ $name"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $name — expected exit $expected_exit, got $actual_exit"
    sed 's/^/      /' /tmp/rule18-out.$$.txt
    FAIL=$((FAIL + 1))
  fi

  rm -f /tmp/rule18-out.$$.txt
  rm -rf "$tmpdir"
}

run_test_missing_row() {
  local name="$1"
  local branch="$2"
  local expected_exit="$3"

  local tmpdir
  tmpdir=$(mktemp -d)
  (
    cd "$tmpdir"
    git init -q
    git config user.email test@test.example
    git config user.name Test
    mkdir -p docs/context
    # Progress file has no matching epic row
    cat > docs/context/epic-progress.md <<EOF
| Epic | Spec | Impl | QA | Commit | Merge | Notes |
|------|------|------|-----|--------|-------|-------|
| E100 | ✅ | ✅ | ✅ | ✅ | ✅ | Some other epic |
EOF
    git add .
    git commit -q -m "init"
    git checkout -q -b "$branch"
    echo "dummy" > touched.txt
    git add touched.txt
  )

  local actual_exit
  set +e
  (cd "$tmpdir" && bash "$STOP_VERIFIER") > /tmp/rule18-out.$$.txt 2>&1
  actual_exit=$?
  set -e

  if [ "$actual_exit" = "$expected_exit" ]; then
    echo "  ✅ $name"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $name — expected exit $expected_exit, got $actual_exit"
    sed 's/^/      /' /tmp/rule18-out.$$.txt
    FAIL=$((FAIL + 1))
  fi

  rm -f /tmp/rule18-out.$$.txt
  rm -rf "$tmpdir"
}

echo "=== Rule 18: QA Gate Enforcement ==="

# Fail cases: impl=✅ but qa is not ✅
run_test "fail when impl=✅ qa=⬜ on feat/e999-*"   "feat/e999-test"   "✅" "⬜" "2"
run_test "fail when impl=✅ qa=❌ on feat/e999-*"   "feat/e999-test"   "✅" "❌" "2"

# Pass cases
run_test "pass when impl=✅ qa=✅ (qa complete)"    "feat/e999-test"   "✅" "✅" "0"
run_test "pass when impl=⬜ qa=⬜ (not yet impl)"   "feat/e999-test"   "⬜" "⬜" "0"
run_test "pass when impl=🔄 qa=⬜ (impl in-prog)"    "feat/e999-test"   "🔄" "⬜" "0"

# Branch-scope cases
run_test "pass on main branch even with bad state" "main"             "✅" "⬜" "0"
run_test "pass on chore/* branch"                   "chore/cleanup"    "✅" "⬜" "0"

# Edge: missing row in progress file
run_test_missing_row "pass when epic has no matching row" "feat/e888-ghost" "0"

echo ""
echo "Passed: $PASS | Failed: $FAIL"
[ "$FAIL" = "0" ] || exit 1
