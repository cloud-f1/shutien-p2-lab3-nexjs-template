# E95 — README Count & Reference Accuracy Sweep

> **Phase 27** | Priority: P2 | Points: 5 | Size: S
> **Depends on**: E92

---

## Problem Statement

Multiple markdown files across the project reference stale agent, command, skill, and hook counts. README says "16 個 Athena 指令" but actual is 17. `custom-agents.md` says "7 general-purpose agents" but actual is 8. CLAUDE.md system-reminder injection may reference outdated counts. These mismatches erode trust — users see "it says 7 but I count 9."

## Stories

### S1: Grep & Fix Agent Count References

**AC:**
- [ ] Search all `.md` files for stale agent count references (7, 8 where should be 9)
- [ ] Fix `README.md` agent count in both ZH and EN sections
- [ ] Fix `CLAUDE.md` agent count in system-reminder / header
- [ ] Fix `docs/guides/en/custom-agents.md` "7 general-purpose agents" → 8
- [ ] Fix `docs/guides/zh-TW/custom-agents.md` mirror
- [ ] Fix any other files found in sweep

### S2: Grep & Fix Command Count References

**AC:**
- [ ] Search all `.md` files for stale command count references (14, 15, 16 where should be 17)
- [ ] Fix `README.md` "16 個 Athena 指令" → 17
- [ ] Fix `CLAUDE.md` command count if referenced
- [ ] Fix any other files found in sweep

### S3: Grep & Fix Skill & Hook Count References

**AC:**
- [ ] Search all `.md` files for stale skill count references (7 where should be 8)
- [ ] Fix any skill count references found
- [ ] Verify hook count references are accurate (no change expected)

### S4: Bilingual Consistency Check

**AC:**
- [ ] Verify ZH-TW and EN sections of README have matching counts
- [ ] Verify ZH-TW and EN guides have consistent numbers
- [ ] Spot-check that doc navigation tables reference correct feature names

## Risk Notes

- Low risk — search-and-replace across markdown files only
- Depends on E92 being complete so reference docs have correct canonical counts
- Must be thorough — missing one file means drift persists

## Files to Touch

```
README.md                                  — update: fix agent/command/skill counts
CLAUDE.md                                  — update: fix agent/command counts
docs/guides/en/custom-agents.md            — update: fix agent count
docs/guides/zh-TW/custom-agents.md         — update: fix agent count (ZH)
docs/guides/en/ai-agent-team.md            — update: fix counts if stale
docs/guides/zh-TW/ai-agent-team.md         — update: fix counts if stale (ZH)
(any other .md files found in grep sweep)
```
