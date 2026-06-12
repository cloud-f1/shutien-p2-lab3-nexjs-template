# E129 — CI Hardening: pip-audit + Bundle Size Budget

**Status**: done  
**Size**: M (5 SP)

## Goals

1. Add `pip-audit` to backend CI — scan Python dependencies for known vulnerabilities after tests pass
2. Add `size-limit` bundle budget to frontend CI — fail if gzipped JS exceeds 300 kB
3. Verify `--frozen-lockfile` is used for pnpm install in CI (already confirmed)

## Design

- **pip-audit**: added as dev dependency in `server/pyproject.toml`, CI step runs `uv run pip-audit`
- **size-limit**: `@size-limit/file` + `size-limit` as devDependencies, config in `client/.size-limit.json`
- **frozen-lockfile**: already present in both `frontend` and `e2e` jobs — no change needed

## Files Changed

- `server/pyproject.toml` — add `pip-audit` to dev deps
- `client/package.json` — add `size-limit`, `@size-limit/file`, `size` script
- `client/.size-limit.json` — bundle budget config
- `.github/workflows/ci.yml` — add pip-audit + size-limit steps
