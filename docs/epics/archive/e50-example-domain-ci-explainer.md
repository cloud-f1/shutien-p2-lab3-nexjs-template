# E50 — Example Domain README & CI Explainer

> **Size**: S (8 SP) | **Priority**: P1 | **Phase**: 17
> **Dependencies**: none

---

## Problem Statement

Example domains (places/portfolios) have no documentation explaining they're reference implementations. CI failures give no local fix guidance — beginners see red checks but don't know how to reproduce or fix locally.

## Stories

### S1: Example Domain READMEs
**Acceptance Criteria**:
- [ ] `server/app/domains/places/README.md` — explains this is an example domain
- [ ] `server/app/domains/portfolios/README.md` — same
- [ ] Both include: purpose, architecture highlights, "run cleanup to remove"
- [ ] Links to domain generator docs for creating new domains

### S2: CI Explainer Guide
**Acceptance Criteria**:
- [ ] `docs/guides/en/ci-explained.md` — beginner-friendly CI explanation
- [ ] Covers: what each check does, how to fix common failures
- [ ] Common failures: stale types, coverage < 80%, lint errors, audit warnings
- [ ] Maps CI checks to local commands (`make test`, `pnpm generate:types`)
- [ ] `docs/guides/zh-TW/ci-explained.md` — Chinese translation

### S3: CONTRIBUTING Integration
**Acceptance Criteria**:
- [ ] CONTRIBUTING.md links to CI explainer guide
- [ ] "Before submitting a PR" checklist references `make test`, `make lint`

## Technical Notes

- Example domain READMEs should be short (< 50 lines)
- CI explainer: focus on the 3-4 most common failure modes
- Link from README "Contributing" section to CI explainer
