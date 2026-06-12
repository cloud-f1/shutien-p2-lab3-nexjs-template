# Test Status — @qa

> **Tier 1 Project Memory** · Owner: `@qa`
> Overwritten on each `/athena:qa --test-only` or full `/athena:qa` run. Gate: >=80% both suites.

---

## E210 — 2026-06-02T20:00Z (Deploy/Launch Skill Consolidation + Fork-Safety Gating)

**Branch**: `main` · **Step**: qa · **Epic**: E210

### Schema / Migration

- `docs/openapi.yaml` change: **none** → Stop verifier Rule #20 N/A
- `server/alembic/versions/*.py` change: **none** → Stop verifier Rule #19 N/A

### Server (`server/`)

| Metric | Value |
|--------|-------|
| Tests | **398 passed / 4 skipped / 20 xfailed / 7 subtests passed** |
| Coverage | **95.25%** (gate ≥90% — PASS) |
| Verdict | **PASS** — no server-side changes in E210; server suite stable |

### Client (`client/`)

| Metric | Value |
|--------|-------|
| Test files | **86 passed** |
| Tests | **515 passed / 0 failed** |
| Coverage — statements | **89.6%** (gate ≥80% — PASS) |
| Coverage — branches | **84.59%** (gate ≥80% — PASS) |
| Coverage — functions | **87.82%** (gate ≥80% — PASS) |
| Coverage — lines | **91.08%** (gate ≥80% — PASS) |
| Verdict | **PASS** — no client-side changes in E210; client suite stable |

### Acceptance Criteria — All Met

| AC | Status |
|----|--------|
| `deploy-readiness.md` exists with union of both originals | PASS |
| Two-tier structure: Generic Gates + fenced owner-specific with fork note | PASS |
| Tombstone stubs for deploy-gcr-zeabur.md and launch-checklist.md | PASS |
| No active cross-references to retired skill names | PASS |
| YAML frontmatter with trigger phrases present | PASS |
| CLAUDE.md skills count updated | PASS |
| Server coverage ≥90% | PASS — 95.25% |
| Client coverage ≥80% | PASS — 89.6% stmts |

### Overall Verdict

**PASS** — all 7 E210 acceptance criteria met; both test suites green, no regressions introduced by skill-only changes.

---

## E209 — 2026-06-02T19:30Z (Apply athena-core Sync + Cut v0.2.0)

**Branch**: `main` · **Step**: qa · **Epic**: E209

### athena_sync Audit Event

| Field | Value |
|-------|-------|
| event | `athena_sync` |
| mode | `apply` |
| files_changed | `65` |
| target | `/Users/MH/Documents/git_saas/athena-core` |
| ts | `2026-06-01T19:11:40Z` |

### athena-core Version

| File | Value |
|------|-------|
| `package.json` | `0.2.0` |
| `v0.2.0` git tag | EXISTS |

### E203 Hardening Preserved

| File | Status |
|------|--------|
| `athena-core/scripts/check-version-sync.sh` | EXISTS |
| `athena-core/tests/test-install-smoke.sh` | EXISTS |
| `lesson-tags.json` E203-sanitized version | PRESERVED (excluded from sync) |
| `score.sh` / `inject.sh` / `match.sh` / `half-life-resolve.sh` | PRESERVED (excluded from sync) |

### Drift Check

`make drift-check` from template root → **0 files differ** (all 5 pairs [OK], "Clean: no drift detected")

### Server (`server/`)

| Metric | Value |
|--------|-------|
| Tests | **398 passed / 4 skipped / 20 xfailed / 7 subtests passed** |
| Coverage | **95.25%** (gate ≥90% — PASS) |
| Verdict | **PASS** — no server-side changes in E209; server suite stable |

### Client (`client/`)

| Metric | Value |
|--------|-------|
| Test files | **86 passed** |
| Tests | **515 passed / 0 failed** |
| Coverage — statements | **89.53%** (gate ≥80% — PASS) |
| Coverage — branches | **84.59%** (gate ≥80% — PASS) |
| Coverage — functions | **87.58%** (gate ≥80% — PASS) |
| Coverage — lines | **91.08%** (gate ≥80% — PASS) |
| Verdict | **PASS** — no client-side changes in E209; client suite stable |

### Schema / Migration

