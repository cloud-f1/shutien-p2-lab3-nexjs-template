# E49 — Documentation Consistency Sweep

> **Size**: S (5 SP) | **Priority**: P1 | **Phase**: 17
> **Dependencies**: none

---

## Problem Statement

5+ files still reference "Node >= 20" despite the project requiring Node 22. This was supposed to be fixed in Cycle 3 but was incomplete. Version mismatches erode documentation trust for beginners.

## Stories

### S1: Fix Node Version References
**Acceptance Criteria**:
- [ ] `CONTRIBUTING.md` says Node >= 22
- [ ] `CONTRIBUTING.zh-TW.md` says Node >= 22
- [ ] `dev-docs/public/DEVELOPER_DOCS.md` says Node >= 22
- [ ] `docs/dev-guide/getting-started.md` says Node >= 22
- [ ] `.github/ISSUE_TEMPLATE/bug_report.md` says `Node version: [e.g., 22.x]`

### S2: Version Consistency CI Check
**Acceptance Criteria**:
- [ ] `scripts/check-doc-versions.sh` greps for stale version numbers (Node 20, pnpm 8)
- [ ] Added to CI workflow or `make lint` target
- [ ] Prevents version mismatch regression

### S3: pnpm Version Consistency
**Acceptance Criteria**:
- [ ] All docs agree on pnpm >= 9
- [ ] Check any other version references (Python, etc.) are consistent

## Technical Notes

- Simple grep-based script: `grep -rn "Node.*20\|node.*20\|>= 20" --include="*.md"`
- Can be added as a step in existing CI workflow
- Quick win — 5 SP, mostly find-and-replace
