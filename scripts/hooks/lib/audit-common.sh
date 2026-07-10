#!/bin/bash
# scripts/hooks/lib/audit-common.sh — shared helpers for lifecycle hooks.
#
# Source this file, don't execute it:
#   . "$(dirname "${BASH_SOURCE[0]}")/lib/audit-common.sh"
# (or resolve an absolute path via repo_root first — see callers in
# post-bash-log.sh / subagent-stop-writeback.sh / task-completed.sh /
# session-start.sh for the exact pattern used in this repo).
#
# Every function here targets macOS default bash 3.2 (the harness's actual
# runtime): no associative arrays, no `${var,,}`, array expansion under
# `set -u` guarded with `${arr[@]+"${arr[@]}"}`.
#
# NOTE: stop-verifier.sh and audit-emit-verification.sh already implement
# their own case-insensitive epic matching independently — they are NOT
# migrated to source this file (out of scope for this pass; minimal diffs).

# repo_root — print the git toplevel, falling back to $PWD when not inside a
# git checkout (e.g. a fixture running in a plain temp dir).
repo_root() {
  git rev-parse --show-toplevel 2>/dev/null || pwd
}

# epic_from_branch [branch] — extract an E{n} epic ID from a branch name,
# case-INSENSITIVELY (feat/e191-x, feat/E191-x, MH/feat/e12-x, claude/feat/E12-x
# all match), uppercase-normalized in the output ("E191"). Prints "none" when
# no match is found. If no argument is given, reads the current branch via git.
epic_from_branch() {
  local branch="${1:-}"
  if [ -z "$branch" ]; then
    branch=$(git branch --show-current 2>/dev/null || git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  fi
  local epic
  epic=$(echo "$branch" | sed -n 's/.*\([Ee][0-9]\{1,\}\).*/\1/p' | tr '[:lower:]' '[:upper:]')
  [ -z "$epic" ] && epic="none"
  echo "$epic"
}

# emit_jsonl <log_path> <event_name> [key=value ...] — append one JSONL line
# built via `jq -n` (never printf/string-concat — field values sourced from
# markdown cells or free-form text can carry embedded quotes that would
# otherwise produce invalid JSON). All key=value values are emitted as JSON
# strings. Field names must be shell-safe identifiers; invalid ones are
# silently skipped rather than aborting the whole emit. Best-effort: no-ops
# (never a non-zero exit that could propagate to the caller) when `jq` is
# missing or the log path is unwritable — an audit-log write must never block
# a lifecycle hook.
emit_jsonl() {
  local log_path="$1"; shift
  local event_name="$1"; shift
  command -v jq >/dev/null 2>&1 || return 0
  mkdir -p "$(dirname "$log_path")" 2>/dev/null || true
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

  # Bash 3.2-safe indexed array (no associative arrays available).
  local jq_args=()
  local reduce_parts=""
  local pair key val
  for pair in "$@"; do
    key="${pair%%=*}"
    val="${pair#*=}"
    [ -z "$key" ] && continue
    case "$key" in
      *[!A-Za-z0-9_]*|[0-9]*) continue ;;
    esac
    jq_args+=(--arg "$key" "$val")
    reduce_parts="${reduce_parts} | . + {\"${key}\": \$${key}}"
  done

  # `${jq_args[@]+"${jq_args[@]}"}` guard: on macOS default bash 3.2,
  # expanding an empty array under `set -u` is an unbound-variable error.
  jq -n -c \
    --arg ts "$ts" \
    --arg event "$event_name" \
    ${jq_args[@]+"${jq_args[@]}"} \
    "{ts:\$ts,event:\$event}${reduce_parts}" \
    >> "$log_path" 2>/dev/null || true
}
