# E208 — Dependency Security Refresh (axios CVE + vite + build-tool advisories)

> Phase 50 — Operationalize the Dial | Size: M (10 SP) | Deps: none

## Problem

A real `pnpm audit` against the client workspace surfaces a production-path security exposure. The installed axios resolves to **1.13.6** (verified in `pnpm-lock.yaml`; `client/package.json` declares `^1.7.9`), and advisories require **≥1.15.1** — 7 *high* axios advisories reach production paths (`pnpm audit --prod`): credential theft, full request/response MITM, `NO_PROXY` bypass, and prototype-pollution response gadgets. Per the architecture rules, axios is the **single** production HTTP client (`apiClient` in `client/src/api/client.ts` is the one Axios instance), so the entire client→server data path inherits these advisories.

Secondary findings in the same audit, lower priority but folded into one maintenance epic:
- **Vite** (dev server) carries a high advisory for a dev-server file-read / path-traversal class — dev surface, not shipped, but a `pnpm audit` failure adopters will see.
- **`@redocly/cli`** (OpenAPI docs/build tooling) pulls 4 critical + several high advisories transitively (handlebars prototype pollution, protobufjs, fast-xml-parser) — build/docs surface only, never in the runtime bundle.
- **vitest** dev-server UI advisory — test surface only.

For a template whose explicit purpose is to be cloned, the embarrassment-if-found risk is concrete: a security-conscious adopter's first `pnpm audit` fails the template at the door, on its production HTTP client.

## Solution

A bounded dependency bump with a hard regression gate. Order by blast radius: production runtime first, then dev/build surface.

1. **axios → ≥1.15.1** (within the existing `^1.7.9` range — an in-range minor; low semver risk). This is the only production-path fix and the headline of the epic.
2. **vite → past the dev-server advisory** (likely a minor/patch within the current major; if a major bump is required, smoke `pnpm build` + `pnpm dev` proxy routes).
3. **`@redocly/cli` → pin or isolate** so its transitive criticals drop out of `pnpm audit --prod`. If a clean upgrade exists, take it; otherwise pin to the lowest version whose transitive tree is clean, or move it behind an optional/dev-only boundary so it doesn't gate the primary audit.
4. **vitest → ≥ the patched line** (dev/test only).
5. **Regression gate**: full client suite green post-bump (`pnpm test:run`), `tsc` clean, `pnpm build` green, and the dev proxy still routes. Re-run `pnpm audit --prod` and assert **zero high/critical in production paths**.

## Key Files

| File | Action |
|---|---|
| `client/package.json` | Edit — bump axios, vite, vitest; pin/isolate `@redocly/cli` |
| `pnpm-lock.yaml` | Regenerate — `pnpm install` after the bumps (root lockfile, workspace) |
| `docs/context/decisions.md` | Edit — record the security-bump decision + the `@redocly/cli` isolation choice |
| `docs/context/test-status.md` | Edit — note the post-bump regression-gate result |
| (smoke only) `client/src/api/client.ts` | Verify — axios API surface used (`create`, interceptors) is unchanged across 1.13→1.15 |

## Implementation

1. Capture the baseline: `cd client && pnpm audit --prod` → record the exact advisory IDs + the 7 high axios entries (so the after-state is provably clean).
2. Bump axios in `client/package.json` to `^1.15.1` (or the latest 1.x); `pnpm install`; re-run `pnpm audit --prod` → axios highs gone.
3. Smoke the axios surface: confirm `apiClient` creation, request/response interceptors, and the typed wrappers in `client/src/api/` still compile (`tsc`) and the auth flow tests pass — axios 1.13→1.15 is a minor but interceptor/adapter internals occasionally shift.
4. Bump vite (and vitest) to the patched lines; `pnpm build` + `pnpm test:run` must stay green; if vite is a major bump, verify `vite.config.ts` proxy + `base` behavior (the `/docs/` build-time base switch) survives.
5. Resolve `@redocly/cli`: upgrade if a clean tree exists; else pin/isolate so `pnpm audit --prod` no longer reports its transitive criticals. Document the choice in `decisions.md`.
6. Final gate: `pnpm audit --prod` shows **zero high/critical in production paths**; full client suite + `tsc` + `build` all green. Record counts in `test-status.md`.

## Acceptance Criteria

- [ ] Resolved axios is ≥1.15.1 in `pnpm-lock.yaml`; `pnpm audit --prod` reports **zero** axios high/critical advisories
- [ ] `pnpm audit --prod` reports zero high/critical advisories in **production** paths overall (build/docs-only tooling may remain if explicitly isolated + documented)
- [ ] vite bumped past the dev-server advisory; `pnpm build` and `pnpm dev` proxy routes verified working
- [ ] `@redocly/cli` transitive criticals no longer appear in `pnpm audit --prod` (upgraded, pinned, or isolated — decision recorded in `decisions.md`)
- [ ] Full client test suite green post-bump (`pnpm test:run`), `tsc --noEmit` clean, `pnpm build` green — no regression from any bump
- [ ] The axios API surface used by `apiClient` + typed wrappers is confirmed unchanged (auth flow + service-layer tests pass)
- [ ] `decisions.md` records the bump + the `@redocly/cli` resolution; `test-status.md` records the regression-gate result

## Alignment / Cross-Epic Hooks

- **Independent epic** — no deps on other Cycle-22 epics; ships in the Phase 50 parallel wave.
- **Highest external blast radius** of the cycle — the only finding a third party sees on `pnpm audit`. Per the strategist recommendation, trim other epics before this one.
- **Respects the architecture rule** — axios stays the single production HTTP client; this is a version bump, not a client swap.
- **Reuses the coverage gate** — the existing ≥80% client coverage gate is the regression backstop.

## Out of Scope

- Swapping axios for fetch/ky or any HTTP-client change — version bump only (architecture rule: Axios is the single client).
- Re-enabling CI to run `pnpm audit` automatically (owner disabled CI deliberately 2026-05-20) — this epic fixes the advisories; automating the scan is a separate owner decision.
- Server-side (`uv`/pip) dependency upgrades — `uv run pip list --outdated` showed no security-grade findings this cycle; defer routine freshness to a later evolve pass.
- Pinning every transitive dep to exact versions — only the advisory-bearing ones.

## Provenance

- Spec source: `/athena:plan auto` Cycle 22 (2026-06-02) — `evolve` sub-mode real `pnpm audit` finding; axios 1.13.6 verified against `pnpm-lock.yaml`.
- Approved via `/athena:plan approve E206,E207,E208,E209,E210` on 2026-06-02 (Cycle 22).
