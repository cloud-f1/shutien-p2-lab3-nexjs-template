#!/bin/bash
# Webhook — fires when a Task is marked completed.
# Detects target from URL pattern and formats payload accordingly:
#   - hooks.slack.com         → Slack incoming webhook ({text, blocks})
#   - api.telegram.org        → Telegram bot sendMessage (needs TELEGRAM_CHAT_ID)
#   - discord.com/api/webhooks → Discord webhook ({content, embeds})
#   - anything else           → generic flat JSON (n8n / Zapier / Antenna)
#
# NOTIFY_LEVEL controls volume:
#   - silent     → emit nothing
#   - boundaries → only epic-boundary events (default): merge, deploy, failed, blocked, needs_human, start
#   - verbose    → emit on every TaskCompleted
#
# Gracefully skips if AI_CODING_WEBHOOK_URL is not set.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib/audit-common.sh
. "$SCRIPT_DIR/lib/audit-common.sh" 2>/dev/null || true

WEBHOOK_URL="${AI_CODING_WEBHOOK_URL:-}"
if [ -z "$WEBHOOK_URL" ]; then
  exit 0
fi

NOTIFY_LEVEL="${NOTIFY_LEVEL:-boundaries}"
if [ "$NOTIFY_LEVEL" = "silent" ]; then
  exit 0
fi

INPUT=$(cat)

EPIC_ID=$(echo "$INPUT" | jq -r '.epic_id // empty' 2>/dev/null)
STEP=$(echo "$INPUT" | jq -r '.step // empty' 2>/dev/null)
STATUS=$(echo "$INPUT" | jq -r '.status // "completed"' 2>/dev/null)
DURATION=$(echo "$INPUT" | jq -r '.duration_seconds // 0' 2>/dev/null)

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ -z "$EPIC_ID" ]; then
  # Case-insensitive, uppercase-normalized — see scripts/hooks/lib/audit-common.sh.
  # Preserve original semantics: leave EPIC_ID empty (not "none") when the
  # branch has no epic id, so the existing ${EPIC_ID:-unknown} display below
  # still reads "unknown" rather than "none".
  if command -v epic_from_branch >/dev/null 2>&1; then
    EPIC_ID=$(epic_from_branch "$BRANCH")
    [ "$EPIC_ID" = "none" ] && EPIC_ID=""
  else
    EPIC_ID=$(echo "$BRANCH" | sed -n 's/.*\([Ee][0-9]\{1,\}\).*/\1/p' | tr '[:lower:]' '[:upper:]')
  fi
fi

# Boundary filter: only fire for "I need to look now" events.
if [ "$NOTIFY_LEVEL" = "boundaries" ]; then
  case "$STEP|$STATUS" in
    merge\|*|deploy\|*|start\|*) ;;
    *\|failed|*\|blocked|*\|needs_human|*\|merged) ;;
    *) exit 0 ;;
  esac
fi

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EPIC_DISPLAY="${EPIC_ID:-unknown}"
STEP_DISPLAY="${STEP:-unknown}"

# Status emoji for human-readable adapters.
case "$STATUS" in
  completed|merged|success) ICON="✅" ;;
  failed|error)             ICON="❌" ;;
  blocked|needs_human)      ICON="⏸️" ;;
  start|started)            ICON="▶️" ;;
  *)                        ICON="ℹ️" ;;
esac

SUMMARY="${ICON} ${EPIC_DISPLAY} · ${STEP_DISPLAY} · ${STATUS}"
DETAIL="branch: ${BRANCH:-unknown} · ${DURATION}s · ${TIMESTAMP}"

# Build payload by adapter.
case "$WEBHOOK_URL" in
  *hooks.slack.com*)
    PAYLOAD=$(jq -n \
      --arg text "$SUMMARY" \
      --arg detail "$DETAIL" \
      '{text: $text, blocks: [
         {type:"section", text:{type:"mrkdwn", text:("*"+$text+"*")}},
         {type:"context", elements:[{type:"mrkdwn", text:$detail}]}
       ]}')
    CONTENT_TYPE="application/json"
    POST_URL="$WEBHOOK_URL"
    ;;
  *api.telegram.org*)
    if [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
      exit 0
    fi
    PAYLOAD=$(jq -n \
      --arg chat_id "$TELEGRAM_CHAT_ID" \
      --arg text "${SUMMARY}"$'\n'"${DETAIL}" \
      '{chat_id: $chat_id, text: $text, parse_mode: "Markdown"}')
    CONTENT_TYPE="application/json"
    POST_URL="$WEBHOOK_URL"
    ;;
  *discord.com/api/webhooks*)
    PAYLOAD=$(jq -n \
      --arg summary "$SUMMARY" \
      --arg detail "$DETAIL" \
      '{content: $summary, embeds: [{description: $detail}]}')
    CONTENT_TYPE="application/json"
    POST_URL="$WEBHOOK_URL"
    ;;
  *)
    PAYLOAD=$(jq -n \
      --arg event "task_completed" \
      --arg epic_id "$EPIC_DISPLAY" \
      --arg step "$STEP_DISPLAY" \
      --arg status "$STATUS" \
      --argjson duration "${DURATION:-0}" \
      --arg branch "$BRANCH" \
      --arg timestamp "$TIMESTAMP" \
      '{event:$event,epic_id:$epic_id,step:$step,status:$status,duration_seconds:$duration,branch:$branch,timestamp:$timestamp}')
    CONTENT_TYPE="application/json"
    POST_URL="$WEBHOOK_URL"
    ;;
esac

# Test hook: print payload to stdout instead of POSTing.
if [ -n "${NOTIFY_DRY_RUN:-}" ]; then
  echo "$PAYLOAD"
  exit 0
fi

curl -s --max-time 5 -X POST "$POST_URL" \
  -H "Content-Type: $CONTENT_TYPE" \
  -d "$PAYLOAD" \
  >/dev/null 2>&1

exit 0
