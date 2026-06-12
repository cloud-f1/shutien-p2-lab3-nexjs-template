# AI-Coding-Template — Epic Progress Tracker

> **Purpose**: Machine-readable state for the Epic Loop orchestrator
> **Updated by**: Agent after each step completes
> **Read by**: `/athena:loop` or `SessionStart` to determine next action

---

## Phase Status

| Phase | Epics | Status |
|-------|-------|--------|
| Phase 0 | (your first epic) | 🔄 In Progress |

## Epic Step Matrix

<!--
Steps: spec → implement → qa → commit → merge
Status: ⬜ pending | 🔄 in-progress | ✅ done | ⏭️ skip | ❌ failed
Size: S (~1 session) | M (1-2 sessions) | L (2-3 sessions)
-->

| Epic | Name | Size | Spec | Impl | QA | Commit | Merge | Notes |
|------|------|------|------|------|-----|--------|-------|-------|

## Dependency Rules

_(No dependencies yet — add rules as epics grow.)_

## Phase Parallelism

_(Define which epics within a phase can run in parallel.)_

---

**Next Action:** Run `/athena:plan` to propose your first epics.

---

## Epic Naming Convention

```
E{number} — {Short Name}
Branch: MH/feat/E{number}-{slug}
Commit: feat(E{number}): {description}
```

## File Organization

- `docs/epics/EPIC_INDEX.md` — master tracker (state + catalog)
- `docs/epics/e{n}-{slug}.md` — detailed spec per epic (created during `spec` step)
- `docs/context/epic-progress.md` — lightweight state file (IDs + status only, read by loop)
- `docs/roadmap.md` — high-level product vision (NOT execution tracking)
- `docs/context/session-summary.md` — session resume point (references current epic)
