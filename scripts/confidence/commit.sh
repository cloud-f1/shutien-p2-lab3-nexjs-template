#!/usr/bin/env bash
# scripts/confidence/commit.sh — Confidence scorer for COMMIT step (E164).
# Signals: Conventional Commits format + no obvious secret patterns in diff.
# Env: COMMIT_MSG_FILE, COMMIT_DIFF_FILE, COMMIT_HAS_SECRET (override).
set -uo pipefail
EPIC="${1:-}"
MSG_FILE="${COMMIT_MSG_FILE:-}"; DIFF_FILE="${COMMIT_DIFF_FILE:-}"; HAS_SECRET="${COMMIT_HAS_SECRET:-}"
[[ -z "$MSG_FILE" && -f .git/COMMIT_EDITMSG ]] && MSG_FILE=.git/COMMIT_EDITMSG
msg=""
if [[ -n "$MSG_FILE" && -f "$MSG_FILE" ]]; then msg=$(head -n 1 "$MSG_FILE")
elif command -v git >/dev/null 2>&1; then msg=$(git log -1 --pretty=%s 2>/dev/null || echo ""); fi
conv=0
echo "$msg" | grep -qE '^(feat|fix|refactor|docs|chore|test|build|ci|perf|style|revert)(\([^)]+\))?!?: .+' && conv=1
if [[ -z "$HAS_SECRET" ]]; then
  HAS_SECRET=0; diff_text=""
  if [[ -n "$DIFF_FILE" && -f "$DIFF_FILE" ]]; then diff_text=$(cat "$DIFF_FILE")
  elif command -v git >/dev/null 2>&1; then diff_text=$(git diff --cached 2>/dev/null; git diff 2>/dev/null); fi
  if [[ -n "$diff_text" ]] && echo "$diff_text" | grep -qE '(AKIA[0-9A-Z]{16}|sk_live_[0-9a-zA-Z]{16,}|aws_secret_access_key|-----BEGIN (RSA |EC )?PRIVATE KEY-----|password\s*=\s*["'\''][^"'\'']{6,})'; then
    HAS_SECRET=1
  fi
fi
awk -v c="$conv" -v s="$HAS_SECRET" 'BEGIN{
  if(s+0==1){print "0.00"; exit}
  score=0.50; if(c+0==1) score+=0.45; printf "%.2f\n",score }'
