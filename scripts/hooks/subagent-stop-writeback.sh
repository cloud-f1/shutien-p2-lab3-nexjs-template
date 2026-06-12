#!/bin/bash
# Stamps agent doc + session-summary.md on every SubagentStop.
# Also appends an `agent_complete` event to .claude/audit.jsonl (E146).
# Compatible with macOS bash 3.2 (no associative arrays).
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")" || exit 0

INPUT=$(cat); AGENT=$(echo "$INPUT" | jq -r '.agent_name // empty' 2>/dev/null)
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
mkdir -p docs/context

case "$AGENT" in
  spec-writer)    DOC=docs/context/spec-log.md ;;
  qa)             DOC=docs/context/review-log.md ;;
  best-practice)  DOC=docs/context/decisions.md ;;
  debugger)       DOC=docs/context/debug-log.md ;;
  deployer)       DOC=docs/context/deploy-log.md ;;
  *)              DOC="" ;;
esac

[ -n "$DOC" ] && echo "<!-- $AGENT stopped at $TS -->" >> "$DOC"
echo "<!-- last activity: $AGENT at $TS -->" >> docs/context/session-summary.md

# ---- E146: emit agent_complete event to .claude/audit.jsonl ----
# Skip if agent is unknown/empty — we have nothing useful to record.
if [ -z "$AGENT" ]; then
  exit 0
fi

AUDIT_LOG="${AUDIT_LOG_PATH:-.claude/audit.jsonl}"
BLOCK_FLAG="${STOP_VERIFIER_BLOCK_FLAG:-.claude/.stop-verifier-blocked}"
mkdir -p "$(dirname "$AUDIT_LOG")"

# Epic ID from branch name (matches feat/E82-slug or E82).
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
EPIC=$(echo "$BRANCH" | sed -n 's/.*\(E[0-9]\{1,\}\).*/\1/p')
[ -z "$EPIC" ] && EPIC="none"

# Walk the audit log to find the most recent `agent_complete` row for this
# agent. Everything newer than that row represents the current run's activity
# window and is used to compute duration + retries.
START_TS=""
RETRIES=0
if [ -f "$AUDIT_LOG" ] && [ -s "$AUDIT_LOG" ]; then
  # Most recent agent_complete line for this agent (if any).
  LAST_COMPLETE_LINE=$(
    jq -c --arg a "$AGENT" 'select(.event == "agent_complete" and .agent == $a)' "$AUDIT_LOG" 2>/dev/null \
      | tail -n 1
  )
  if [ -n "$LAST_COMPLETE_LINE" ]; then
    LAST_COMPLETE_TS=$(echo "$LAST_COMPLETE_LINE" | jq -r '.ts // empty' 2>/dev/null)
  else
    LAST_COMPLETE_TS=""
  fi

  # Earliest bash entry for this agent in the current window (since last complete).
  if [ -n "$LAST_COMPLETE_TS" ]; then
    START_TS=$(
      jq -r --arg a "$AGENT" --arg cutoff "$LAST_COMPLETE_TS" \
        'select(.event == "bash" and .agent == $a and .ts > $cutoff) | .ts' \
        "$AUDIT_LOG" 2>/dev/null | head -n 1
    )
    RETRIES=$(
      jq -r --arg a "$AGENT" --arg cutoff "$LAST_COMPLETE_TS" \
        'select(.event == "bash" and .agent == $a and .ts > $cutoff and .exit != 0) | .exit' \
        "$AUDIT_LOG" 2>/dev/null | wc -l | tr -d ' '
    )
  else
    START_TS=$(
      jq -r --arg a "$AGENT" \
        'select(.event == "bash" and .agent == $a) | .ts' \
        "$AUDIT_LOG" 2>/dev/null | head -n 1
    )
    RETRIES=$(
      jq -r --arg a "$AGENT" \
        'select(.event == "bash" and .agent == $a and .exit != 0) | .exit' \
        "$AUDIT_LOG" 2>/dev/null | wc -l | tr -d ' '
    )
  fi
fi
[ -z "$RETRIES" ] && RETRIES=0

