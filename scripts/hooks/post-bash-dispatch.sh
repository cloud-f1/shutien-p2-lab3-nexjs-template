#!/bin/bash
# PostToolUse(Bash) dispatcher — consolidates 4 separate hook processes
# (post-bash-log.sh, pr-created.sh, post-bash-failure-inject.sh,
# post-commit-bugfix-log.sh) into ONE stdin read + ONE jq parse, then
# dispatches to each sub-hook via cheap string prefilters instead of
# re-parsing the same JSON 4 times.
#
# Each sub-hook is invoked UNCHANGED (`bash <hook>` fed the same stdin via
# printf) so they stay standalone-runnable and their existing fixture tests
# keep passing. This script never blocks: every dispatch is `|| true` and
# the script always exits 0 — a crashing sub-hook must never break the
# PostToolUse pipeline. Sub-hook stdout is forwarded as-is (it becomes
# additionalContext).
#
# See scripts/hooks/CLAUDE.md "Dispatcher" section for the prefilter table.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

INPUT=$(cat)

CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
EXIT_CODE=$(echo "$INPUT" | jq -r '.tool_result.exit_code // "unknown"' 2>/dev/null)

# Sanitize to the same -1 "missing result" sentinel post-bash-log.sh uses —
# tool_result is often absent on this platform, and a non-numeric value
# would otherwise make the exit-code comparison below misbehave.
case "$EXIT_CODE" in
  ''|*[!0-9-]*) EXIT_CODE=-1 ;;
esac

# 1. Always — every bash command gets audit-logged.
printf '%s' "$INPUT" | bash "$SCRIPT_DIR/post-bash-log.sh" || true

# 2. `gh pr create` → auto-label / assign reviewer / epic comment.
case "$CMD" in
  *"gh pr create"*)
    printf '%s' "$INPUT" | bash "$SCRIPT_DIR/pr-created.sh" || true
    ;;
esac

# 3. `git commit` → bugfix-log append (the sub-hook itself further filters
#    on the resulting HEAD commit message starting with fix:/fix().
case "$CMD" in
  *"git commit"*)
    printf '%s' "$INPUT" | bash "$SCRIPT_DIR/post-commit-bugfix-log.sh" || true
    ;;
esac

# 4. Non-zero exit (excluding the missing-result -1 sentinel — we don't know
#    if a command with no tool_result actually failed, so don't guess).
if [ "$EXIT_CODE" != "0" ] && [ "$EXIT_CODE" != "-1" ]; then
  printf '%s' "$INPUT" | bash "$SCRIPT_DIR/post-bash-failure-inject.sh" || true
fi

exit 0
