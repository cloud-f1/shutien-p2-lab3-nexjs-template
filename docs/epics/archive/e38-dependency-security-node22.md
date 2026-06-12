# E38: Dependency Security & Node 22 Migration

> **Phase**: 13 | **Size**: S (8 SP) | **Priority**: P1
> **Depends on**: no deps
> **Source**: Strategy Cycle 2 — EVOLVE finding #1, #2

---

## Problem Statement

`npm audit` reports 12 vulnerabilities (5 moderate, 7 high) in devDependencies — primarily `undici` (via jsdom/redocly-cli) and `flatted` (via eslint). Node.js 20 LTS reaches end-of-life April 2026 — one month away. No `pnpm audit` step exists in CI, so new vulnerabilities go undetected.

## Stories

### S1: Fix npm Audit Vulnerabilities
**As a** developer,
**I want** zero high-severity vulnerabilities in the dependency tree,
**So that** CI tooling is secure and audit-clean.

**Acceptance Criteria:**
- [ ] `pnpm audit --audit-level=high` returns 0 high-severity issues
- [ ] `undici` updated to `>=7.24.0` (resolve jsdom/redocly transitive deps)
- [ ] `flatted` updated to `>=3.4.0` (resolve eslint transitive dep)
- [ ] If direct update not possible, use `pnpm.overrides` in `package.json`
- [ ] Document any overrides with reason in `package.json` comments

### S2: Migrate to Node 22 LTS
**As a** developer,
**I want** the project on Node 22 LTS,
**So that** we're on a supported runtime before Node 20 EOL.

**Acceptance Criteria:**
- [ ] `.nvmrc` updated from `20` to `22`
- [ ] `package.json` engines field updated: `"node": ">=22"`
- [ ] CI workflow (`.github/workflows/`) updated to `node-version: '22'`
- [ ] `Dockerfile.web` base image updated to `node:22-alpine`
- [ ] All tests pass on Node 22
- [ ] No breaking changes from Node 20→22 in our codebase

### S3: Add Audit to CI
**As a** maintainer,
**I want** `pnpm audit` to run in CI on every PR,
**So that** new vulnerabilities are caught before merge.

**Acceptance Criteria:**
- [ ] CI workflow adds `pnpm audit --audit-level=high` step
- [ ] Runs after install, before build
- [ ] Non-blocking for moderate (warn only), blocking for high/critical
- [ ] Cron job: weekly full audit (catches newly disclosed CVEs)

## Risk Notes

- Node 22 may have minor breaking changes in `crypto` or `fetch` — test thoroughly
- `pnpm.overrides` can mask real issues — document and revisit quarterly
- Moderate vulnerabilities left as warnings to avoid CI noise from transitive deps

---

## Technical Design

### Current Vulnerability Inventory (2026-03-14)

`pnpm audit` reports **12 vulnerabilities** (5 moderate, 7 high):

| Package | Severity | CVE / Advisory | Via (transitive path) | Fix Version |
|---------|----------|----------------|----------------------|-------------|
| `flatted` | high | GHSA-25h7-pfq9-p65f (unbounded recursion DoS) | `eslint > file-entry-cache > flat-cache > flatted` | `>=3.4.0` |
| `undici` | high | GHSA-f269-vfmq-vjvj (WebSocket 64-bit overflow) | `jsdom > undici` (v7.x) | `>=7.24.0` |
| `undici` | high | GHSA-f269-vfmq-vjvj (WebSocket 64-bit overflow) | `@redocly/cli > undici` (v6.x) | `>=6.24.0` |
| `undici` | high | GHSA-vrm6-8vpv-qv8q (WebSocket memory DoS) | `jsdom > undici` (v7.x) | `>=7.24.0` |
| `undici` | high | GHSA-vrm6-8vpv-qv8q (WebSocket memory DoS) | `@redocly/cli > undici` (v6.x) | `>=6.24.0` |
| `undici` | high | GHSA-2mjp-6q6p-2qxm (request smuggling) | `jsdom > undici` (v7.x) | `>=7.24.0` |
| `undici` | high | GHSA-2mjp-6q6p-2qxm (request smuggling) | `@redocly/cli > undici` (v6.x) | `>=6.24.0` |
| `undici` | moderate | GHSA-2mjp-6q6p-2qxm (request smuggling) | `@redocly/cli > undici` (v6.x) | `>=6.24.0` |
| `undici` | moderate | GHSA-4992-7rv2-5pvq (CRLF injection) | `jsdom > undici` (v7.x) | `>=7.24.0` |
| `undici` | moderate | GHSA-4992-7rv2-5pvq (CRLF injection) | `@redocly/cli > undici` (v6.x) | `>=6.24.0` |
| `undici` | moderate | GHSA-phc3-fgpg-7m6h (DeduplicationHandler DoS) | `jsdom > undici` (v7.x) | `>=7.24.0` |