- `docs/openapi.yaml` change: **none** → Stop verifier Rule #20 N/A
- `server/alembic/versions/*.py` change: **none** → Stop verifier Rule #19 N/A

### Acceptance Criteria — All Met

| AC | Status |
|----|--------|
| `athena_sync {mode:apply}` event recorded | PASS |
| E203 hardening preserved (3 checks) | PASS |
| athena-core version = 0.2.0 (3 files) | PASS |
| `v0.2.0` git tag exists and pushed | PASS |
| `make drift-check` → 0 files (not 106) | PASS |
| `decisions.md` + `plugin-sync.md` updated | PASS |
| Server coverage ≥90% | PASS — 95.25% |
| Client coverage ≥80% | PASS — 89.53% stmts |

### Overall Verdict

**PASS** — all 6 E209 acceptance criteria met, drift is 0 (was 106), athena-core at v0.2.0, both test suites green.

---

## E208 — 2026-06-02T04:00Z (Dependency Security Refresh — axios CVE + vite + build-tool advisories)

**Branch**: `main` · **Step**: qa · **Epic**: E208

### Dependency Bumps Applied

| Package | From | To | Scope | Advisory cleared |
|---------|------|----|-------|-----------------|
| `axios` | `^1.7.9` (resolved 1.13.6) | `^1.16.1` (resolved 1.16.1) | prod | 7 high + 1 moderate + 1 low (all axios CVEs) |
| `vite` | `^7.3.1` | `^7.3.5` | dev | 2 high (file-read / path-traversal) |
| `vitest` | `^4.0.18` | `^4.1.0` (resolved 4.1.8) | dev | 1 critical (Vitest UI file-read) |
| `@vitest/coverage-v8` | `^4.0.18` | `^4.1.0` | dev | peer match |

Bumps applied to: `client/package.json`, `dev-docs/package.json`, root `package.json`. Root `pnpm-lock.yaml` regenerated.

### pnpm audit --prod Gate

```
No known vulnerabilities found
```

**Result: PASS — zero high/critical in production paths.**

### Full audit (dev+prod) after bumps

41 vulnerabilities (1 low / 23 moderate / 15 high / 2 critical) — all paths are `@redocly/cli>*` (handlebars, protobufjs, fast-xml-parser) or lint/test tooling (`eslint>*`, `lint-staged>*`). None reach the production bundle. See `decisions.md` Decision 35 for the explicit acknowledgment.

### Client (`client/`)

| Metric | Value |
|--------|-------|
| Test files | **86 passed** |
| Tests | **515 passed / 0 failed** |
| Build (`pnpm build`) | **PASS** — `✓ built in 2.21s` |
| TypeScript (`tsc -p tsconfig.build.json --noEmit`) | **PASS** — clean (0 errors on production source) |
| Pre-existing tsc issues | 436 lines of errors on test files from `@testing-library/jest-dom` matchers — confirmed pre-existing (identical count before and after bump) |
| Verdict | **PASS** — no regressions from version bumps |

### Regression Note

Pre-existing test failure `src/api/__tests__/auth.test.ts > authApi > refresh > rejects when no refresh token provided` (TypeError: Cannot read properties of undefined, reading 'indexOf') was present on main before this epic and resolved itself with the vitest 4.1.8 upgrade (515/515 pass post-bump). No code changes made to tests.

### Schema / Migration

- `docs/openapi.yaml` change: **none** → Stop verifier Rule #20 N/A
- `server/alembic/versions/*.py` change: **none** → Stop verifier Rule #19 N/A

### Server (`server/`) — QA-confirmed

| Metric | Value |
|--------|-------|
| Tests | **398 passed / 4 skipped / 20 xfailed / 7 subtests passed** |
| Coverage | **95.25%** (gate ≥90% — PASS) |
| Verdict | **PASS** — no server-side changes in E208; server suite stable |

### TypeScript — QA-confirmed

| Check | Result |
|-------|--------|
| `tsc -p tsconfig.build.json --noEmit` (production source) | **PASS — 0 errors** |
| `tsc --noEmit` (full incl. test files) | 2 pre-existing errors in test files (`accessibility.test.tsx` TS6133, `mockFactory.ts` TS2345) — files not modified by E208; confirmed pre-existing |

