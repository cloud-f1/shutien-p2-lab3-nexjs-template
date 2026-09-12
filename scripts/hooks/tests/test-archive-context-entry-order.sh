#!/usr/bin/env bash
# test-archive-context-entry-order.sh — archive-context.sh must respect each
# file's entry order. session-summary.md is NEWEST-FIRST (`## Latest Session`
# on top, undated reference sections at the bottom); the archiver used to treat
# every file as oldest-first and evicted the newest session + the file header
# (observed 2026-09-10 right after E343 wrote the latest entry).
#
# Cases:
#   1. newest-first: 7 dated entries + undated reference section, limit 5 →
#      header + entries 1–5 + reference stay live; entries 6–7 archived.
#   2. newest-first: undated sections are not counted → 5 dated + 1 reference
#      is NOT over limit (--check exits 0, file untouched).
#   3. oldest-first (debug-log.md): behaviour unchanged — first entries archived.
set -euo pipefail

SCRIPT="$(cd "$(dirname "$0")/../../.." && pwd)/scripts/archive-context.sh"
[[ -f "$SCRIPT" ]] || { echo "FAIL: missing $SCRIPT" >&2; exit 1; }

pass=0; fail=0
ok()  { echo "  ✅ $1"; pass=$((pass + 1)); }
bad() { echo "  ❌ $1"; fail=$((fail + 1)); }

mk_newest() { # $1=dir $2=entry-count
  local f="$1/session-summary.md" n="$2" i
  {
    echo "# Session Summary"
    echo "> header line"
    echo
    for ((i = 1; i <= n; i++)); do
      if (( i == 1 )); then echo "## Latest Session — 2026-09-$(printf '%02d' $((20 - i))) (entry $i)"
      else echo "## Session — 2026-09-$(printf '%02d' $((20 - i))) (entry $i)"; fi
      echo "body of entry $i"
      echo
    done
    echo "## Stack quick reference"
    echo "reference body — must stay live"
  } > "$f"
}

run_auto() { # $1=root
  ARCHIVE_ROOT="$1" ARCHIVE_AUDIT_LOG="$1/audit.jsonl" bash "$SCRIPT" --auto >/dev/null 2>&1 || true
}

echo "=== archive-context.sh entry order ==="

# --- case 1: newest-first, over limit -------------------------------------
d=$(mktemp -d); mk_newest "$d" 7; run_auto "$d"
live="$d/session-summary.md"; arch=$(ls "$d"/archive/*.md 2>/dev/null | head -1 || true)
if head -1 "$live" | grep -q '^# Session Summary'; then ok "newest-first: file header kept live"; else bad "newest-first: header was archived"; fi
if grep -q 'entry 1)' "$live" && grep -q 'entry 5)' "$live"; then ok "newest-first: entries 1–5 kept live"; else bad "newest-first: newest entries missing from live file"; fi
if ! grep -q 'entry 6)' "$live" && ! grep -q 'entry 7)' "$live"; then ok "newest-first: entries 6–7 removed from live file"; else bad "newest-first: oldest entries still live"; fi
if [[ -n "$arch" ]] && grep -q 'entry 6)' "$arch" && grep -q 'entry 7)' "$arch" && ! grep -q 'entry 1)' "$arch"; then ok "newest-first: archive holds exactly the oldest entries"; else bad "newest-first: archive content wrong ($arch)"; fi
if grep -q 'Stack quick reference' "$live" && grep -q 'reference body' "$live"; then ok "newest-first: undated reference section stays live"; else bad "newest-first: reference section archived"; fi
rm -rf "$d"

# --- case 2: newest-first, at limit (undated sections don't count) --------
d=$(mktemp -d); mk_newest "$d" 5
if ARCHIVE_ROOT="$d" ARCHIVE_AUDIT_LOG="$d/audit.jsonl" bash "$SCRIPT" --check >/dev/null 2>&1; then ok "newest-first: 5 dated + 1 reference section is not over-limit"; else bad "newest-first: reference section counted as an entry"; fi
before=$(md5 -q "$d/session-summary.md" 2>/dev/null || md5sum "$d/session-summary.md" | cut -d' ' -f1)
run_auto "$d"
after=$(md5 -q "$d/session-summary.md" 2>/dev/null || md5sum "$d/session-summary.md" | cut -d' ' -f1)
if [[ "$before" == "$after" ]]; then ok "newest-first: file untouched at limit"; else bad "newest-first: file rewritten although not over limit"; fi
rm -rf "$d"

# --- case 3: oldest-first unchanged (debug-log.md, limit 20) --------------
d=$(mktemp -d); f="$d/debug-log.md"
{ echo "# Debug Log"; for ((i = 1; i <= 22; i++)); do echo "## 2026-01-$(printf '%02d' $i) entry $i"; echo "body $i"; done; } > "$f"
run_auto "$d"
if ! grep -q 'entry 1$' "$f" && ! grep -q 'entry 2$' "$f" && grep -q 'entry 22$' "$f"; then ok "oldest-first: first entries archived, last kept (unchanged behaviour)"; else bad "oldest-first: behaviour changed"; fi
rm -rf "$d"

echo "Passed: $pass | Failed: $fail"
(( fail == 0 ))
