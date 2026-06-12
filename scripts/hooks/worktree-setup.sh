#!/bin/bash
# Setup a new git worktree with the correct environment and docs.
# Copies .env and docs/context/ into the worktree so each track has its own state.
INPUT=$(cat)
WORKTREE_PATH=$(echo "$INPUT" | jq -r '.worktree_path // empty' 2>/dev/null)
SOURCE_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)

if [ -n "$WORKTREE_PATH" ] && [ -n "$SOURCE_ROOT" ]; then
  # Copy environment files
  [ -f "$SOURCE_ROOT/.env" ] && cp "$SOURCE_ROOT/.env" "$WORKTREE_PATH/.env" 2>/dev/null
  [ -f "$SOURCE_ROOT/server/.env" ] && cp "$SOURCE_ROOT/server/.env" "$WORKTREE_PATH/server/.env" 2>/dev/null
  [ -f "$SOURCE_ROOT/client/.env" ] && cp "$SOURCE_ROOT/client/.env" "$WORKTREE_PATH/client/.env" 2>/dev/null

  # Copy context docs so each worktree starts with current state
  if [ -d "$SOURCE_ROOT/docs/context" ]; then
    mkdir -p "$WORKTREE_PATH/docs/context"
    cp "$SOURCE_ROOT/docs/context/"*.md "$WORKTREE_PATH/docs/context/" 2>/dev/null
  fi
fi
echo "Worktree ready: ${WORKTREE_PATH:-unknown}"
exit 0