### Overall Verdict

**PASS** — `pnpm audit --prod` clean, 515/515 client tests, 398/398 server tests, tsc production source clean, all coverage gates met, no regressions from any bump.

---

## E207 — 2026-06-02T00:00Z (Effort→Cost Observability)

**Branch**: `main` · **Step**: QA · **Epic**: E207

### Shell test suites

| Suite | Results |
|-------|---------|
| `scripts/effort/tests/test-resolve.sh` | **46/46 passed** (Section 1-7 + new Section 6b E207 enrichment: 12 assertions across 4 tiers) |
| `scripts/memory/tests/test-effort-cost-proxy.sh` | **10/10 passed** (mixed pre/post-E207 fixture; cost proxy formula; graceful degradation; empty log no-crash) |
| Runtime | Both suites <5s total |
| Real API calls | 0 (all fixture-driven via `AUDIT_LOG_PATH` env var) |
| Verdict | **PASS** |

### Server (`server/`)

| Metric | Value |
|--------|-------|
| Tests | **398 passed / 4 skipped / 20 xfailed** |
| Coverage | **95.25%** (gate >=90% — PASS) |
| Verdict | **PASS** (no regressions — E207 touches no Python code) |

### Client (`client/`)

| Metric | Value |
|--------|-------|
| Test files | **86 passed** |
| Tests | **515 passed / 0 failed** |
| Coverage — statements | **89.53%** (gate >=80% — PASS) |
| Coverage — branches | **84.59%** (gate >=80% — PASS) |
| Coverage — functions | **87.82%** (gate >=80% — PASS) |
| Coverage — lines | **91.00%** (gate >=80% — PASS) |
| Verdict | **PASS** (no regressions — E207 touches no client code) |

### Schema / Migration

- `docs/openapi.yaml` change: **none** → Stop verifier Rule #20 N/A
- `server/alembic/versions/*.py` change: **none** → Stop verifier Rule #19 N/A

### Acceptance Criteria Verification

All 7 ACs from `docs/epics/e207-effort-cost-observability.md` verified:

| AC | Verified By |
|---|---|
| `effort_resolved` includes `model_map`, `max_concurrent`, `verify_posture` for all 4 tiers | test-resolve.sh Section 6b (12 assertions) |
| `/metrics --effort` renders Effort Cost Proxy table | test-effort-cost-proxy.sh Test 8 |
| Cost proxy: haiku=1/sonnet=5/opus=25 × max_concurrent | Tests 4 (quick=6), 5 (standard=40), 6 (ultra=400) |
| Pre-E207 events excluded from cost proxy, counted in distribution | Tests 7 (thorough=0 in proxy), 10 (old-only=empty proxy) |
| E199 sub-sections unchanged | Test 2 (total_dist=5), test-resolve.sh Section 7 backward-compat |
| `scripts/hooks/CLAUDE.md` updated with new schema fields | Code review: E198+E207 section confirmed |
| All tests pass <3s, no external deps | Both suites <5s, no real `claude` calls |

### Overall Verdict

**PASS** — 46 + 10 shell tests pass, server 95.25% coverage, client 89.53% coverage, all 7 acceptance criteria met, no regressions introduced.

---

## E206 — 2026-06-02T00:00Z (Ultra-Tier Judge Panel)

**Branch**: `main` · **Step**: QA · **Epic**: E206

### Shell test suite (`scripts/qa/tests/test-verify-panel.sh`)

| Metric | Value |
|--------|-------|
| Tests | **35/35 passed** (10 test scenarios, 35 individual assertions) |
| New ultra tests | Tests 6–10 + 10-regression: agree-PASS, agree-FAIL, disagree-ESCALATE, judge ≥2/3 blocking, judge 1/3 advisory, thorough regression check |
| Runtime | ~3s (well under 15s target) |
| Real API calls | 0 (all mocked via `CLAUDE_CMD`) |
| Verdict | **PASS** |

### Server (`server/`)

| Metric | Value |
|--------|-------|
| Tests | **passed / 4 skipped / 20 xfailed** |
| Coverage | **95.25%** (gate >=90% — PASS) |
| Verdict | **PASS** (no regressions — E206 touches no Python code) |

### Client (`client/`)

