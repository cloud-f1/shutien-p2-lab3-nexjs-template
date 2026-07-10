#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# auto-promote-check.sh — E158 [GENERALIZABLE] auto-trigger
#
# PostToolUse hook. Fires on Edit|Write. Early-exits unless the touched file is
# one of the three watched Tier-1 context logs. Counts `[GENERALIZABLE]` tags
# added since the last-promote watermark (docs/context/.last-promote-ts). When
# the count >= 3, drops a promotion proposal in docs/context/promotion-proposals/
# and writes a JSONL audit event. Never blocks a Claude turn — always exit 0.
#
# Watermark advance (E-batch1 fix): the watermark was never advanced after
# writing a proposal, so every subsequent Edit/Write on a watched file re-scanned
# the SAME full history and spammed a new proposal file. Fix chosen (documented
# per the task's "pick the simpler, document it" instruction): after writing a
# proposal, stamp docs/context/.last-promote-ts with the current epoch seconds —
# the same watermark file the `since` read at the top already uses — so the next
# run's `git log --since=@<epoch>` naturally excludes everything just proposed.
# (The alternative considered — a separate .promote-proposal-pending marker
# checked at entry — was rejected: it only suppresses the *next* run rather than
# resetting the count, so a slow trickle of new [GENERALIZABLE] tags would still
# re-trigger on every single edit once the marker is manually cleared. Advancing
# the existing watermark is the simpler, already-plumbed mechanism.)
#
# Contract:
#   input:   Claude Code passes file path via $CLAUDE_FILE_PATH (or stdin JSON)
#   output:  (stdout silent); side effects = proposal file + audit line
#   threshold: >= 3 new [GENERALIZABLE] entries since watermark
#   watched: docs/context/debug-log.md
#            docs/context/qa-patterns.md
#            docs/context/review-findings.md
#
# Manual smoke test:
#   # 1. Happy path (creates proposal)
#   git checkout -b tmp/smoke-e158
#   printf '\n[GENERALIZABLE] one\n[GENERALIZABLE] two\n[GENERALIZABLE] three\n' \
#     >> docs/context/debug-log.md
#   git add docs/context/debug-log.md && git commit -m 'smoke: add 3 tags'
#   CLAUDE_FILE_PATH="$(pwd)/docs/context/debug-log.md" \
#     bash scripts/hooks/auto-promote-check.sh
#   ls docs/context/promotion-proposals/   # should show a new <ts>.md
#   tail -1 .claude/audit.jsonl            # should contain auto_promote_proposed
#
#   # 2. Silent path (below threshold -> no proposal)
#   echo 0 > docs/context/.last-promote-ts   # reset
#   rm -rf docs/context/promotion-proposals/*.md
#   printf '\n[GENERALIZABLE] only-one\n' >> docs/context/debug-log.md
#   git add docs/context/debug-log.md && git commit -m 'smoke: 1 tag'
#   CLAUDE_FILE_PATH="$(pwd)/docs/context/debug-log.md" \
#     bash scripts/hooks/auto-promote-check.sh
#   ls docs/context/promotion-proposals/   # should be empty of new files
#
#   # 3. Wrong-file path (early exit)
#   CLAUDE_FILE_PATH="$(pwd)/README.md" \
#     bash scripts/hooks/auto-promote-check.sh
#   # no change anywhere
#
#   # Cleanup: git checkout main && git branch -D tmp/smoke-e158
# -----------------------------------------------------------------------------
set -uo pipefail

# Resolve repo root; bail quietly if not in a git checkout
repo_root="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -z "$repo_root" ]] && exit 0
cd "$repo_root" || exit 0

# Input: prefer $CLAUDE_FILE_PATH; fall back to parsing JSON on stdin
target="${CLAUDE_FILE_PATH:-}"
if [[ -z "$target" ]] && [[ ! -t 0 ]]; then
  input=$(cat 2>/dev/null || true)
  if [[ -n "$input" ]] && command -v jq >/dev/null 2>&1; then
    target=$(printf '%s' "$input" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null || true)
  fi
fi

# Only act on the three watched context logs
case "$target" in
  */docs/context/debug-log.md|*/docs/context/qa-patterns.md|*/docs/context/review-findings.md) ;;
  docs/context/debug-log.md|docs/context/qa-patterns.md|docs/context/review-findings.md) ;;
  *) exit 0 ;;
esac

watermark_file="docs/context/.last-promote-ts"
since=0
if [[ -f "$watermark_file" ]]; then
  since=$(tr -d '[:space:]' < "$watermark_file" 2>/dev/null || echo 0)
  [[ "$since" =~ ^[0-9]+$ ]] || since=0
fi

watched=(
  docs/context/debug-log.md
  docs/context/qa-patterns.md
  docs/context/review-findings.md
)

# Count [GENERALIZABLE] lines added (diff lines starting with '+', excluding
# file headers) since watermark.
#   - `since == 0` is the first-ever run: scan the full history (git treats
#     `--since=@0` inconsistently across versions, so omit the flag entirely
#     in that case and let the spec's "first-time run processes all historical
#     tags" behavior hold).
#   - otherwise pass `--since=@<epoch>`.
# `|| true` keeps the pipeline quiet when grep finds zero matches.
if [[ "$since" -gt 0 ]]; then
  count=$(git log --since="@${since}" --pretty=tformat: --patch -- "${watched[@]}" 2>/dev/null \
    | grep -cE '^\+[^+].*\[GENERALIZABLE\]' 2>/dev/null || true)
else
  count=$(git log --pretty=tformat: --patch -- "${watched[@]}" 2>/dev/null \
    | grep -cE '^\+[^+].*\[GENERALIZABLE\]' 2>/dev/null || true)
fi
count=${count:-0}
[[ "$count" =~ ^[0-9]+$ ]] || count=0

if (( count < 3 )); then
  exit 0
fi

# Threshold crossed — draft a proposal
ts=$(date +%Y%m%d-%H%M%S)
proposal_dir="docs/context/promotion-proposals"
proposal="${proposal_dir}/${ts}.md"
mkdir -p "$proposal_dir"

{
  echo "# Promotion Proposal — ${ts}"
  echo
  echo "Auto-generated by \`scripts/hooks/auto-promote-check.sh\` after threshold of ${count} pending \`[GENERALIZABLE]\` lessons."
  echo
  echo "## Next step"
  echo
  echo "\`/athena:promote --apply ${proposal}\`"
  echo
  echo "## Pending lessons"
  echo
} > "$proposal"

for f in "${watched[@]}"; do
  [[ -f "$f" ]] || continue
  grep -Hn '\[GENERALIZABLE\]' "$f" 2>/dev/null >> "$proposal" || true
done

# Telemetry (append a single JSONL line; never fail the hook)
audit_log=".claude/audit.jsonl"
mkdir -p "$(dirname "$audit_log")" 2>/dev/null || true
iso_ts=$(date -u +%FT%TZ 2>/dev/null || date -u '+%Y-%m-%dT%H:%M:%SZ')
printf '{"ts":"%s","event":"auto_promote_proposed","count":%d,"file":"%s"}\n' \
  "$iso_ts" "$count" "$proposal" >> "$audit_log" 2>/dev/null || true

# Advance the watermark so the NEXT run only scans history since this proposal.
# Without this, every subsequent watched-file edit re-scans the full unbounded
# history and spams a new proposal for the same already-proposed tags.
now_epoch=$(date +%s 2>/dev/null || echo "$since")
printf '%s' "$now_epoch" > "$watermark_file" 2>/dev/null || true

exit 0
