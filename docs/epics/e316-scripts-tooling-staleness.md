# E316 — Scripts Tooling + Staleness Check

> Phase 73 · toolchain · DX
> Status: ⬜ pending

## Problem

The template's `scripts/` directory has grown to 40+ files with no inventory or entry-point doc. New contributors (and fork teams) can't quickly find what a script does without reading every file. Additionally, `docs/dev-guide/` and other high-signal docs can silently go stale relative to the code — a doc that said "181 unit tests" when there are now 518 misleads new contributors. The `ai-rc-engineer-pm` downstream project added `scripts/staleness-check.sh` (detects outdated stat claims in docs) and `scripts/screenshot-refresh.sh` (refreshes Playwright screenshots for doc updates). Both belong in the template.

## Solution

1. **`scripts/README.md`** — one-paragraph purpose per script, grouped by function (epic pipeline, code quality, DB, deploy, docs, dev tools). Makes `scripts/` navigable without reading every file.
2. **`scripts/staleness-check.sh`** — scans `docs/dev-guide/*.md` and `CLAUDE.md` for embedded test counts, migration numbers, and line counts that differ from reality. Reports: "doc says 181 unit tests; `pnpm test -- --reporter=verbose 2>&1 | tail -1` says 518". Non-blocking (exit 0) — advisory only, for human review.
3. **`scripts/screenshot-refresh.sh`** — re-captures Playwright screenshots used in docs/user-guide. Boots dev server, runs a targeted Playwright script that navigates key pages, saves screenshots to `docs/assets/screenshots/`. Useful when the UI changes significantly and docs need updated visuals.

## Key Files

- `scripts/README.md` (NEW) — scripts inventory
- `scripts/staleness-check.sh` (NEW) — doc staleness detector
- `scripts/screenshot-refresh.sh` (NEW) — screenshot recapture
- `Makefile` — add `staleness-check` and `screenshot-refresh` targets

## Implementation

### Phase 1 — Scripts inventory
- Create `scripts/README.md`. Read all files in `scripts/`; group into sections:
  - Epic pipeline: `epic-graph.sh`, `pre-merge-check.sh`, `new-domain.sh`, `new-project.sh` (E312)
  - Code quality: `check-orphan-exports.mjs` (E314), `service-map.cjs` (E314), `stop-verifier.sh`
  - DB: `db-seed-*.sh` or similar
  - Deploy: `deploy-zeabur.sh`, `install-deploy-tools.sh`
  - Docs: `staleness-check.sh`, `screenshot-refresh.sh`, `sync-to-plugin.sh`, `changelog.sh`
  - Dev tools: `effort/resolve.sh`, hooks scripts

### Phase 2 — Staleness check
- Port `scripts/staleness-check.sh` from rc-engineer-pm. Adapt patterns to this template:
  - Scan for embedded test counts: `grep -n "[0-9]\+ unit test" docs/ CLAUDE.md`; compare with `pnpm test --reporter=verbose 2>&1`
  - Scan for migration numbers: `grep -n "migration [0-9]\+" docs/ CLAUDE.md`; compare with `ls drizzle/migrations/`
  - Scan for phase/epic numbers: `grep -n "Phase [0-9]\+" docs/context/session-summary.md`; compare with EPIC_INDEX
- Exit 0 always (advisory); output a human-readable staleness report.

### Phase 3 — Screenshot refresh + Makefile
- Create `scripts/screenshot-refresh.sh`: starts dev server on port 3001 (avoids conflict with running :3000), runs a minimal Playwright script that navigates to `/login`, `/dashboard`, `/dashboard/settings`, screenshots each, saves to `docs/assets/screenshots/{login,dashboard,settings}.png`. Stops dev server on exit.
- Add Makefile targets:
  ```makefile
  staleness-check: ## Check docs for stale stat claims
    bash scripts/staleness-check.sh
  screenshot-refresh: ## Refresh doc screenshots from live app
    bash scripts/screenshot-refresh.sh
  ```

## Acceptance Criteria

- [ ] `scripts/README.md` exists with an entry for every script in `scripts/`
- [ ] `bash scripts/staleness-check.sh` runs without error; produces a staleness report (or "all clean")
- [ ] `bash scripts/screenshot-refresh.sh` runs (may require dev deps); captures at least `/login` screenshot
- [ ] `make staleness-check` and `make screenshot-refresh` work
- [ ] `pnpm typecheck && pnpm lint` clean

## Cross-Epic

- E313 (docs reorg) — `scripts/README.md` is cross-referenced from `docs/README.md`
- E314 (service-map) — `service-map.cjs` and `check-orphan-exports.mjs` catalogued here

## Out of Scope

- Wiring `staleness-check.sh` into CI (advisory for now)
- Full VRT / visual regression (see `docs/epics/archive/e211-vrt.md`)
- Automated screenshot diffing
