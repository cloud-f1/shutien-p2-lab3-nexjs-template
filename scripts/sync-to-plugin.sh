#!/usr/bin/env bash
# sync-to-plugin.sh — One-way sync: template → athena-core
#
# Usage:
#   bash scripts/sync-to-plugin.sh                   # dry-run (default)
#   bash scripts/sync-to-plugin.sh --apply           # actually sync files
#   bash scripts/sync-to-plugin.sh --athena-core-path /custom/path
#   bash scripts/sync-to-plugin.sh --apply --athena-core-path /custom/path
#
# Exit codes:
#   0  — dry-run: no diff (tree is clean); apply: sync succeeded
#   1  — dry-run: diff detected (divergence found); apply: sync failed
#   2  — fatal error (missing source or target)

set -euo pipefail

# ─── Defaults ─────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ATHENA_CORE_PATH="${TEMPLATE_ROOT}/../athena-core"
MODE="dry-run"
AUDIT_LOG="${TEMPLATE_ROOT}/.claude/audit.jsonl"

# ─── Argument Parsing ─────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --apply)
      MODE="apply"
      shift
      ;;
    --athena-core-path)
      ATHENA_CORE_PATH="$2"
      shift 2
      ;;
    --athena-core-path=*)
      ATHENA_CORE_PATH="${1#*=}"
      shift
      ;;
    *)
      echo "Unknown flag: $1" >&2
      echo "Usage: $0 [--apply] [--athena-core-path <path>]" >&2
      exit 2
      ;;
  esac
done

# Resolve to absolute path
ATHENA_CORE_PATH="$(cd "$ATHENA_CORE_PATH" 2>/dev/null && pwd)" || {
  echo "ERROR: athena-core target not found at: $ATHENA_CORE_PATH" >&2
  echo "  Pass --athena-core-path <path> to override the default location." >&2
  exit 2
}

# ─── Sync Manifest ────────────────────────────────────────────────────────────
# Each entry: "source_relative:target_relative"
declare -a SYNC_PAIRS=(
  ".claude/agents/:agents/"
  ".claude/commands/athena/:commands/athena/"
  ".claude/skills/:skills/"
  "scripts/hooks/:hooks/"
  "scripts/memory/:scripts/memory/"
)

# ─── Per-Pair Excludes ────────────────────────────────────────────────────────
# Files that are OWNED by athena-core (E203 hardening) and must not be
# overwritten by the one-way template→core sync.
#
# scripts/hooks/ → hooks/ excludes:
#   stop-verifier.sh — athena-core has a modular version at scripts/hooks/
#     stop-verifier.sh that delegates to scripts/stop-rules/; the template's
#     monolithic 497-line version must not land in athena-core/hooks/.
#   Template-specific hook scripts that encode Next.js/Drizzle/Auth.js-stack
#     rules (e.g. stop-verifier's RBAC-guard and DataTable checks) — those
#     belong in a profile pack, not the universal core.
#   CLAUDE.md, tests/ — template-internal docs and tests.
#
# scripts/memory/ → scripts/memory/ excludes:
#   lesson-tags.json — athena-core's version (E203) is sanitized to
#     reference ~/.claude/athena-memory/ and remove template-specific
#     framework domains (server/, client/, etc.).  Never overwrite.
#
# Compatible with bash 3.x (macOS default) — no associative arrays.
get_pair_excludes() {
  # $1 = sync pair string (e.g. "scripts/hooks/:hooks/")
  case "$1" in
    "scripts/hooks/:hooks/")
      # Exclude ALL hook scripts from the hooks sync.
      # Rationale: athena-core's hook scripts live in scripts/hooks/ (NOT hooks/)
      # and are purposely different — they source scripts/lib/common.sh and use
      # $ATHENA_MEMORY_DIR / $PROJECT_AUDIT_LOG instead of template hardcoded paths.
      # The template's scripts/hooks/ contains template-specific rules (Next.js/
      # Drizzle/Auth.js-stack invariants — see stop-verifier.sh's Rule table in
      # scripts/hooks/CLAUDE.md) that belong in a profile pack, not the universal
      # core. The only file in athena-core/hooks/ is hooks.json (athena-core-owned).
      # E203 hardening: stop-verifier.sh (scripts/hooks/), registry-read block, and
      # check-version-sync.sh are all outside this sync target and are preserved.
      echo "--exclude=*.sh --exclude=*.json --exclude=CLAUDE.md --exclude=tests/"
      ;;
    "scripts/memory/:scripts/memory/")
      # The following scripts are E203-owned in athena-core: they source
      # scripts/lib/common.sh and use $ATHENA_MEMORY_DIR / $PROJECT_AUDIT_LOG
      # instead of template hardcoded paths (template-memory/, .claude/audit.jsonl).
      # Never overwrite them from the template.
      #   score.sh         — uses common.sh + ATHENA_MEMORY_DIR (E181/E203)
      #   inject.sh        — uses common.sh + ATHENA_MEMORY_DIR (E182/E203)
      #   match.sh         — uses common.sh + ATHENA_MEMORY_DIR (E182/E203)
      #   half-life-resolve.sh — uses common.sh path resolution (E185/E203)
      # lesson-tags.json is also E203-sanitized: uses ~/.claude/athena-memory/
      # and strips template framework domains (server/, client/, etc.).
      echo "--exclude=lesson-tags.json --exclude=score.sh --exclude=inject.sh --exclude=match.sh --exclude=half-life-resolve.sh"
      ;;
    *)
      echo ""
      ;;
  esac
}

