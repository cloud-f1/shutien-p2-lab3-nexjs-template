# E46 — Visual README & Onboarding Discovery

> **Size**: M (13 SP) | **Priority**: P0 | **Phase**: 17
> **Dependencies**: none

---

## Problem Statement

No screenshots or visual preview exists in the README — beginners cannot evaluate the template without cloning. The `/getting-started` page built in E44 is undiscoverable (not linked from README, quickstart, or `make go` output). `template-cleanup.sh` next-steps are stale (says `pnpm install` not `make go`).

## Stories

### S1: Dashboard/Landing Screenshots
**Acceptance Criteria**:
- [ ] Create `docs/assets/` directory with dashboard preview PNG
- [ ] Capture landing page + dashboard screenshots (dark theme)
- [ ] Un-comment README image placeholder, reference actual image
- [ ] Consider animated terminal GIF of `make go` (using `vhs` or `asciinema`)

### S2: Onboarding Discovery
**Acceptance Criteria**:
- [ ] `make go` success message includes link to `http://localhost:5173/getting-started`
- [ ] README quickstart mentions `/getting-started` as first step after `make go`
- [ ] English + Chinese quickstart guides link to `/getting-started`
- [ ] Landing page has a visible "Getting Started" link/button

### S3: Fix template-cleanup.sh Next Steps
**Acceptance Criteria**:
- [ ] Post-cleanup message says `make go` instead of `pnpm install`
- [ ] Mentions `make tutorial` and `/getting-started` page
- [ ] Clarifies relationship between `template-cleanup.sh` and `pnpm new-site`

## Technical Notes

- Screenshots can be generated via Playwright or manual capture
- Use relative paths for images in README (`docs/assets/dashboard-preview.png`)
- `make go` message is in `Makefile` lines 14-20
