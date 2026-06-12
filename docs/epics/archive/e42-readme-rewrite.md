# E42 — README Rewrite for Beginners

> **Size**: S (8 SP) | **Priority**: P0 | **Phase**: 16
> **Dependencies**: E41 (needs simplified startup to document)

---

## Problem Statement

The README is 450 lines with inline tables for 7 agents, 14 commands, and 7 skills. It overwhelms beginners and buries the quickstart. The English section is incomplete. No screenshot or demo shows what the running app looks like.

## Stories

### S1: Beginner-First README Structure
**Acceptance Criteria**:
- [ ] One-paragraph pitch at top: what this solves, for whom
- [ ] Screenshot or GIF of the running dashboard
- [ ] 3-line quickstart: `git clone → make go → open browser`
- [ ] README < 200 lines total
- [ ] Agent/command/skill tables moved to `docs/reference/` — linked, not inlined

### S2: Progressive Disclosure
**Acceptance Criteria**:
- [ ] "What's included" feature grid uses `<details>` collapse (closed by default)
- [ ] "For advanced users" section links to agent docs, not inline tables
- [ ] Clear separation: "Getting Started" → "Features" → "Documentation" → "Contributing"

### S3: Full English Parity
**Acceptance Criteria**:
- [ ] English section has full quickstart steps (not just "click Use this template")
- [ ] Both ZH and EN sections have equivalent content depth
- [ ] Language toggle or clear section headers for bilingual navigation

### S4: "Works Without Claude Code" Messaging
**Acceptance Criteria**:
- [ ] Badge or callout: "Works as a standalone SaaS starter — Claude Code optional"
- [ ] Brief section explaining what you get without vs. with Claude Code

## Technical Notes

- Move detailed tables to `docs/reference/agents.md`, `docs/reference/commands.md`, `docs/reference/skills.md`
- Screenshot: capture dashboard with dark theme, place in `docs/assets/`
- Keep README bilingual (ZH primary, EN secondary) but both sections complete