# ─── Helpers ──────────────────────────────────────────────────────────────────
ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

# Empty reference dir — used to measure how many files in a source pair
# SURVIVE that pair's excludes (i.e. would ever be eligible to sync), as
# opposed to how many currently DIFFER from the target. A pair can show
# zero diff for two very different reasons: (a) genuinely nothing to sync
# right now but files DO flow through when they change, or (b) the excludes
# swallow 100% of the source tree by policy (E203) and NOTHING ever syncs
# through this pair, no matter what changes. Only (b) should print
# "[SKIP by policy]" instead of the (a) "[OK]".
EMPTY_REF_DIR="$(mktemp -d)"
trap 'rm -rf "$EMPTY_REF_DIR"' EXIT

# effective_file_count <src> <pair_excl_arr...>
# Counts files in <src> that would survive the given excludes, by rsync
# dry-running against a guaranteed-empty target (so every non-excluded file
# is reported as "new", regardless of the real target's current contents).
effective_file_count() {
  local src="$1"
  shift
  local out
  out=$(rsync -rlc --dry-run --out-format="%n" \
    --exclude="*.pyc" --exclude="__pycache__" \
    "$@" \
    "$src" "$EMPTY_REF_DIR" 2>/dev/null) || true
  # Exclude directory entries (trailing "/") — rsync lists a directory as
  # "new" even when every file inside it is excluded, so counting dir
  # entries would understate how excluded a pair really is.
  local n
  n=$(echo "$out" | grep -v '/$' | grep -c '[^[:space:]]' 2>/dev/null || true)
  echo $(( ${n:-0} + 0 ))
}

emit_audit() {
  local mode="$1"
  local files_changed="$2"
  local target="$3"
  if [[ -f "$AUDIT_LOG" ]] || [[ -d "$(dirname "$AUDIT_LOG")" ]]; then
    printf '{"ts":"%s","event":"athena_sync","mode":"%s","files_changed":%s,"target":"%s"}\n' \
      "$(ts)" "$mode" "$files_changed" "$target" \
      >> "$AUDIT_LOG" 2>/dev/null || true
  fi
}

