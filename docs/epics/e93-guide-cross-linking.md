# E93 — Guide Cross-Linking & Learning Path Index

> **Phase 27** | Priority: P1 | Points: 8 | Size: M
> **Depends on**: none

---

## Problem Statement

Only `quickstart.md` has a "Next Steps" section. The remaining 6 guides end without pointing the reader anywhere next. There is no index page listing all guides with descriptions or a recommended reading order. A beginner who finishes one guide has no clear path to the next. The progression from basic to advanced (quickstart → first-epic → ai-agent-team → custom-agents → openapi-patterns → ci-explained) is not documented anywhere.

## Stories

### S1: Add "Next Steps" to All EN Guides

**AC:**
- [ ] Add "Next Steps" or "Related Guides" section to `first-epic.md`
- [ ] Add "Next Steps" or "Related Guides" section to `ai-agent-team.md`
- [ ] Add "Next Steps" or "Related Guides" section to `without-claude-code.md`
- [ ] Add "Next Steps" or "Related Guides" section to `ci-explained.md`
- [ ] Add "Next Steps" or "Related Guides" section to `custom-agents.md`
- [ ] Add "Next Steps" or "Related Guides" section to `openapi-patterns.md`
- [ ] Each section links to 2-3 logically related guides

### S2: Add "Next Steps" to All ZH-TW Guides

**AC:**
- [ ] Mirror all EN "Next Steps" sections into corresponding ZH-TW guides
- [ ] Use Traditional Chinese for section headers and link descriptions
- [ ] Verify link paths are correct for ZH-TW directory structure

### S3: Create Learning Path Index — EN

**AC:**
- [ ] Create `docs/guides/en/learning-path.md`
- [ ] List all guides in recommended reading order: beginner → intermediate → advanced
- [ ] Add brief description for each guide (1-2 sentences)
- [ ] Include difficulty indicators (beginner / intermediate / advanced)
- [ ] Add estimated reading time per guide

### S4: Create Learning Path Index — ZH-TW

**AC:**
- [ ] Create `docs/guides/zh-TW/learning-path.md`
- [ ] Mirror EN learning path content in Traditional Chinese
- [ ] Verify all link paths point to ZH-TW versions

### S5: Link Learning Path from README

**AC:**
- [ ] Add learning path link to README documentation table (both ZH and EN sections)
- [ ] Use appropriate labels (e.g., "Learning Path" / "學習路徑")

## Risk Notes

- Low risk — adding links and index files, no existing content modified
- Must maintain bilingual consistency between EN and ZH-TW

## Files to Touch

```
docs/guides/en/first-epic.md              — update: add Next Steps
docs/guides/en/ai-agent-team.md           — update: add Next Steps
docs/guides/en/without-claude-code.md     — update: add Next Steps
docs/guides/en/ci-explained.md            — update: add Next Steps
docs/guides/en/custom-agents.md           — update: add Next Steps
docs/guides/en/openapi-patterns.md        — update: add Next Steps
docs/guides/zh-TW/first-epic.md           — update: add Next Steps (ZH)
docs/guides/zh-TW/ai-agent-team.md        — update: add Next Steps (ZH)
docs/guides/zh-TW/without-claude-code.md  — update: add Next Steps (ZH)
docs/guides/zh-TW/ci-explained.md         — update: add Next Steps (ZH)
docs/guides/zh-TW/custom-agents.md        — update: add Next Steps (ZH)
docs/guides/zh-TW/openapi-patterns.md     — update: add Next Steps (ZH)
docs/guides/en/learning-path.md           — new: learning path index (EN)
docs/guides/zh-TW/learning-path.md        — new: learning path index (ZH)
README.md                                 — update: add learning path links
```
