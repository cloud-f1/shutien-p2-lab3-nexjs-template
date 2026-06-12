#!/bin/bash
# E181 — Lesson strength score (decay + reinforcement).
#
# Reads / writes per-lesson YAML frontmatter on Tier 0 files in
# ~/.claude/template-memory/ to maintain a [0,1] "strength" score that:
#   - decays with time according to per-file `half_life_days` (E185)
#   - reinforces on retrieval signals from `.claude/audit.jsonl` (E180)
#
# Subcommands:
#   score.sh get        <file>                  -- print current strength
#   score.sh reinforce  <file> <signal> [sess]  -- apply delta (per-session-deduped),
#                                                  update last_retrieved + count,
#                                                  emit `strength_reinforced` event
#   score.sh decay      <file>                  -- apply decay, write back, emit
#                                                  `strength_decayed` event
#   score.sh decay-all  [dir]                   -- decay all known Tier 0 files
#   score.sh flag-weak  [dir]                   -- print basenames with S < 0.10
#
# Reinforce signals (deltas, per design doc):
#   tier0_loaded   -> +0.05
#   rule_fired     -> +0.10
#   agent_cited    -> +0.15
#
# Per-session dedup: at most one bump per (file, signal) per session. The
# "session id" defaults to the calendar date (UTC), so multiple SessionStart
# injects in the same day count as one. Callers can pass an explicit session
# id (e.g. branch + date) to refine.
#
# Half-life resolution delegates to `scripts/memory/half-life-resolve.sh`
# (E185 single source of truth — DO NOT reimplement).
#
# Hooks call this best-effort: a failing `score.sh` invocation must NEVER
# block the hook. Wrap with `|| true` at the call site.
#
# Env overrides (test injection):
#   AUDIT_LOG_PATH        override .claude/audit.jsonl
#   TEMPLATE_MEMORY_DIR   override default Tier 0 dir
#   STRENGTH_SESSION_ID   override session id for dedup (default: UTC date)
#   STRENGTH_NOW          override current ISO date for decay math (testing)
#   STRENGTH_DEDUP_DIR    override per-session dedup state dir
#   HALF_LIFE_DEFAULTS_JSON  passed through to half-life-resolve.sh

set -e

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
HALF_LIFE_RESOLVE="$REPO_ROOT/scripts/memory/half-life-resolve.sh"
DEFAULTS_JSON="${HALF_LIFE_DEFAULTS_JSON:-$REPO_ROOT/scripts/memory/half-life-defaults.json}"
AUDIT_LOG="${AUDIT_LOG_PATH:-$REPO_ROOT/.claude/audit.jsonl}"
TIER0_DIR_DEFAULT="${TEMPLATE_MEMORY_DIR:-$HOME/.claude/template-memory}"
DEDUP_DIR="${STRENGTH_DEDUP_DIR:-${TMPDIR:-/tmp}/e181-strength-dedup}"

# Reinforcement deltas (per E181 design table).
delta_for_signal() {
  case "$1" in
    tier0_loaded) echo "0.05" ;;
    rule_fired)   echo "0.10" ;;
    agent_cited)  echo "0.15" ;;
    *)            echo "" ;;
  esac
}

usage() {
  sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//' >&2
  exit 2
}

# ---- frontmatter helpers ---------------------------------------------------