# ─── Dry-Run Mode ─────────────────────────────────────────────────────────────
if [[ "$MODE" == "dry-run" ]]; then
  echo "=== athena-core drift check (dry-run) ==="
  echo "  Template:    $TEMPLATE_ROOT"
  echo "  athena-core: $ATHENA_CORE_PATH"
  echo ""

  TOTAL_DIFF=0

  for pair in "${SYNC_PAIRS[@]}"; do
    src="${TEMPLATE_ROOT}/${pair%%:*}"
    dst="${ATHENA_CORE_PATH}/${pair##*:}"

    if [[ ! -d "$src" ]]; then
      echo "  [WARN] Source missing, skipping: $src"
      continue
    fi

    # A pair's excludes (E203 hardening) can swallow 100% of the source tree
    # — if so, this pair can never sync anything, and neither [NEW] nor [OK]
    # accurately describes that (both imply "syncing is active here, just
    # nothing to do right now"). Detect and label it distinctly.
    pair_excl_str="$(get_pair_excludes "$pair")"
    read -ra pair_excl_arr <<< "$pair_excl_str"
    effective_count=$(effective_file_count "$src" ${pair_excl_arr[@]+"${pair_excl_arr[@]}"})

    if [ "$effective_count" -eq 0 ]; then
      echo "  [SKIP by policy] ${pair%%:*} → ${pair##*:} (all source files excluded — see get_pair_excludes in this script)"
      continue
    fi

    if [[ ! -d "$dst" ]]; then
      echo "  [NEW]  Target directory does not exist: $dst"
      # Count source files as diff
      count=$(find "$src" -type f | wc -l | tr -d ' ')
      TOTAL_DIFF=$((TOTAL_DIFF + count))
      echo "         $count file(s) would be created."
      continue
    fi

    # rsync dry-run to detect changes (apply per-pair excludes)
    diff_output=$(rsync -rlc --dry-run --out-format="%n" \
      --exclude="*.pyc" --exclude="__pycache__" \
      ${pair_excl_arr[@]+"${pair_excl_arr[@]}"} \
      "$src" "$dst" 2>/dev/null) || true

    file_count=$(echo "$diff_output" | grep -c '[^[:space:]]' 2>/dev/null || true)
    file_count=$(( ${file_count:-0} + 0 ))

    if [ "$file_count" -gt 0 ]; then
      echo "  [DIFF] ${pair%%:*} → ${pair##*:}"
      echo "$diff_output" | sed 's/^/         /'
      TOTAL_DIFF=$((TOTAL_DIFF + file_count))
    else
      echo "  [OK]   ${pair%%:*} → ${pair##*:}"
    fi
  done

  echo ""
  emit_audit "dry-run" "$TOTAL_DIFF" "$ATHENA_CORE_PATH"

  if [[ "$TOTAL_DIFF" -gt 0 ]]; then
    echo "=== Drift detected: $TOTAL_DIFF file(s) differ ==="
    echo "  Run with --apply to sync changes to athena-core."
    exit 1
  else
    echo "=== Clean: no drift detected ==="
    exit 0
  fi
fi

# ─── Apply Mode ───────────────────────────────────────────────────────────────
echo "=== athena-core sync (apply mode) ==="
echo "  Template:    $TEMPLATE_ROOT"
echo "  athena-core: $ATHENA_CORE_PATH"
echo ""

TOTAL_SYNCED=0

for pair in "${SYNC_PAIRS[@]}"; do
  src="${TEMPLATE_ROOT}/${pair%%:*}"
  dst="${ATHENA_CORE_PATH}/${pair##*:}"

  if [[ ! -d "$src" ]]; then
    echo "  [WARN] Source missing, skipping: $src"
    continue
  fi

  # Ensure destination parent exists
  mkdir -p "$(dirname "$dst")"

  # rsync with checksum-based comparison (apply per-pair excludes)
  pair_excl_str="$(get_pair_excludes "$pair")"
  read -ra pair_excl_arr <<< "$pair_excl_str"
  synced=$(rsync -rlc --out-format="%n" \
    --exclude="*.pyc" --exclude="__pycache__" \
    ${pair_excl_arr[@]+"${pair_excl_arr[@]}"} \
    "$src" "$dst" 2>/dev/null) || {
    echo "  [ERROR] rsync failed for $src → $dst" >&2
    emit_audit "apply" "$TOTAL_SYNCED" "$ATHENA_CORE_PATH"
    exit 1
  }

  file_count=$(echo "$synced" | grep -c '[^[:space:]]' 2>/dev/null || true)
  file_count=$(( ${file_count:-0} + 0 ))
  TOTAL_SYNCED=$((TOTAL_SYNCED + file_count))

  if [ "$file_count" -gt 0 ]; then
    echo "  [SYNC] ${pair%%:*} → ${pair##*:} ($file_count file(s))"
    echo "$synced" | sed 's/^/         /'
  else
    echo "  [SKIP] ${pair%%:*} → ${pair##*:} (already up to date)"
  fi
done

echo ""
emit_audit "apply" "$TOTAL_SYNCED" "$ATHENA_CORE_PATH"

echo "=== Sync complete: $TOTAL_SYNCED file(s) updated ==="
echo ""
echo "Next steps:"
echo "  1. cd $ATHENA_CORE_PATH"
echo "  2. Review changes: git diff"
echo "  3. Create a commit: git add -A && git commit -m 'chore: sync from template $(ts)'"
echo "  4. Open a PR in athena-core"
exit 0
