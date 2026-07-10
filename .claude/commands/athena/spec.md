---
description: "(epic) Design a feature spec → @spec-writer → docs/epics/ (Drizzle schema + Zod + action/route signatures + RBAC)"
allowed-tools: Read, Write, Bash, Agent
---
Invoke @spec-writer with: $ARGUMENTS

**Spec output location convention:** epic specs → `docs/epics/e{n}-<slug>.md` (e.g. `docs/epics/e123-api-keys.md`); non-epic feature specs → `docs/specs/<slug>.md`.

After completion: agent writes to docs/context/spec-log.md