# Compute duration_s (seconds) from START_TS to TS. Portable across GNU/BSD date.
DURATION_S=0
if [ -n "$START_TS" ]; then
  # Try GNU first, then BSD.
  START_EPOCH=$(date -u -d "$START_TS" +%s 2>/dev/null)
  if [ -z "$START_EPOCH" ]; then
    START_EPOCH=$(date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$START_TS" +%s 2>/dev/null)
  fi
  END_EPOCH=$(date -u -d "$TS" +%s 2>/dev/null)
  if [ -z "$END_EPOCH" ]; then
    END_EPOCH=$(date -u -j -f "%Y-%m-%dT%H:%M:%SZ" "$TS" +%s 2>/dev/null)
  fi
  if [ -n "$START_EPOCH" ] && [ -n "$END_EPOCH" ]; then
    DURATION_S=$((END_EPOCH - START_EPOCH))
    [ "$DURATION_S" -lt 0 ] && DURATION_S=0
  fi
fi

# Status precedence: failure (stop-verifier blocked) > partial (retries > 0) > success.
STATUS="success"
if [ -f "$BLOCK_FLAG" ]; then
  # Only treat the flag as belonging to this run if it's newer than START_TS.
  if [ -z "$START_TS" ]; then
    STATUS="failure"
  else
    FLAG_EPOCH=$(date -u -r "$BLOCK_FLAG" +%s 2>/dev/null)
    if [ -n "$FLAG_EPOCH" ] && [ -n "$START_EPOCH" ] && [ "$FLAG_EPOCH" -ge "$START_EPOCH" ]; then
      STATUS="failure"
    fi
  fi
  # Consume the flag so it doesn't leak into the next agent.
  rm -f "$BLOCK_FLAG" 2>/dev/null
fi
if [ "$STATUS" != "failure" ] && [ "$RETRIES" -gt 0 ]; then
  STATUS="partial"
fi

jq -n -c \
  --arg ts "$TS" \
  --arg event "agent_complete" \
  --arg agent "$AGENT" \
  --arg epic "$EPIC" \
  --arg status "$STATUS" \
  --argjson duration_s "$DURATION_S" \
  --argjson retries "$RETRIES" \
  '{ts:$ts,event:$event,agent:$agent,epic:$epic,status:$status,duration_s:$duration_s,retries:$retries}' \
  >> "$AUDIT_LOG"

# ---- E180: emit agent_cited event for every Tier 0 lesson reference ----
# Scan the agent's write-back doc for `template-memory/<slug>.md` patterns
# and emit one `agent_cited` event per unique lesson basename. Best-effort —
# if the doc doesn't exist, we have no work to do.
if [ -n "$DOC" ] && [ -f "$DOC" ]; then
  # grep -oE pulls every `template-memory/<file>.md` occurrence; we then
  # strip the prefix and uniq to one event per lesson.
  CITED_LESSONS=$(grep -oE 'template-memory/[A-Za-z0-9_./-]+\.md' "$DOC" 2>/dev/null \
    | sed 's|^template-memory/||' \
    | awk -F/ '{print $NF}' \
    | sort -u)
  if [ -n "$CITED_LESSONS" ]; then
    SCORE_SH="$(git rev-parse --show-toplevel 2>/dev/null)/scripts/memory/score.sh"
    TIER0_DIR="${TEMPLATE_MEMORY_DIR:-$HOME/.claude/template-memory}"
    while IFS= read -r LESSON; do
      [ -z "$LESSON" ] && continue
      jq -n -c \
        --arg ts "$TS" \
        --arg event "agent_cited" \
        --arg agent "$AGENT" \
        --arg lesson "$LESSON" \
        --arg epic "$EPIC" \
        '{ts:$ts,event:$event,agent:$agent,lesson:$lesson,epic:$epic}' \
        >> "$AUDIT_LOG" 2>/dev/null || true

      # E181: chain strength reinforcement for each cited lesson. Best-effort —
      # failure here must NEVER block the SubagentStop hook. Skip silently if
      # the lesson file isn't present in Tier 0 (cited slug doesn't match a
      # real file basename).
      if [ -x "$SCORE_SH" ] && [ -f "$TIER0_DIR/$LESSON" ]; then
        AUDIT_LOG_PATH="$AUDIT_LOG" \
          "$SCORE_SH" reinforce "$TIER0_DIR/$LESSON" agent_cited >/dev/null 2>&1 || true
      fi
    done <<< "$CITED_LESSONS"
  fi
fi

exit 0