All vulnerabilities are in **devDependencies** — they affect CI/build tooling, not production runtime. However, they should still be fixed for supply-chain hygiene.

### S1 Resolution Strategy: Package Updates & Overrides

#### Step 1 — Direct Dependency Updates

Current direct versions vs. required:

| Package | Current | Target | Notes |
|---------|---------|--------|-------|
| `jsdom` | `^28.1.0` | Latest `28.x` or `29.x` | Check if latest pins `undici>=7.24.0` |
| `@redocly/cli` | `^2.20.4` | Latest `2.x` | Check if latest pins `undici>=6.24.0` |
| `eslint` | `^9.16.0` | `^9.39.4` (already resolved) | Check if latest drops `flat-cache`/`flatted` dep |

Run `pnpm update jsdom @redocly/cli eslint --latest` first. If transitive deps are fixed by the update, no overrides needed.

#### Step 2 — `pnpm.overrides` (only if Step 1 insufficient)

Add to root `package.json` (pnpm workspace resolves overrides from root):

```jsonc
{
  "pnpm": {
    "overrides": {
      // GHSA-25h7-pfq9-p65f: flatted unbounded recursion DoS
      // Via: eslint > file-entry-cache > flat-cache > flatted
      "flatted": ">=3.4.0",
      // GHSA-f269-vfmq-vjvj, GHSA-vrm6-8vpv-qv8q, GHSA-2mjp-6q6p-2qxm, GHSA-4992-7rv2-5pvq
      // Via: jsdom > undici (v7.x branch)
      "undici@>=7.0.0": ">=7.24.0",
      // Via: @redocly/cli > undici (v6.x branch)
      "undici@>=6.0.0 <7.0.0": ">=6.24.0"
    }
  }
}
```

**Key**: pnpm's `overrides` supports version-range selectors (`undici@>=7.0.0`), which allows pinning different ranges for the v6 and v7 branches independently.

#### Step 3 — Verify

```bash
pnpm install          # Regenerate lockfile with overrides
pnpm audit --audit-level=high  # Must exit 0
pnpm test:client      # All tests still pass
```

### S2 Resolution Strategy: Node 22 Migration

#### Files to Update

| File | Current | Target | Notes |
|------|---------|--------|-------|
| `.nvmrc` | `20` | `22` | Used by `nvm use` / `fnm use` |
| `package.json` (root) | No `engines` field | Add `"engines": {"node": ">=22"}` | Enforces minimum version |
| `.github/workflows/ci.yml` L63 | `node-version: "20"` | `node-version: "22"` | CI runner |
| `Dockerfile.web` L2 | `node:20-alpine` | `node:22-alpine` | Combined web build |
| `client/Dockerfile` L1 | `node:20-alpine` | `node:22-alpine` | Standalone client build |
| `dev-docs/Dockerfile` L1 | `node:20-alpine` | `node:22-alpine` | Dev-docs build |

#### Node 20 → 22 Breaking Change Assessment

Relevant changes in Node 22 for this codebase:

1. **`globalThis.fetch` (undici built-in)**: Node 22 bundles `undici` internally for `fetch()`. Our client uses Axios (not `fetch`), so no impact. Test runner (Vitest/jsdom) uses its own `undici` — no conflict.
2. **`crypto` module**: `node:crypto` has new APIs but no removals. Our server handles crypto (Python), client has no direct `crypto` usage.
3. **ESM loader changes**: Node 22 stabilized the ESM loader. Vite/Vitest already use ESM (`"type": "module"` in `client/package.json`). No changes needed.
4. **V8 version bump**: V8 12.4+ in Node 22. No known compatibility issues with our React 18 / TypeScript / Vite stack.
5. **`pnpm` compatibility**: pnpm 9.x fully supports Node 22. `corepack enable` works unchanged.