| Metric | Value |
|--------|-------|
| Test files | **86 passed** |
| Tests | **515 passed / 0 failed** |
| Coverage — statements | **91.59%** (gate >=80% — PASS) |
| Coverage — branches | **86.52%** (gate >=80% — PASS) |
| Coverage — functions | **91.31%** (gate >=80% — PASS) |
| Coverage — lines | **93.06%** (gate >=80% — PASS) |
| Verdict | **PASS** (no regressions — E206 touches no client code) |

### Schema / Migration

- `docs/openapi.yaml` change: **none** → Stop verifier Rule #20 N/A
- `server/alembic/versions/*.py` change: **none** → Stop verifier Rule #19 N/A

### Acceptance Criteria Verification

All 8 ACs from `docs/epics/e206-ultra-tier-judge-panel.md` verified:

| AC | Verified By |
|---|---|
| Ultra runs double-evaluator + judge-panel; thorough byte-identical | Tests 6/7/8/9/10 + 10-reg-a/b |
| Two independent-context evaluators, both must PASS | Code review (lines 460-487) + Test 6 |
| Evaluator disagreement → ESCALATE, no auto-advance | Test 8a (exit 1) + 8b/8c (output) |
| N=3 judge panel: ≥2/3 open → blocking | Test 9a (exit 1) + 9b/9c |
| N=3 judge panel: 1/3 open → advisory | Test 10a (exit 0) + 10b |
| `findings-schema.json` ESCALATE added | Schema review confirmed |
| `verify_panel_ultra` audit event with all 7 fields | Tests 6c/7c/8d/9c + code review (Phase 6.5) |
| Test suite covers full ultra matrix in <15s | 35/35 pass in ~3s |

### Overall Verdict

**PASS** — All 35 shell tests pass, server 95.25% coverage, client 91.59% coverage, all acceptance criteria met, no regressions introduced.

---

## E205 Note — 2026-06-01 (doc-truth reconciliation)

Empirical client test count as of 2026-05-30: **515 tests / 86 files / 89.31% stmts / 84.59% branches / 87.35% funcs / 90.85% lines**.
This file will be overwritten on next `/athena:qa --test-only` run with current numbers.

---

## Last run — 2026-05-03T04:10Z (Phase 43 Wave 2 — E170 + E171 Phase A combined QA)

**Branch**: `main` (dirty worktree, combined-wave QA) · **Base**: `main@4b4b545`
**Phase**: 43 · **Wave**: 2 · **Step**: QA

### Client (`client/`)

| Metric | Value |
|--------|-------|
| Tests | **383 passed / 0 failed** (64 files) |
| Coverage | **86.08% statements / 82.12% branches / 84.33% funcs / 87.98% lines** (gate >=80% — PASS) |
| Duration | ~10s |

Coverage delta vs E168 baseline (85.91% statements): UP +0.17pp — consistent with E170 deleting untested CSS files (no logic change).

### Build (`pnpm build`)

**PASS** — `tsc && vite build` green. CSS chunk **37.12 kB** (gz 8.06 kB), well under 65 kB budget. Bundle warning on `index-DWT3EPQT.js` (513 kB / 161 kB gz) is pre-existing.

### TypeScript (`pnpm tsc --noEmit`)

**2 errors — both pre-existing baselines, NOT introduced by Wave 2:**
- `src/tests/a11y/accessibility.test.tsx:5` — `'vi' is declared but its value is never read` (TS6133)
- `src/tests/helpers/mockFactory.ts:216:23` — `Argument of type 'T' is not assignable to parameter of type 'JsonBodyType'` (TS2345)

### E2E Test Discovery (`pnpm test:e2e --list`)

**42 tests in 4 files** (no regression):
- `[chromium]` — 28 functional tests (auth-flow, dashboard-smoke, a11y) unchanged.
- `[visual]` — **14 new VRT smoke specs** (10 public + 4 dashboard, theme=dark, preset=default, viewport=1280×800).

Baselines not yet captured (Option B for Phase A — to be seeded on first CI run with `--update-snapshots`).

### Server (`server/` — sanity smoke since Wave 2 is client-only)

**398 passed / 4 skipped / 20 xfailed** in 29.70s — matches E164 baseline. No server files touched.

### Schema / Migration

