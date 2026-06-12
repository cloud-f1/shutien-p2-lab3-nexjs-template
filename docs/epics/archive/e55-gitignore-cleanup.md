# E55 — Gitignore & Tracked Artifact Cleanup
> Phase 18 — Repo Simplification (Cycle 5)
> Priority: P1 | Size: S | Points: 3

## Problem

After 50 epics, runtime artifacts and tool outputs may not all be properly covered by `.gitignore`. Need to verify coverage for `.env` files, test databases, coverage outputs, Playwright artifacts, and cache directories.

## Stories

- [ ] Audit `.gitignore` for coverage of all runtime artifacts (`server/.env`, `server/test.db`, `.coverage`, `coverage/`, `.pytest_cache/`, `.ruff_cache/`)
- [ ] Verify `.playwright-mcp/` is in `.gitignore`
- [ ] Verify `client/playwright-report/` and `client/test-results/` are covered
- [ ] Add any missing patterns to `.gitignore`
- [ ] Remove any redundant or duplicate gitignore entries
- [ ] Confirm no secrets or runtime artifacts are currently tracked in git

## Acceptance Criteria

- All runtime artifacts properly ignored (`.env`, `test.db`, `.coverage`, cache dirs)
- `.playwright-mcp/` covered in `.gitignore`
- No secrets tracked in git (`git ls-files` check)
- `.gitignore` is clean — no duplicate or redundant patterns
- All tests pass (no behavioral changes)

## Dependencies

None (all parallel)