**Assessment**: No breaking changes expected. All risk is in transitive dependencies, which are tested by running the full test suite on Node 22.

### S3 Resolution Strategy: CI Audit Step

#### CI Workflow Change (`.github/workflows/ci.yml`)

Add audit step to the `frontend` job, between `Install dependencies` and `Check generated types`:

```yaml
      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      # NEW: Security audit — blocks on high/critical, warns on moderate
      - name: Security audit
        run: pnpm audit --audit-level=high

      - name: Check generated types are up-to-date
        working-directory: client
        # ... existing step
```

**Placement rationale**: After `pnpm install` (lockfile must exist for audit) and before build/test (fail fast on known vulnerabilities). The `--audit-level=high` flag means moderate issues produce warnings in the log but don't fail the build.

#### Weekly Cron Audit (new workflow file)

Create `.github/workflows/audit.yml`:

```yaml
name: Security Audit

on:
  schedule:
    - cron: '0 9 * * 1'  # Every Monday at 09:00 UTC
  workflow_dispatch:       # Allow manual trigger

permissions:
  contents: read

jobs:
  audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Full security audit
        run: pnpm audit
```

This catches newly disclosed CVEs between PRs. Failure shows in the repo Actions tab. No notifications configured by default — can be added via GitHub notification settings.

### Implementation Order

1. **S2 first** (Node 22 migration) — update all version references, run tests
2. **S1 second** (fix vulnerabilities) — update packages, add overrides if needed, verify audit clean
3. **S3 last** (CI audit step) — add to workflow after everything is clean

This order prevents CI from immediately failing on the new audit step before vulnerabilities are fixed.

### Files Modified (complete list)

```
.nvmrc                           # 20 → 22
package.json                     # Add engines + pnpm.overrides (if needed)
client/package.json              # Update jsdom, @redocly/cli, eslint versions
pnpm-lock.yaml                   # Regenerated
.github/workflows/ci.yml         # node-version: 22 + audit step
.github/workflows/audit.yml      # NEW: weekly cron audit
Dockerfile.web                   # node:22-alpine
client/Dockerfile                # node:22-alpine
dev-docs/Dockerfile              # node:22-alpine
```

No OpenAPI changes. No server changes. No new client code.

---

## QA Checklist

### Pre-Implementation Verification
- [ ] `node -v` confirms Node 22 is available locally (install via `nvm install 22`)
- [ ] Current test suite passes on Node 20 (baseline)

### S1: Vulnerability Fixes
- [ ] `pnpm audit --audit-level=high` exits with code 0 (zero high-severity issues)
- [ ] `pnpm audit` output reviewed — moderate issues documented if remaining
- [ ] `pnpm.overrides` entries (if any) each have an inline comment with advisory ID
- [ ] `pnpm install --frozen-lockfile` still works (lockfile is consistent)

### S2: Node 22 Migration
- [ ] `.nvmrc` reads `22`
- [ ] `package.json` has `"engines": {"node": ">=22"}`
- [ ] `.github/workflows/ci.yml` has `node-version: "22"`
- [ ] All three Dockerfiles (`Dockerfile.web`, `client/Dockerfile`, `dev-docs/Dockerfile`) use `node:22-alpine`
- [ ] `pnpm test:client` passes (all client unit tests)
- [ ] `pnpm test:docs` passes (dev-docs tests)
- [ ] `pnpm build` succeeds (both client + dev-docs)
- [ ] `pnpm test:scripts` passes (root-level script tests)
- [ ] No `ERR_` or deprecation warnings in test output related to Node 22

### S3: CI Audit Step
- [ ] `pnpm audit --audit-level=high` step is in `ci.yml` after install, before type check
- [ ] `audit.yml` cron workflow created with `schedule` + `workflow_dispatch` triggers
- [ ] Cron schedule uses Node 22 (matches ci.yml)
- [ ] Both workflows use `pnpm/action-setup@v4` + `actions/setup-node@v4`

### General
- [ ] No files outside the listed scope were modified
- [ ] `pnpm-lock.yaml` changes are intentional (dependency updates only)
- [ ] Coverage >= 80% maintained (no code changes, so coverage should be unchanged)
