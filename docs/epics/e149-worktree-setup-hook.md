# E149 — Worktree Setup Hook

> Phase 38 — Cross-Project Extraction | Size: S (2 SP) | Deps: none
> Source: ai-casino-shift `worktree-setup.sh`

## Problem

When `/athena:batch` spawns parallel agents in git worktrees, each worktree starts without `.env` files or `docs/context/` state. Agents fail on missing env vars or start with stale context, causing wasted cycles and incorrect decisions.

## Solution

Add a `WorktreeCreate` hook that copies `.env` files (root, server, client) and `docs/context/*.md` into every new worktree. Each parallel agent starts with the same environment and context as the main tree.

## Key Files

| File | Action |
|------|--------|
| `scripts/hooks/worktree-setup.sh` | New — hook script (~20 lines) |
| `.claude/settings.json` | Update — register WorktreeCreate hook |
| `scripts/hooks/CLAUDE.md` | Update — document new hook |
| `docs/epics/e149-worktree-setup-hook.md` | New — this spec |

## Acceptance Criteria

1. Copies `.env`, `server/.env`, `client/.env` if they exist in source root
2. Copies all `docs/context/*.md` into worktree's `docs/context/`
3. Creates `docs/context/` directory in worktree if missing
4. Silent on missing source files (no errors if `.env` doesn't exist)
5. Exit 0 always — never blocks worktree creation
6. Reads `worktree_path` from hook input JSON

## Design Notes

- Essential companion to E85 (`/athena:batch`) — without this, parallel agents lose context
- Proven in ai-casino-shift where 4 concurrent worktree agents run routinely
- Lightweight (~20 lines), no dependencies beyond `jq` and `cp`