# Read a key from the leading YAML frontmatter block. Echoes value, or empty.
fm_get() {
  local file="$1" key="$2"
  awk -v key="$key" '
    BEGIN { in_fm = 0; fm_count = 0 }
    /^---[[:space:]]*$/ {
      fm_count++
      if (fm_count == 1) { in_fm = 1; next }
      if (fm_count == 2) { exit }
      next
    }
    in_fm {
      pat = "^" key ":[[:space:]]+"
      if ($0 ~ pat) {
        sub(pat, "", $0)
        sub(/[[:space:]]+#.*$/, "", $0)
        sub(/[[:space:]]+$/, "", $0)
        print $0
        exit
      }
    }
  ' "$file"
}

# Set / replace a key inside the leading frontmatter block. If the key is not
# present, it is inserted before the closing `---`. If the file has no
# frontmatter at all, a fresh block is prepended (with `tier: 0`).
fm_set() {
  local file="$1" key="$2" value="$3"
  local first_line
  first_line=$(head -n 1 "$file" 2>/dev/null || echo "")
  local tmp; tmp=$(mktemp)
  if [ "$first_line" = "---" ]; then
    awk -v key="$key" -v value="$value" '
      BEGIN { in_fm = 0; fm_count = 0; replaced = 0 }
      /^---[[:space:]]*$/ {
        fm_count++
        if (fm_count == 1) { in_fm = 1; print; next }
        if (fm_count == 2) {
          if (!replaced) { print key ": " value; replaced = 1 }
          in_fm = 0
          print
          next
        }
        print
        next
      }
      in_fm {
        pat = "^" key ":[[:space:]]"
        if ($0 ~ pat) {
          if (!replaced) { print key ": " value; replaced = 1 }
          next
        }
        print
        next
      }
      { print }
    ' "$file" > "$tmp"
  else
    {
      echo "---"
      echo "$key: $value"
      echo "tier: 0"
      echo "---"
      cat "$file"
    } > "$tmp"
  fi
  mv "$tmp" "$file"
}

# Today as ISO date (UTC). Override-able for tests.
today_iso() {
  if [ -n "${STRENGTH_NOW:-}" ]; then
    echo "$STRENGTH_NOW"
  else
    date -u +"%Y-%m-%d"
  fi
}

today_ts_iso() {
  date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# Days between two ISO dates (YYYY-MM-DD). Portable across GNU + BSD date.
days_between() {
  local from="$1" to="$2"
  local from_epoch to_epoch
  from_epoch=$(date -u -d "$from" +%s 2>/dev/null)
  if [ -z "$from_epoch" ]; then
    from_epoch=$(date -u -j -f "%Y-%m-%d" "$from" +%s 2>/dev/null)
  fi
  to_epoch=$(date -u -d "$to" +%s 2>/dev/null)
  if [ -z "$to_epoch" ]; then
    to_epoch=$(date -u -j -f "%Y-%m-%d" "$to" +%s 2>/dev/null)
  fi
  [ -z "$from_epoch" ] || [ -z "$to_epoch" ] && { echo "0"; return; }
  local diff=$(( (to_epoch - from_epoch) / 86400 ))
  [ "$diff" -lt 0 ] && diff=0
  echo "$diff"
}

# Clamp a float to [0, 1] using awk.
clamp() {
  awk -v v="$1" 'BEGIN {
    if (v < 0) v = 0
    if (v > 1) v = 1
    printf "%.4f\n", v
  }'
}

# Resolve current strength for a file. Default 0.5 if missing.
get_strength() {
  local file="$1"
  local s; s=$(fm_get "$file" strength)
  if [ -z "$s" ]; then
    echo "0.5000"
    return
  fi
  # Validate it's numeric, else default.
  if echo "$s" | awk 'BEGIN { ok = 1 } { if ($0 !~ /^-?[0-9]+(\.[0-9]+)?$/) ok = 0 } END { exit (ok ? 0 : 1) }'; then
    clamp "$s"
  else
    echo "0.5000"
  fi
}

# Resolve last_retrieved date. Default = today.
get_last_retrieved() {
  local file="$1"
  local d; d=$(fm_get "$file" last_retrieved)
  if [ -z "$d" ]; then
    today_iso
    return
  fi
  echo "$d"
}

# Resolve last_decayed date. Falls back to last_retrieved if absent.
get_last_decayed() {
  local file="$1"
  local d; d=$(fm_get "$file" last_decayed)
  if [ -n "$d" ]; then
    echo "$d"
    return
  fi
  # Fall back to last_retrieved as the decay anchor
  get_last_retrieved "$file"
}

# ---- ALLOW_TIER0_WRITE isolation guard -------------------------------------
# If the target file lives inside the real Tier 0 directory
# (~/.claude/template-memory/) AND ALLOW_TIER0_WRITE is not "1", abort.
# This prevents test fixtures from accidentally writing to production Tier 0.
# Set ALLOW_TIER0_WRITE=1 to explicitly permit writes (manual runs, CI
# with real Tier 0 dir, /athena:save, etc.).
check_write_guard() {
  local file="$1"
  [ "${ALLOW_TIER0_WRITE:-}" = "1" ] && return 0
  local real_tier0; real_tier0=$(cd "$HOME/.claude/template-memory" 2>/dev/null && pwd || echo "")
  [ -z "$real_tier0" ] && return 0  # Tier 0 doesn't exist; no guard needed
  local file_dir; file_dir=$(cd "$(dirname "$file")" 2>/dev/null && pwd || echo "")
  if [ "$file_dir" = "$real_tier0" ]; then
    echo "error: writing to real Tier 0 ($real_tier0) is blocked without ALLOW_TIER0_WRITE=1" >&2
    echo "  Set ALLOW_TIER0_WRITE=1 to allow writes (e.g. manual /athena:save runs)." >&2
    echo "  Test fixtures must use a temp TIER0_DIR via TEMPLATE_MEMORY_DIR." >&2
    exit 1
  fi
}

# Resolve retrieval_count. Default 0.
get_retrieval_count() {
  local file="$1"
  local c; c=$(fm_get "$file" retrieval_count)
  if [ -z "$c" ]; then echo "0"; return; fi
  if [ "$c" -eq "$c" ] 2>/dev/null; then echo "$c"; else echo "0"; fi
}

# ---- audit emit ------------------------------------------------------------

emit_event() {
  # $1 = event name, $2 = lesson basename, $3 = strength (string),
  # $4 = signal (optional, only for reinforced)
  local event="$1" lesson="$2" strength="$3" signal="${4:-}"
  command -v jq >/dev/null 2>&1 || return 0
  mkdir -p "$(dirname "$AUDIT_LOG")" 2>/dev/null
  local ts; ts=$(today_ts_iso)
  local epic
  epic=$(git -C "$REPO_ROOT" branch --show-current 2>/dev/null \
    | sed -n 's/.*\(E[0-9]\{1,\}\).*/\1/Ip' \
    | tr '[:lower:]' '[:upper:]')
  [ -z "$epic" ] && epic="none"
  if [ -n "$signal" ]; then
    jq -n -c \
      --arg ts "$ts" \
      --arg event "$event" \
      --arg lesson "$lesson" \
      --arg signal "$signal" \
      --arg epic "$epic" \
      --argjson strength "$strength" \
      '{ts:$ts,event:$event,lesson:$lesson,signal:$signal,strength:$strength,epic:$epic}' \
      >> "$AUDIT_LOG" 2>/dev/null || true
  else
    jq -n -c \
      --arg ts "$ts" \
      --arg event "$event" \
      --arg lesson "$lesson" \
      --arg epic "$epic" \
      --argjson strength "$strength" \
      '{ts:$ts,event:$event,lesson:$lesson,strength:$strength,epic:$epic}' \
      >> "$AUDIT_LOG" 2>/dev/null || true
  fi
}

# ---- subcommands -----------------------------------------------------------

cmd_get() {
  local file="$1"
  [ -z "$file" ] && usage
  [ -f "$file" ] || { echo "error: not a file: $file" >&2; exit 1; }
  get_strength "$file"
}

# Per-session dedup gate. Returns 0 if the (file, signal) bump has NOT yet
# happened this session (so caller should apply it AND mark it). Returns 1
# if it's already been applied (caller should skip).
should_apply_signal() {
  local file="$1" signal="$2"
  local sess="${STRENGTH_SESSION_ID:-$(today_iso)}"
  mkdir -p "$DEDUP_DIR" 2>/dev/null
  local key
  key=$(printf '%s\n' "$sess|$(basename "$file")|$signal" | shasum 2>/dev/null | awk '{print $1}')
  [ -z "$key" ] && key=$(printf '%s\n' "$sess|$(basename "$file")|$signal" | tr -c 'a-zA-Z0-9' '_')
  local marker="$DEDUP_DIR/$key"
  if [ -e "$marker" ]; then
    return 1
  fi
  : > "$marker"
  return 0
}

cmd_reinforce() {
  local file="$1" signal="$2"
  [ -z "$file" ] || [ -z "$signal" ] && usage
  [ -f "$file" ] || { echo "error: not a file: $file" >&2; exit 1; }
  check_write_guard "$file"

  local delta; delta=$(delta_for_signal "$signal")
  if [ -z "$delta" ]; then
    echo "error: unknown signal: $signal (expected tier0_loaded|rule_fired|agent_cited)" >&2
    exit 1
  fi

  if ! should_apply_signal "$file" "$signal"; then
    # Already bumped this session — print current strength but don't write.
    get_strength "$file"
    return 0
  fi

  local cur; cur=$(get_strength "$file")
  local new; new=$(awk -v c="$cur" -v d="$delta" 'BEGIN { printf "%.4f\n", c + d }')
  new=$(clamp "$new")

  local count; count=$(get_retrieval_count "$file")
  local new_count=$((count + 1))
  local today; today=$(today_iso)

  fm_set "$file" strength "$new"
  fm_set "$file" last_retrieved "$today"
  fm_set "$file" retrieval_count "$new_count"

  emit_event "strength_reinforced" "$(basename "$file")" "$new" "$signal"
  echo "$new"
}

cmd_decay() {
  local file="$1"
  [ -z "$file" ] && usage
  [ -f "$file" ] || { echo "error: not a file: $file" >&2; exit 1; }
  check_write_guard "$file"

  local cur; cur=$(get_strength "$file")
  # Prefer last_decayed as decay anchor; fall back to last_retrieved.
  # This makes repeated same-day calls idempotent: after the first call
  # writes last_decayed=today, subsequent calls see days_elapsed=0 and
  # S * 0.5^0 = S (no further decay).
  local last; last=$(get_last_decayed "$file")
  local now; now=$(today_iso)
  local hl
  hl=$("$HALF_LIFE_RESOLVE" "$file" 2>/dev/null || echo 180)
  [ -z "$hl" ] && hl=180

  local days; days=$(days_between "$last" "$now")
  # S = S * 0.5 ^ (days_since_last_decayed / half_life_days)
  local new
  new=$(awk -v s="$cur" -v d="$days" -v h="$hl" 'BEGIN {
    if (h <= 0) h = 180
    printf "%.4f\n", s * (0.5 ^ (d / h))
  }')
  new=$(clamp "$new")

  fm_set "$file" strength "$new"
  # Write back last_decayed so the next decay call anchors to today,
  # making decay idempotent within a single calendar day.
  fm_set "$file" last_decayed "$now"
  emit_event "strength_decayed" "$(basename "$file")" "$new"
  echo "$new"
}

cmd_decay_all() {
  local dir="${1:-$TIER0_DIR_DEFAULT}"
  [ -d "$dir" ] || { echo "error: not a directory: $dir" >&2; exit 1; }
  command -v jq >/dev/null 2>&1 || { echo "error: jq required" >&2; exit 1; }
  [ -f "$DEFAULTS_JSON" ] || { echo "error: defaults JSON missing: $DEFAULTS_JSON" >&2; exit 1; }

  # Guard: decay-all on the real Tier 0 directory requires ALLOW_TIER0_WRITE=1.
  [ "${ALLOW_TIER0_WRITE:-}" = "1" ] || {
    local real_tier0; real_tier0=$(cd "$HOME/.claude/template-memory" 2>/dev/null && pwd || echo "")
    local check_dir; check_dir=$(cd "$dir" 2>/dev/null && pwd || echo "")
    if [ -n "$real_tier0" ] && [ "$check_dir" = "$real_tier0" ]; then
      echo "error: writing to real Tier 0 ($real_tier0) is blocked without ALLOW_TIER0_WRITE=1" >&2
      echo "  Set ALLOW_TIER0_WRITE=1 to allow writes (e.g. manual /athena:save runs)." >&2
      exit 1
    fi
  }

  local count=0
  for name in $(jq -r '.defaults | keys[]' "$DEFAULTS_JSON"); do
    local path="$dir/$name"
    [ -f "$path" ] || continue
    cmd_decay "$path" >/dev/null
    count=$((count + 1))
  done
  echo "decayed $count file(s)"
}

cmd_flag_weak() {
  local dir="${1:-$TIER0_DIR_DEFAULT}"
  [ -d "$dir" ] || { echo "error: not a directory: $dir" >&2; exit 1; }
  command -v jq >/dev/null 2>&1 || { echo "error: jq required" >&2; exit 1; }
  [ -f "$DEFAULTS_JSON" ] || { echo "error: defaults JSON missing: $DEFAULTS_JSON" >&2; exit 1; }

  for name in $(jq -r '.defaults | keys[]' "$DEFAULTS_JSON"); do
    local path="$dir/$name"
    [ -f "$path" ] || continue
    local s; s=$(get_strength "$path")
    # Print "<basename>\t<score>" if s < 0.10.
    awk -v n="$name" -v s="$s" 'BEGIN { if (s < 0.10) printf "%s\t%.4f\n", n, s }'
  done
}

# ---- dispatch --------------------------------------------------------------

CMD="${1:-}"
shift || true
case "$CMD" in
  get)        cmd_get "$@" ;;
  reinforce)  cmd_reinforce "$@" ;;
  decay)      cmd_decay "$@" ;;
  decay-all)  cmd_decay_all "$@" ;;
  flag-weak)  cmd_flag_weak "$@" ;;
  -h|--help)  usage ;;
  *)          usage ;;
esac
