# E148 — Bugfix Audit Trail Hook

> Phase 38 — Cross-Project Extraction | Size: S (2 SP) | Deps: none
> Source: ai-casino-shift `post-commit-bugfix-log.sh`

## Problem

When `fix:` commits land, there's no automatic record of what was fixed, which files changed, or what the root cause was. Bug history is scattered across git log and ephemeral conversation context. Post-mortems require manual git archaeology.

## Solution

Add a `PostToolUse(Bash)` hook that fires after `git commit` commands. When the latest commit message starts with `fix:` or `fix(`, auto-append a stub entry to `docs/context/bugfix-log.md` with timestamp, hash, message, and files. Root cause analysis is deferred to `/athena:save` enrichment.

## Key Files

| File | Action |
|------|--------|
| `scripts/hooks/post-commit-bugfix-log.sh` | New — hook script (~50 lines) |
| `docs/context/bugfix-log.md` | New — auto-created by hook on first fix commit |
| `.claude/settings.json` | Update — register PostToolUse(Bash) hook |
| `scripts/hooks/CLAUDE.md` | Update — document new hook |
| `docs/epics/e148-bugfix-audit-hook.md` | New — this spec |

## Acceptance Criteria

1. Hook only fires when bash command contains `git commit` AND latest commit starts with `fix:`
2. Appends structured stub: timestamp, hash, message, files changed
3. Root cause and test fields default to `_(pending)_` for later enrichment
4. Auto-creates `docs/context/bugfix-log.md` with header if file doesn't exist
5. Hook is idempotent — re-running doesn't duplicate entries (check hash)
6. Registered in `.claude/settings.json` as PostToolUse matcher on Bash
7. `/athena:save` enrichment documented (not implemented here)

## Design Notes

- Proven in ai-casino-shift (22+ entries over 4 days of active development)
- Stub-now-enrich-later pattern keeps the hook fast (<1s) and non-blocking
- Format compatible with `jq` parsing for future `/athena:dashboard` integration
