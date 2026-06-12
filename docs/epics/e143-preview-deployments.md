# E143 — Preview Deployments per PR

> **Phase 36** | Priority: P2 | Points: 5 | Size: M
> **Depends on**: E120 (Zeabur Deploy), E121 (Cloud Run Deploy)

---

## Problem Statement

When reviewing PRs, there is no way to preview changes in a live environment before merging. Reviewers must check out the branch locally and run the stack manually. This slows feedback loops and makes it harder to catch integration issues.

## Solution

A GitHub Actions workflow that:
1. Deploys a preview environment for each PR (on open/sync/reopen)
2. Comments the PR with the preview URL (creates or updates a single comment)
3. Tears down the preview when the PR is closed/merged

The workflow ships as a **platform-agnostic placeholder** — users configure the deploy step for their platform (Zeabur, Cloud Run, Vercel). A helper script `scripts/deploy-preview.sh` encapsulates the platform-specific logic.

## Stories

### S1: Preview Deploy Workflow

**AC:**
- [ ] `.github/workflows/preview.yml` created
- [ ] Triggers on `pull_request` (opened, synchronize, reopened) and `pull_request_target` (closed)
- [ ] Concurrency group per PR number with cancel-in-progress
- [ ] SHA-pinned actions matching `ci.yml` conventions
- [ ] Deploy step is a documented placeholder (not a real deploy)
- [ ] PR comment with preview URL (upsert pattern — update existing comment)
- [ ] Teardown job runs only when PR is closed

### S2: Deploy Helper Script

**AC:**
- [ ] `scripts/deploy-preview.sh` created and executable
- [ ] Accepts PR number as argument
- [ ] Supports `DEPLOY_PLATFORM` env var (zeabur, cloudrun)
- [ ] Placeholder commands with clear TODO markers

## Files Changed

| File | Action |
|------|--------|
| `.github/workflows/preview.yml` | Create |
| `scripts/deploy-preview.sh` | Create |
| `docs/epics/e143-preview-deployments.md` | Create (this file) |