- `docs/openapi.yaml` change: **none** → Stop verifier Rule #20 N/A.
- `server/alembic/versions/*.py` change: **none** → Stop verifier Rule #19 N/A.

### Verdict

**PASS** — Combined Wave 2 (E170 + E171 Phase A) closes out clean. 383/383 client tests, 398/398 server tests, build green, coverage 86.08% / 82.12% / 84.33% / 87.98% all above 80% gate, only pre-existing TS baselines remain.

---

## Last run — 2026-05-03T03:40Z (E168 — Public Surface Migration)

**Branch**: `epic/e168-public-surface` · **Base**: `main@4b4b545`
**Phase**: 43 · **Step**: QA

### Client (`client/`)

| Metric | Value |
|--------|-------|
| Tests | **366 passed / 0 failed** (61 files) |
| Coverage | **85.91% statements / 87.79% lines / 81.87% branches / 83.83% funcs** (gate >=80% — PASS) |
| Duration | ~11.3s |

New test files added by this epic: 9 (one per primitive).
- `__tests__/PublicLayout.test.tsx` (4 tests)
- `__tests__/NavBar.test.tsx` (4 tests)
- `__tests__/Footer.test.tsx`
- `__tests__/HeroSection.test.tsx`
- `__tests__/FeatureGrid.test.tsx` (4 tests)
- `__tests__/Section.test.tsx`
- `__tests__/CTABanner.test.tsx`
- `__tests__/Prose.test.tsx`
- `__tests__/EmptyState.test.tsx`

Migrated pages 100% covered: `LegalLayout.tsx`, `PrivacyPage.tsx`, `TermsPage.tsx`, `GettingStartedPage.tsx` (97.14%).

### TypeScript (`pnpm tsc --noEmit`)

**2 errors — all pre-existing per spec, NOT introduced by E168:**
- `src/tests/a11y/accessibility.test.tsx:5` — `'vi' is declared but its value is never read` (TS6133)
- `src/tests/helpers/mockFactory.ts:216:23` — `Argument of type 'T' is not assignable to parameter of type 'JsonBodyType'` (TS2345)

No new TS errors in any E168-touched file.

### Lint (`pnpm lint`)

**FAIL — pre-existing config-migration issue, not introduced by E168.** ESLint v9 expects `eslint.config.js` but project still has `.eslintrc.*`. Verified: `pnpm --filter client lint` on `main@4b4b545` produces the same exit-2 migration message. **Not a regression**; tracked as separate config-modernisation work.

### Schema / Migration

- `docs/openapi.yaml` change: **none** → Stop verifier Rule #20 N/A
- `server/alembic/versions/*.py` change: **none** → Stop verifier Rule #19 N/A
- Server tests: **not re-run** (no `server/` files touched in this epic)

### Verdict

**PASS** — 366/366 client tests green; coverage 85.91% / 87.79% well above 80% gate; only pre-existing TS/lint baselines remain (flagged but not blocking per spec).

---

## Last run — 2026-04-25T11:05:00Z (E164 — Autopilot Mode with Confidence Gates)

**Branch**: `feat/e164-autopilot-confidence-gates` · **Commit**: `727af61`
**Phase**: 41 · **Step**: QA

### Server (`server/`)

| Metric | Value |
|--------|-------|
| Tests | **398 passed / 4 skipped / 20 xfailed** |
| Coverage | **92.22%** (gate >=80% — PASS) |
| Subtests | 7 passed |
| Warnings | 120 (mostly InsecureKeyLengthWarning in legacy secret-rotation tests; no new) |
| Duration | ~29s |

Contract conformance (Phase 2.5): `tests/contract/test_schemathesis_conformance.py` — 1/1 pass.

### Client (`client/`)

| Metric | Value |
|--------|-------|
| Tests | **288 passed / 0 failed** (42 files) |
| Coverage gate | >=80% — PASS |
| Duration | ~7.4s |

### Lint / Static

| Tool | Result |
|------|--------|
| `ruff check .` (server) | **All checks passed** |
| `bash -n scripts/autopilot.sh` | OK |
| `bash -n scripts/confidence/*.sh` | 4/4 OK |

### Schema / Migration

- `docs/openapi.yaml` change: **none** → Stop verifier Rule #20 N/A
- `server/alembic/versions/*.py` change: **none** → Stop verifier Rule #19 N/A

