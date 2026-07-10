---
description: "(memory) Checkpoint all agents simultaneously → write context docs → commit for session resume."
allowed-tools: Read, Write, Bash, Agent
---
# Checkpoint All Context

## Step 1 — Spawn parallel write-backs
Use the Agent tool to launch simultaneously:

  Agent A: @qa              "Update your document -> docs/context/review-log.md
                             AND docs/context/test-status.md"
  Agent B: @best-practice   "Update your document -> docs/context/decisions.md"

If @strategist was active this session, also spawn:
  Agent F: @strategist     "Update your document -> docs/context/strategy-log.md"

If these agents were active this session, also spawn:
  Agent C: @spec-writer     "Update your document -> docs/context/spec-log.md"
  Agent D: @debugger        "Update your document -> docs/context/debug-log.md"
  Agent E: @deployer        "Update your document -> docs/context/deploy-log.md"

An agent not active this session has nothing to check-point — skip its doc silently
(do not spawn it, do not report it as missing/failed).

## Step 2 — Write session-summary.md

Create docs/context/session-summary.md:
---
## Session Summary — [ISO timestamp]
Branch: [branch] | Commit: [git log --oneline -1]

### Done This Session
- [specific past-tense bullet]

### Current State
[what is true right now]

### Next Actions (ordered)
1. [most important next step]
2. [second step]

### Open Questions
- [anything blocking progress]
---

## Step 3 — Update project state docs
- `CLAUDE.md` "## Active Epic" / "Current State" sections: refresh active phase status,
  last session line, next action.
- `docs/context/session-summary.md`: ensure it reflects the latest state (already
  written in Step 2 — this is a consistency check, not a second write).

## Step 4 — Commit
git add docs/context/ CLAUDE.md
git commit -m "docs: checkpoint — $(date +%Y-%m-%d)"

## Post-save check (E160)

After the commit, run the context-log size check:

```bash
bash scripts/archive-context.sh --check
```

If the script exits non-zero, surface this nudge to the user:

> ℹ️  Context logs exceeding size limits. Run `bash scripts/archive-context.sh`
> to archive old entries (interactive) or let the next `Stop` hook do it
> automatically. See `docs/context/CLAUDE.md` "Auto-compact policy" for the
> per-file limit table.

Do NOT auto-archive from `/athena:save` — the `Stop` hook owns that
behaviour. The check is informational only and never blocks the save.

## Post-save lesson decay (E181)

Amortize Tier 0 strength decay across all known lessons. Best-effort —
failure here must NEVER block the save. Skips silently if the script or
template-memory dir is missing (e.g. fork without Tier 0 set up).

```bash
[ -x scripts/memory/score.sh ] && bash scripts/memory/score.sh decay-all 2>/dev/null || true
```

This consumes E180 retrieval events accumulated since the last save and
applies the per-file `half_life_days` rate constant. Rationale: amortizing
nightly cost on `/athena:save` avoids needing a separate cron. Typical
runtime is sub-second on the 8-file Tier 0 set.

Next session: upload TECHSTACK.md OR let SessionStart hook auto-load session-summary.md
