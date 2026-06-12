# E43 — Bilingual Developer Docs (EN/ZH)

> **Size**: M (13 SP) | **Priority**: P1 | **Phase**: 16
> **Dependencies**: none

---

## Problem Statement

All developer guides (quickstart, first-epic-walkthrough, openapi-patterns, custom-agents, CONTRIBUTING) are Chinese-only. This blocks 70%+ of the global developer community from using the template. The app has i18n (E37) but the developer docs do not.

## Stories

### S1: Bilingual Directory Structure
**Acceptance Criteria**:
- [ ] `docs/guides/en/` contains English versions of all guides
- [ ] `docs/guides/zh-TW/` contains existing Chinese guides (moved from `docs/guides/`)
- [ ] `docs/guides/README.md` serves as index with language links
- [ ] All internal cross-references updated to new paths

### S2: English Guide Translations
**Acceptance Criteria**:
- [ ] `quickstart.md` — full English translation
- [ ] `first-epic-walkthrough.md` — full English translation
- [ ] `openapi-patterns.md` — full English translation
- [ ] `custom-agents.md` — full English translation
- [ ] Technical terms kept consistent (e.g., "epic", "domain", "spec")

### S3: CONTRIBUTING.md Bilingual
**Acceptance Criteria**:
- [ ] `CONTRIBUTING.md` at root has both EN and ZH sections
- [ ] Or: `CONTRIBUTING.md` (EN) + `CONTRIBUTING.zh-TW.md` (ZH)
- [ ] GitHub automatically shows CONTRIBUTING to new contributors

### S4: Dev-Docs App Language Support
**Acceptance Criteria**:
- [ ] `DEVELOPER_DOCS.md` has English version or bilingual sections
- [ ] Dev-docs viewer can toggle language (if feasible within current architecture)

## Technical Notes

- Prioritize quickstart.md translation — highest traffic guide
- Use consistent technical vocabulary across all translations
- Consider a `docs/glossary.md` for term alignment
- Do NOT use machine translation without human review for technical accuracy