### E164-specific smoke tests (autopilot harness + scorers)

All three QA scorer fixture cases from spec pass exactly:
- rounds=1, HIGH=0, TQS=0.85 → `0.85`
- rounds=3, HIGH=0, TQS=0.68 → `0.48` (0.7 × 0.68)
- rounds=1, HIGH=2, TQS=1.0 → `0.0` (HIGH hard-fail)

Harness end-to-end (isolated tmp `AUDIT_FILE` / `AUTOPILOT_LOG`):
- `qa` advance — exit 0, audit `autopilot_advance` emitted with `{epic,step,score,threshold,reason}`
- `merge` (no env) — exit 2, pause artifact written, policy-gate reason
- `merge` (`AUTOPILOT_ALLOW_MERGE=1`) — exit 0, advances
- `deploy` (`DEPLOY_ENV=staging`) — exit 0, advances
- `deploy` (`DEPLOY_ENV=prod` no env) — exit 2, pause prod-policy
- `--score` is side-effect-free (no audit row, no log row, no pause artifact)
- `--status` read-only resume hint
- Invalid step → exit 1 with help message

### Regression baseline (vs E162 QA at c4e8aa3)

- Server: 398/4/20 — **identical** to E162 baseline (E164 is shell scripts + docs only; no Python touched)
- Client: 288/288 — **identical**
- Coverage: 92.22% — **identical**

### Verdict

**PASS** — no regressions; all gates green; smoke tests match spec fixtures exactly.

---

## History (most recent first)

- 2026-04-25T10:35Z — E162 (398/4/20 server · 288 client · 92.22% cov) — PASS
- 2026-04-25T17:55Z — E161 client slice (279/279 client · 88.91% cov) — PASS
- 2026-04-24T18:10Z — E159 SRE Observability — PASS
- 2026-04-24T17:30Z — E156 Contract Tests — PASS
- 2026-04-24T17:00Z — E158 Auto-Promote — PASS

---

## Last run — 2026-05-03T03:42:00Z (E169 — Auth Surface Migration)

**Branch**: `epic/e169-auth-surface` · **Worktree**: `e169-auth-surface`
**Phase**: 43 · **Step**: QA

### Client (`client/`)

| Metric | Value |
|--------|-------|
| Test files | **56 passed** |
| Tests | **359 passed / 0 failed** (+21 vs main baseline 338) |
| Coverage — statements | **85.17%** (gate 80% — PASS) |
| Coverage — branches | **79.77%** (gate 80% — **FAIL**, regression from main 82.75%) |
| Coverage — functions | **83.00%** (gate 80% — PASS) |
| Coverage — lines | **87.10%** (gate 80% — PASS) |
| Duration | ~18s |

### tsc / lint

| Check | Result | Notes |
|--------|--------|-------|
| `pnpm tsc --noEmit` | 2 errors | **Pre-existing** on main (a11y test `vi` unused, `mockFactory.ts:216` `JsonBodyType`). No new TS errors from E169. |
| `pnpm lint` | exit 2 | **Pre-existing** — ESLint v9 config migration broken on main. Not introduced by E169. |

### New tests (E169 contributions, +21)
- `components/ui/__tests__/AuthLayout.test.tsx` — 4 tests
- `components/ui/__tests__/AuthCard.test.tsx` — 6 tests
- `components/ui/__tests__/DividerLabel.test.tsx` — 3 tests
- `components/ui/__tests__/Banner.test.tsx` — 8 tests

### Auth-page integration tests (must-stay-green, all PASS)
- `SignInPage.test.tsx`, `SignUpPage.test.tsx`, `ForgotPasswordPage.test.tsx`,
  `ResetPasswordPage.test.tsx`, `VerifyEmailPage.test.tsx`, `OAuthCallbackPage.test.tsx`,
  legacy `FormBanner.test.tsx`, `PasswordField.test.tsx`, `SocialButtons.test.tsx` — all green.

### Coverage regression root cause
- `pages/auth/components/PasswordField.tsx` — shim, 0% (re-export only)
- `pages/auth/components/SocialButtons.tsx` — shim, 0% (re-export only)
- These contribute uncovered branch tokens. Either delete shims (AC#3 says so) or add to `vite.config.ts` coverage `exclude` list.

