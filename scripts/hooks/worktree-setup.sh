#!/bin/bash
# Setup a new git worktree with the correct environment and docs.
# Copies .env files and docs/context/ into the worktree so each track has its own state.
#
# NOTE: this hook is NOT auto-wired — there is no WorktreeCreate entry in
# .claude/settings.json. It must be invoked explicitly by batch worktree setup:
#   bash scripts/hooks/worktree-setup.sh <worktree-path>
# (Historically named for a WorktreeCreate lifecycle event that does not exist
# in this harness; kept as a manually-called setup script instead.)
INPUT=$(cat 2>/dev/null)
WORKTREE_PATH=$(echo "$INPUT" | jq -r '.worktree_path // empty' 2>/dev/null)
# Also accept the worktree path as $1 for direct/manual invocation.
[ -z "$WORKTREE_PATH" ] && WORKTREE_PATH="${1:-}"
SOURCE_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)

if [ -n "$WORKTREE_PATH" ] && [ -n "$SOURCE_ROOT" ]; then
  # Copy environment files — single Next.js app under next-app/ (no server/client split)
  [ -f "$SOURCE_ROOT/.env" ] && cp "$SOURCE_ROOT/.env" "$WORKTREE_PATH/.env" 2>/dev/null
  [ -f "$SOURCE_ROOT/next-app/.env" ] && cp "$SOURCE_ROOT/next-app/.env" "$WORKTREE_PATH/next-app/.env" 2>/dev/null
  [ -f "$SOURCE_ROOT/next-app/.env.local" ] && cp "$SOURCE_ROOT/next-app/.env.local" "$WORKTREE_PATH/next-app/.env.local" 2>/dev/null

  # Copy context docs so each worktree starts with current state
  if [ -d "$SOURCE_ROOT/docs/context" ]; then
    mkdir -p "$WORKTREE_PATH/docs/context"
    cp "$SOURCE_ROOT/docs/context/"*.md "$WORKTREE_PATH/docs/context/" 2>/dev/null
  fi
fi
echo "Worktree ready: ${WORKTREE_PATH:-unknown}"
exit 0
