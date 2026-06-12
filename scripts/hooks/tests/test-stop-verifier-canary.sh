#!/bin/bash
# E204 — Stop-Verifier Fail-Open Canary
#
# Guards against the failure CLASS where an epic-safety rule silently SKIPS
# (fails open) on a branch naming convention its regex doesn't match — the bug
# that disabled Rules 18/19/20 on the real `MH/feat/E{n}-` convention while the
# existing tests only ever exercised `feat/e{n}-` (lowercase, no prefix).
#
# Strategy: drive the REAL stop-verifier.sh in isolated temp repos across every
# epic-branch spelling the team actually uses, with a known-violating state
# (impl=✅ qa=⬜ → Rule 18 MUST block). Any epic branch that returns exit 0 is a
# fail-open and fails this canary. Non-epic branches must NOT fire (exit 0).
#
# Run directly, or via `make guard-selftest`.

set -e
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
STOP_VERIFIER="$REPO_ROOT/scripts/hooks/stop-verifier.sh"
PASS=0
FAIL=0

# run a violating-state fixture (E999 impl=✅ qa=⬜) on $branch, assert $expected exit
canary() {
  local name="$1" branch="$2" expected="$3"
  local tmpdir; tmpdir=$(mktemp -d)
  (
    cd "$tmpdir"
    git init -q; git config user.email t@t.example; git config user.name T
    mkdir -p docs/context
    cat > docs/context/epic-progress.md <<'EOF'
| Epic | Spec | Impl | QA | Commit | Merge | Notes |
|------|------|------|-----|--------|-------|-------|
| E999 | ✅ | ✅ | ⬜ | ⬜ | ⬜ | canary fixture: impl done, qa NOT done |
EOF
    git add .; git commit -q -m init
    [ "$branch" != "main" ] && git checkout -q -b "$branch"
    echo dummy > touched.txt; git add touched.txt   # non-empty CHANGED so verifier runs
  )
  local got; set +e
  (cd "$tmpdir" && bash "$STOP_VERIFIER") >/tmp/canary-out.$$.txt 2>&1
  got=$?; set -e
  if [ "$got" = "$expected" ]; then
    echo "  ✅ $name ($branch → exit $got)"; PASS=$((PASS+1))
  else
    echo "  ❌ FAIL-OPEN $name ($branch → exit $got, expected $expected)"
    FAIL=$((FAIL+1))
  fi
  rm -f /tmp/canary-out.$$.txt; rm -rf "$tmpdir"
}

echo "=== E204 canary: Rule 18 must BLOCK (exit 2) on every epic-branch spelling ==="
# Epic branches with a violating state — ALL must block:
canary "lowercase, no prefix"      "feat/e999-x"          2
canary "capital E, no prefix"      "feat/E999-x"          2
canary "MH/ prefix, capital E"     "MH/feat/E999-x"       2   # the real convention
canary "MH/ prefix, lowercase e"   "MH/feat/e999-x"       2
canary "claude/ prefix, capital E" "claude/feat/E999-x"   2

echo "=== must NOT fire (exit 0) on non-epic branches ==="
canary "main branch"               "main"                 0
canary "chore branch"              "chore/cleanup"        0
canary "feat without epic id"      "feat/no-epic-here"    0

echo ""
echo "Passed: $PASS | Failed: $FAIL"
[ "$FAIL" = "0" ] || { echo "FAIL-OPEN detected — an epic-safety gate is silently disabled."; exit 1; }
