#!/usr/bin/env bash
# Fixture-driven unit tests for task-completed.sh.
#
# Uses NOTIFY_DRY_RUN=1 to capture the formatted payload on stdout instead of
# POSTing. Asserts shape per adapter (Slack / Telegram / Discord / generic) and
# the NOTIFY_LEVEL boundary filter.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOK="$SCRIPT_DIR/../task-completed.sh"

if [ ! -x "$HOOK" ]; then
  echo "FAIL: hook not executable at $HOOK" >&2
  exit 1
fi

PASS=0
FAIL=0
FIRST_FAIL=""

pass() { echo "PASS: $1"; PASS=$((PASS + 1)); }
fail() {
  echo "FAIL: $1"
  echo "  $2"
  FAIL=$((FAIL + 1))
  [ -z "$FIRST_FAIL" ] && FIRST_FAIL="$1: $2"
}

# Run hook with given env + stdin JSON, capture stdout.
# Args: 1=url 2=level 3=stdin_json [4=extra env, e.g. "TELEGRAM_CHAT_ID=42"]
run_hook() {
  local url="$1" level="$2" stdin="$3" extra="${4:-}"
  env -i PATH="$PATH" \
    AI_CODING_WEBHOOK_URL="$url" \
    NOTIFY_LEVEL="$level" \
    NOTIFY_DRY_RUN=1 \
    $extra \
    bash "$HOOK" <<<"$stdin" 2>/dev/null
}

# --- silent level: emits nothing ---
out=$(run_hook "https://hooks.slack.com/services/AAA/BBB" "silent" '{"step":"merge","status":"completed"}')
if [ -z "$out" ]; then
  pass "silent level emits nothing"
else
  fail "silent level emits nothing" "got: $out"
fi

# --- unset URL: emits nothing ---
out=$(run_hook "" "verbose" '{"step":"merge","status":"completed"}')
if [ -z "$out" ]; then
  pass "unset URL emits nothing"
else
  fail "unset URL emits nothing" "got: $out"
fi

# --- boundaries level: filters mid-pipeline events ---
out=$(run_hook "https://hooks.slack.com/x" "boundaries" '{"step":"implement","status":"completed"}')
if [ -z "$out" ]; then
  pass "boundaries filters implement/completed"
else
  fail "boundaries filters implement/completed" "got: $out"
fi

# --- boundaries level: passes merge ---
out=$(run_hook "https://hooks.slack.com/x" "boundaries" '{"step":"merge","status":"completed","epic_id":"E999"}')
if echo "$out" | jq -e '.text | contains("E999")' >/dev/null 2>&1; then
  pass "boundaries passes merge step"
else
  fail "boundaries passes merge step" "got: $out"
fi

# --- boundaries level: passes any-step + failed status ---
out=$(run_hook "https://hooks.slack.com/x" "boundaries" '{"step":"qa","status":"failed","epic_id":"E42"}')
if echo "$out" | jq -e '.text | contains("failed")' >/dev/null 2>&1; then
  pass "boundaries passes failed status"
else
  fail "boundaries passes failed status" "got: $out"
fi

# --- boundaries level: passes blocked ---
out=$(run_hook "https://hooks.slack.com/x" "boundaries" '{"step":"deploy","status":"blocked"}')
if [ -n "$out" ]; then
  pass "boundaries passes blocked status"
else
  fail "boundaries passes blocked status" "got empty"
fi

# --- verbose level: passes everything ---
out=$(run_hook "https://hooks.slack.com/x" "verbose" '{"step":"implement","status":"completed","epic_id":"E1"}')
if echo "$out" | jq -e '.text | contains("E1")' >/dev/null 2>&1; then
  pass "verbose passes implement/completed"
else
  fail "verbose passes implement/completed" "got: $out"
fi

# --- Slack adapter: shape ---
out=$(run_hook "https://hooks.slack.com/services/T/B/X" "verbose" '{"step":"merge","status":"completed","epic_id":"E5"}')
if echo "$out" | jq -e '.blocks[0].type == "section" and .blocks[1].type == "context"' >/dev/null 2>&1; then
  pass "Slack adapter has section + context blocks"
else
  fail "Slack adapter has section + context blocks" "got: $out"
fi

# --- Telegram adapter: requires TELEGRAM_CHAT_ID, otherwise skip ---
out=$(run_hook "https://api.telegram.org/bot123/sendMessage" "verbose" '{"step":"merge","status":"completed"}')
if [ -z "$out" ]; then
  pass "Telegram skips when TELEGRAM_CHAT_ID unset"
else
  fail "Telegram skips when TELEGRAM_CHAT_ID unset" "got: $out"
fi

# --- Telegram adapter: emits sendMessage shape with chat_id ---
out=$(run_hook "https://api.telegram.org/bot123/sendMessage" "verbose" '{"step":"merge","status":"completed","epic_id":"E7"}' "TELEGRAM_CHAT_ID=12345")
if echo "$out" | jq -e '.chat_id == "12345" and .parse_mode == "Markdown"' >/dev/null 2>&1; then
  pass "Telegram adapter has chat_id + Markdown parse_mode"
else
  fail "Telegram adapter has chat_id + Markdown parse_mode" "got: $out"
fi

# --- Discord adapter: shape ---
out=$(run_hook "https://discord.com/api/webhooks/123/abc" "verbose" '{"step":"merge","status":"completed","epic_id":"E8"}')
if echo "$out" | jq -e '.content and (.embeds | length) > 0' >/dev/null 2>&1; then
  pass "Discord adapter has content + embeds"
else
  fail "Discord adapter has content + embeds" "got: $out"
fi

# --- Generic adapter: legacy flat JSON ---
out=$(run_hook "https://example.com/hook" "verbose" '{"step":"merge","status":"completed","epic_id":"E9","duration_seconds":42}')
if echo "$out" | jq -e '.event == "task_completed" and .epic_id == "E9" and .duration_seconds == 42' >/dev/null 2>&1; then
  pass "Generic adapter preserves legacy flat JSON"
else
  fail "Generic adapter preserves legacy flat JSON" "got: $out"
fi

echo
echo "Results: $PASS passed, $FAIL failed"
if [ "$FAIL" -gt 0 ]; then
  echo "First failure: $FIRST_FAIL"
  exit 1
fi
exit 0
