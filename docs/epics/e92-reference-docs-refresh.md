# E92 — Reference Docs Refresh — Agents, Commands, Skills

> **Phase 27** | Priority: P0 | Points: 5 | Size: S
> **Depends on**: none

---

## Problem Statement

Reference documentation (`docs/reference/agents.md`, `commands.md`, `skills.md`) is stale. Agent count says 7 but actual is 9 (`@reviewer` and `@orchestrator` missing). Command count says 14 but actual is 17 (`/athena:batch`, `/athena:dba`, `/athena:dashboard` missing). Skill count says 7 but actual is 8 (`dba-migrations` missing). Beginners reading these docs get an incomplete picture and miss the project's most powerful features.

## Stories

### S1: Update `agents.md` — 7 → 9 Agents

**AC:**
- [ ] Add `@reviewer` agent entry with role, trigger, and output description
- [ ] Add `@orchestrator` agent entry with role, trigger, and output description
- [ ] Update total agent count from 7 to 9 (8 real + 1 domain-expert template)
- [ ] Update collaboration flow diagram to include reviewer and orchestrator roles
- [ ] Verify all existing agent descriptions are still accurate

### S2: Update `commands.md` — 14 → 17 Commands

**AC:**
- [ ] Add `/athena:batch` command entry with description, usage, and examples
- [ ] Add `/athena:dba` command entry with description, usage, and examples
- [ ] Add `/athena:dashboard` command entry with description, usage, and examples
- [ ] Update total command count from 14 to 17
- [ ] Update pipeline diagram to mention parallel mode (`/athena:batch`)

### S3: Update `skills.md` — 7 → 8 Skills

**AC:**
- [ ] Add `dba-migrations` skill entry with trigger conditions and behavior
- [ ] Update total skill count from 7 to 8
- [ ] Verify all existing skill descriptions are still accurate

## Risk Notes

- Low risk — pure documentation updates, no code changes
- Must be done before E95 (count sweep depends on accurate reference docs)

## Files to Touch

```
docs/reference/agents.md              — update: add @reviewer, @orchestrator, fix count
docs/reference/commands.md            — update: add batch, dba, dashboard, fix count
docs/reference/skills.md              — update: add dba-migrations, fix count
```
