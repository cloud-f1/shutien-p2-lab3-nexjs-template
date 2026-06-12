---
description: "(memory) Load project context → read context docs → summarize state. Use at session start or after long gaps."
allowed-tools: Read, Bash
---
Read sequentially:
  1. CLAUDE.md (project identity)
  2. docs/epics/EPIC_INDEX.md (epic progress — single source of truth)
  3. docs/context/session-summary.md (where we left off)
  4. docs/context/decisions.md (architecture decisions)
  5. docs/context/spec-log.md, test-status.md, deploy-log.md (current state)
  6. ~/.claude/template-memory/NEW_PROJECT_PRIMER.md (cross-project wisdom)

Then summarize: current phase, active epic, last completed step, next action, blockers.
