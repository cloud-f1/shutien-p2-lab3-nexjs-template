#!/usr/bin/env bash
# test-archive-context-undated-sections.sh — an undated reference section is
# never an entry and is never archived, in EITHER entry order.
#
# The entry-order fix (test-archive-context-entry-order.sh) taught only the
# newest-first path that undated sections are reference blocks. Oldest-first
# files kept counting every `## ` heading, so review-findings.md's
# "## Severity Levels" legend ranked as entry #1 and was evicted as "oldest"
# on every Stop hook once the file reached its 15-entry limit (observed
# 2026-09-12: the legend landed in docs/context/archive/2026-09.md and the
# live file lost its header — twice, nine minutes apart).
#
# Cases:
#   1. oldest-first: leading undated legend survives archival of real entries.
#   2. oldest-first: undated sections are not counted → at-limit file untouched.
#   3. oldest-first: file preamble (before any heading) stays live.
#   4. newest-first: unchanged (regression guard for the earlier fix).
set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")/../../.." && pwd)/scripts/archive-context.sh"
[[ -f "$SCRIPT" ]] || { echo "FAIL: missing $SCRIPT" >&2; exit 1; }

pass=0; fail=0
ok()  { echo "  ✅ $1"; pass=$((pass + 1)); }
bad() { echo "  ❌ $1"; fail=$((fail + 1)); }

mk_review() { # $1=dir $2=dated-entry-count
  local f="$1/review-findings.md" n="$2" i
  {
    echo "# Review Findings"
    echo "preamble line — must stay live"
    echo
    echo "## Severity Levels"
    echo
    echo "- **RED** — blocks merge."
    echo
    echo "---"
    echo
    for ((i = 1; i <= n; i++)); do
      echo "## Round $i — 2026-0$(( (i % 9) + 1 ))-01T00:00Z — entry $i"
      echo "body of entry $i"
      echo
    done
  } > "$f"
}

run_auto() { ARCHIVE_ROOT="$1" ARCHIVE_AUDIT_LOG="$1/audit.jsonl" bash "$SCRIPT" --auto >/dev/null 2>&1 || true; }

echo "=== archive-context.sh undated sections ==="

# --- case 1 + 3: oldest-first over limit (17 dated, limit 15) -------------
d=$(mktemp -d); mk_review "$d" 17; run_auto "$d"
live="$d/review-findings.md"; arch=$(ls "$d"/archive/*.md 2>/dev/null | head -1 || true)
if grep -q '^## Severity Levels' "$live"; then ok "oldest-first: undated legend stays live"; else bad "oldest-first: undated legend was archived"; fi
if head -1 "$live" | grep -q '^# Review Findings' && grep -q 'preamble line' "$live"; then ok "oldest-first: file preamble stays live"; else bad "oldest-first: preamble was archived"; fi
if ! grep -q 'entry 1$' "$live" && ! grep -q 'entry 2$' "$live"; then ok "oldest-first: the two oldest dated entries left the live file"; else bad "oldest-first: oldest entries not archived"; fi
if grep -q 'entry 17$' "$live"; then ok "oldest-first: newest entry kept live"; else bad "oldest-first: newest entry missing"; fi
if [[ -n "$arch" ]] && grep -q 'entry 1$' "$arch" && ! grep -q 'Severity Levels' "$arch"; then ok "oldest-first: archive holds entries only, no legend"; else bad "oldest-first: archive content wrong ($arch)"; fi
rm -rf "$d"

# --- case 2: oldest-first at limit (15 dated + legend) --------------------
d=$(mktemp -d); mk_review "$d" 15
if ARCHIVE_ROOT="$d" ARCHIVE_AUDIT_LOG="$d/audit.jsonl" bash "$SCRIPT" --check >/dev/null 2>&1; then ok "oldest-first: 15 dated + legend is not over-limit"; else bad "oldest-first: legend counted as an entry"; fi
before=$(md5 -q "$d/review-findings.md" 2>/dev/null || md5sum "$d/review-findings.md" | cut -d' ' -f1)
run_auto "$d"
after=$(md5 -q "$d/review-findings.md" 2>/dev/null || md5sum "$d/review-findings.md" | cut -d' ' -f1)
if [[ "$before" == "$after" ]]; then ok "oldest-first: file untouched at limit"; else bad "oldest-first: file rewritten although not over limit"; fi
rm -rf "$d"

# --- case 4: newest-first still correct ----------------------------------
d=$(mktemp -d); f="$d/session-summary.md"
{ echo "# Session Summary"; for ((i = 1; i <= 7; i++)); do echo "## Session — 2026-09-$(printf '%02d' $((20 - i))) (entry $i)"; echo "body $i"; done; echo "## Stack quick reference"; echo "reference body"; } > "$f"
run_auto "$d"
if head -1 "$f" | grep -q '^# Session Summary' && grep -q 'entry 1)' "$f" && ! grep -q 'entry 7)' "$f" && grep -q 'reference body' "$f"; then ok "newest-first: unchanged"; else bad "newest-first: regressed"; fi
rm -rf "$d"

echo "Passed: $pass | Failed: $fail"
(( fail == 0 ))
