# E94 — DEVELOPER_DOCS Phase 25–26 Refresh

> **Phase 27** | Priority: P1 | Points: 8 | Size: M
> **Depends on**: none

---

## Problem Statement

`dev-docs/public/DEVELOPER_DOCS.md` was partially updated for Phase 25 but has no Phase 26 content. The `@reviewer` agent, `/athena:dashboard` command, debugger auto-retry, PR automation hooks, and post-wave integration test gate are not mentioned. The agent count says 8 but actual is 9. The version summary (section 13) does not include Phase 25 or 26 entries. ZH-TW speaking users relying on DEVELOPER_DOCS get stale information.

## Stories

### S1: Update Agent & Command Sections (Sections 10-11)

**AC:**
- [ ] Update agent count from 8 to 9 in all relevant sections
- [ ] Add `@reviewer` agent description — split from @qa, dedicated code review
- [ ] Add `@orchestrator` agent if not already present — parallel pipeline orchestration
- [ ] Add `/athena:batch` command description — parallel epic execution with auto mode
- [ ] Add `/athena:dba` command description — database migration assistant
- [ ] Add `/athena:dashboard` command description — pipeline progress visualization

### S2: Add Phase 26 Features (Sections 11-12)

**AC:**
- [ ] Document debugger auto-retry with failure pattern matching
- [ ] Document PR automation hooks (labels, assignment, status comments)
- [ ] Document post-wave integration test gate concept
- [ ] Update pipeline flow descriptions to reflect new automation

### S3: Update Version Summary (Section 13)

**AC:**
- [ ] Add Phase 25 version summary entry (parallel pipeline, webhook, audit log)
- [ ] Add Phase 26 version summary entry (reviewer, dashboard, PR hooks, debugger)
- [ ] Update overall version number if applicable
- [ ] Verify all section counts match reality

## Risk Notes

- Low risk — content update to existing documentation
- DEVELOPER_DOCS is ZH-TW only — all additions must be in Traditional Chinese
- Benefits from E92 being done first for consistent counts, but not a hard dependency

## Files to Touch

```
dev-docs/public/DEVELOPER_DOCS.md     — update: sections 10-13, add Phase 25-26 content
```
