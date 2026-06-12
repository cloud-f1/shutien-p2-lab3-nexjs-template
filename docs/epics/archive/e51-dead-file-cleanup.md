# E51 — Dead File Cleanup
> Phase 18 — Repo Simplification (Cycle 5)
> Priority: P0 | Size: S | Points: 3

## Problem

Several files tracked in git are stale or orphaned after 50 epics of evolution — `server/requirements.txt` (superseded by uv), root env examples (docker-compose is self-contained), `Dockerfile.web` (replaced by `client/Dockerfile`), and `statusline.md` (personal design doc, not template-relevant but user wants to keep it).

## Stories

- [ ] Delete `server/requirements.txt` (stale — Dockerfile uses `uv sync --frozen`)
- [ ] Move `statusline.md` to `docs/design/statusline.md` (keep file, relocate to design docs)
- [ ] Delete `.env.local.example` (docker-compose.yml is self-contained, `server/.env.example` covers native dev)
- [ ] Delete `.env.production.example` (same rationale)
- [ ] Delete `Dockerfile.web` (orphaned — `docker-compose.yml` uses `client/Dockerfile`)
- [ ] Update `client/Dockerfile` comment to remove reference to `Dockerfile.web`

## Acceptance Criteria

- `server/requirements.txt` no longer tracked in git
- `statusline.md` exists at `docs/design/statusline.md` (not at project root)
- `.env.local.example` and `.env.production.example` no longer tracked
- `Dockerfile.web` no longer tracked
- `client/Dockerfile` contains no mention of `Dockerfile.web`
- `docker-compose.yml` still works (no references to deleted files)
- All tests pass (no behavioral changes)

## Dependencies

None (all parallel)
