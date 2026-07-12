# Strategy Log — @strategist Write-Back

> Written by: @strategist agent
> Read by: `/athena:plan`, `/athena:cycle`, `/athena:learn`

---

## Current Cycle

| Field | Value |
|-------|-------|
| Cycle | 35 |
| State | APPROVED |
| Date | 2026-07-12 |
| Notes | Phase 77 (高轉換銷售頁 + 統一一次性金流) — 4 epics E326–E329 APPROVED 2026-07-12 from a user-supplied sales-page PRD (AIDA copy structure + unified ECPay/NewebPay/Stripe one-time payment interface). User decisions: **ECPay 綠界 = launch gateway** (deploys set `BILLING_PROVIDER=ecpay`; resolver code default stays stripe) · scope = 結帳+訂單+**交付開通** (full) · formal epics via /athena:plan. ~70% infra pre-existed (E249 provider contract, E250/E261 landing sections, ecpay/stripe providers, payment_events idempotency) — epics cover only the true gaps: sales route+4 sections (E326), products/orders+checkout (E327), entitlement delivery (E328), NewebPay slot (E329). Wave 1: E326+E327 → Wave 2: E328+E329. |
| Prev34 | Phase 75 (Backport Wave 2) — 5 epics E319–E323 APPROVED + **EXECUTED** 2026-07-08 (implement→QA→commit→push→PR each; merges pending user, pull-only perms). Ran as a **sequential PR stack** (shared files: stop-verifier/CLAUDE/package.json) — dogfooding E319's own in-repo-chain mode. PRs: **#72 E320 · #73 E319 · #74 E321 · #75 E322 · #76 E323**, stacked. E323 scoped to Part A + @saas/{scheduler,audit-log}; **E324 follow-up** = @saas/{rbac-scoped-visibility,sentry-pii,csv-io} + the 8 orphans E320 found. |
| Prev33 | Phase 73 (Template Enhancement Backport from ai-rc-engineer-pm, E311–E317) — 7 epics, all parallel. TONY chief-of-staff · new-project wizard · docs reorg · service-map+dead-code (docs-level) · testing-strategy skill · scripts tooling · zeabur-deploy skill. APPROVED + merged (PRs #59–#66). |
| Prev32 | Phase 72 (Follow-ups from /athena:align, E307–E310) — TOTP e2e, usage limits, export expansion, 2FA recovery + onboarding persistence. Merged via PR #57 (#58 for state flip). 518 tests, migration 0010. |
| Prev31 | Phase 71 (Athena Toolchain, E302–E306) — rebrand skill, mockup-to-epics + /athena:plan mockup, alignment-audit + /athena:align, user-guide-builder + VitePress dev-docs (deployed to Cloudflare Pages), zeabur-deploy skill. Merged via PR #54. |

---

## Cycle 35 — 2026-07-12 — Mode: register-user-prd (source: 數位產品/課程銷售頁 PRD)

**Theme**: **High-conversion sales page + unified one-time payments.** User supplied a complete PRD (AIDA sales-page copy structure · 3-sec hook video spec · `UnifiedCheckoutPayload`/`PaymentGatewayProvider` interface for ECPay/NewebPay/Stripe · SSG/ISR perf strategy). Gap analysis found the template already implements ~70%: E249's `PaymentProvider` contract *is* the PRD's gateway interface (createCheckout explicitly one-time-capable, verifyWebhook, payment_events idempotency), ECPay + Stripe providers are live, and 8/9 AIDA sections exist in `components/marketing/*`.

**User decisions (2026-07-12)**: launch gateway = **ECPay 綠界** (webhook test priority; deploys set `BILLING_PROVIDER=ecpay`, resolver default untouched) · purchase scope = **full delivery** (checkout + orders + entitlement 開通) · execution = formal epics.

### Registered Epics (Phase 77)

| # | Epic | Pts | Deps | Scope |
|---|------|-----|------|-------|
| **E326** | 高轉換銷售頁模組 | 8 | none | `/p/[slug]` SSG route + `lib/sales/content.ts` typed copy config + new sections (pain-points · solution · modules-table · countdown · risk-reversal) + hook-video muted-autoplay/captions. Reuses hero/social-proof/testimonials/faq/cta. |
| **E327** | 一次性購買 products/orders + 統一結帳 | 13 | none | `products`/`orders` tables · `createOneTimeCheckout` defineAction (guest OK) · shared `settleOrder()` webhook settlement (idempotent via payment_events) · 感謝頁 · ECPay-first ops docs. |
| **E328** | 交付開通 entitlement | 8 | E327 | `lib/entitlements.ts` guard (order = ownership; live DB re-read) · dashboard/library 內容庫 (DataTable) · guest-order claim-by-email · confirmation email. |
| **E329** | 藍新 NewebPay provider | 8 | E327 | Fill E249's reserved resolver slot: MPG AES TradeInfo + SHA256 TradeSha, one-time only, auto-submit form, notify route → settleOrder(); known-vector tests. |

**Total**: 37 SP · Wave 1: E326+E327 (disjoint files) → Wave 2: E328+E329. **State: APPROVED** (user-gated via AskUserQuestion, 3/3 decisions recorded).

---

## Cycle 34 — 2026-07-08 — Mode: register-backport (source: ../ai-rc-engineer-pm downstream product)

**Theme**: **Backport Wave 2 — pull the fork's *executable* tooling + reusable code patterns upstream.** Phase 73 already backported the *skill/docs* layer. Since then the fork (瑞成 PMS) hardened E301–E323 and produced runnable guards, a real test middle-layer, CI/deploy hardening, and reusable Server-Action/UI patterns the template still lacks. Research method: 4 parallel gap-analysis agents (agents/skills/commands/hooks · next-app features+UI+design · docs/scripts/infra/deploy · git+epics history), cross-checked against the template's actual deliverables (found E314 shipped only a hand-written `service-map.md`, not the fork's mechanical `service-map.cjs`).

**GENERALIZABLE-only.** Engineering-PM domain code (cases/nodes/prereqs/subcases/calendars, traffic-light schedule engine, gantt, badge-login role tiers, 繁中 domain enums) is explicitly **excluded**.

### Proposed Epics (Phase 75)

| # | Epic | Priority | Pts | Deps | Rationale |
|---|------|----------|-----|------|-----------|
| **E319** | **Orchestration & guardrail hardening** | P1 | 10 | none | `flow.md` **Step 6 Sequential In-Repo Chain Mode** (coupled / ≥2-migration / foundational epics break parallel worktrees — real gap in the template's parallel-only model) · `audit.md` **Step 6 Knowledge-drift** (doc↔code constant drift + post-rebrand brand/identity staleness — the exact class that let E314's state say "MERGED" while only a doc shipped) · stop-verifier **`// stop-verifier:public-action` exemption marker** + guard-family recognition + hooks "re-sync verifier on convention-rename" lesson · 2 Tier-0 notes (dependency-rules duplicate-block gotcha; guardrail-widening needs sign-off + fixture). |
| **E320** | **Executable dead-code & architecture guards** (upgrades E314/E315 docs→runnable) | P1 | 8 | none | Port the fork's real `scripts/service-map.cjs` (import-graph → Mermaid + orphan/phantom detection) to replace the template's hand-written `payments-service-map.md` · `scripts/check-orphan-exports.mjs` + `pnpm check:orphans` (the "orphan-tested-function" trap the testing-strategy skill only *describes*) · wire both into `make verify` + CI. |
| **E321** | **Test pyramid middle layer + QA process** | P1 | 13 | none | Throwaway-DB **integration harness → `pnpm test:int`** · **jsdom + RTL component-test layer** (+ `@testing-library/*` deps) — template has only vitest-unit + playwright-e2e (missing hourglass middle) · `docs/qa/` scaffold: test-strategy pyramid-audit template + versioned **manual-test-plan** convention with automation-coverage annotation. |
| **E322** | **CI / deploy / release hardening + doctrine** | P1 | 15 | none | Re-enable + harden CI (**SHA-pin actions, least-priv `permissions`, `package_json_file: next-app/package.json`, docs-build job**) · **docs-deploy workflow split** (dev-docs vs user-docs, path-scoped) + scaffold `user-docs/` VitePress end-user-manual pipeline · `make verify` umbrella gate + **`make deploy-gcp` (Cloud Run Road 2)** + `deploy/.env.deploy.example` · CONTRIBUTING "ship discipline" + CLAUDE.md doctrine (**runtime-vs-build-time env**, per-env seeding rules, multi-env deploy table, **version-in-sidebar `APP_VERSION`**). |
| **E323** | **Reusable patterns — DECISION-GATED (bake-in vs @saas module)** | P2 | 18 | none | Lightweight bake-in: **`defineAction` factory** (guard→zod→authorize→handler→audit→revalidate) + stop-verifier recognition · **responsive `rc-modal`** (Dialog↔Sheet) + `calendar`/`date-picker` shadcn primitives + `mobile-tab-bar` · `ui-spec-epic.md` surface-contract template. Heavier/domain-adjacent patterns proposed as **optional `@saas` registry modules** (keep base lean): in-process `node-cron` scheduler, immutable before/after audit-log, CSV import/export, Sentry+PII-scrub, assignment-scoped row-level RBAC visibility. |

**Total**: 64 SP · 5 epics · all parallel (no cross-deps, no colliding migrations expected — E321 adds deps + a throwaway-DB harness, E323 may add shadcn components → run those two **in-repo**, not worktree-isolated). DAG: all five independent → single wave.

**Advisory (my ideas, not yet epics — defer or fold on request):**
- **Session-checkpoint noise** — the fork's history was ~50% `chore: session checkpoint` commits (one commit had to compact them). Recommend a batched-checkpoint / squash-on-save convention for `/athena:save` before the template inherits the same noise.
- **Module-vs-bake-in is the one real decision** (drives E323 shape). Template already ships a `@saas` registry (billing-stripe, landing) — the clean home for heavy optional patterns. Recommend: bake in the factory + UI primitives (broadly useful), modularize scheduler/audit-log/RBAC-visibility.
- **The state-drift I found is self-justifying evidence** for E319's audit Step 6 + E320's orphan tool: E314 was marked "service-map tools MERGED" but only a markdown map shipped. The doc↔code drift check would have caught it.

**State**: AWAITING_APPROVAL. Approve with `/athena:plan approve E319,E320,E321,E322` (E323 gated on the bake-in-vs-module decision below), or adjust scope first.

---

## Cycle 28 — 2026-06-15 — Mode: register-user-scoped-work

**Phase 59 — Deployment Enablement.** 5 epics (E254–E258) formalized at user request via `/athena:plan`; scope pre-decided by the user (not a strategist analysis). Theme: give the template two reproducible deploy roads + a one-command tool quick-start, after v0.1.0.

- **E254** Deploy config artifacts — `next-app/zbpack.json` + `.env.example` env matrix; Dockerfile already Cloud-Run-ready. (no deps)
- **E255** Zeabur path + guide (Road 1) — supersede stale `deploy/README`. (deps E254)
- **E256** GCP Cloud Run + Cloud SQL path + guide (Road 2, gcloud, placeholders). (deps E254)
- **E257** deploy-config skill (both roads) + retire stale `deploy-gcr-zeabur`. (deps E255, E256)
- **E258** tool-install quick-start script (`scripts/install-deploy-tools.sh`) + make target. (no deps) — **implemented immediately per user request.**

DAG: E254 + E258 (parallel) → E255 + E256 (after E254) → E257 (after E255+E256). Tooling installed this cycle: Zeabur Claude plugin `zeabur@zeabur` + Zeabur CLI 0.18.0.

---

## Cycle 24 — 2026-06-04 — Mode: register-existing-work

**E216 — `/athena:flow`** registered into the epic ledger (not a strategic proposal — work already built + tested). Origin chain: 9-agent `athena-workflow-integration-v2` analysis (adversarially verified) → brainstorming → spec (`docs/superpowers/specs/2026-06-04-athena-flow-design.md`) → TDD plan (`docs/superpowers/plans/2026-06-04-athena-flow.md`) → implemented on `feat/athena-flow` (commits `d5f9939`→`14e9ef7`, 19/19 fixture test, e201 regression 14/14). Phase 52 (Native Workflow Orchestration), 8 SP. Status: Spec/Impl/QA/Commit ✅, Merge ⬜. Completes the E198–E201 line with a native-engine, budget-enforced, live-tree, no-`claude -p` interactive dispatcher. `/athena:batch` untouched (remains the portable cron/plugin path). **Adversarially validated post-build — 3 correctness bugs found + fixed** (silent wave truncation → chunked batches; cross-agent worktree stranding → fused single worktree-isolated agent per epic; `blocked` mis-marked as failure → stays pending); fixture test 20/20.

---

## Cycle 23 — 2026-06-02 — Mode: auto

### Analysis Summary

**Theme**: "Post-Phase-50 stabilization + Phase 2 plugin foundation — close the two deferred design-system testing contracts (VRT baselines, cross-theme a11y matrix), lay the first foundation slice of the athena-saas-profile plugin (now unblocked by athena-core v0.2.1), and harden the fork story with security + a11y enablement docs."

**Method**: `/athena:plan auto` run as a 4-lens multi-modal sweep (audit · evolve · comply · research) → synthesis → adversarial scope/completeness critic (6 agents, ~780k tokens). Every finding required repo evidence. Critic verdict: **SOLID** — no high-value finding dropped, no scope violation, no speculative @implementer / CI re-arm.

**Filtered as stale (this session's own fixes):** the audit lens surfaced three candidates anchored on `audit.jsonl` 06:13/06:18 timestamps — "plugin sync drift persists (3 files)", "dirty working tree blocks Cycle 23", "v0.2.0 unverified". All three were already resolved by this session's v0.2.1 re-sync (`drift-check` now exit 0; v0.2.1 published). Synthesis correctly dropped all three; **none of the 5 proposals rest on stale evidence**.

**Verified ground-truths (this cycle):**

1. **VRT baselines never captured.** E171 Phase A shipped the 14-page `visual.spec.ts` smoke matrix; the 336-baseline full matrix (14 pages × 6 themes × 2 presets × 2 viewports) was deferred to "first dev-server CI run (Option B)" — `epic-progress.md:251`. No visual ground truth, so any theme/preset rendering regression is invisible to the pipeline. → E211.
2. **A11y validated for one theme only.** E177 shipped a static axe-core check (0 violations) but deferred the dynamic cross-theme/preset matrix (6 themes × 2 presets × 14 pages) — `epic-progress.md:252`. A fork on a different theme/preset could regress WCAG AA undetected. → E212.
3. **Phase 2 plugin is designed but has no foundation.** The 364-line athena-saas-profile design (`docs/superpowers/specs/2026-05-20-athena-saas-profile-design.md`) specifies a registry-composition model (profile self-registers to `~/.claude/athena-profile-registry.json`; core's stop-verifier reads it — the E203 registry-read block already ships in athena-core v0.2.1). The registry schema + install safety gate is the foundation every downstream Phase 2 slice needs. → E213.
4. **Fork security guidance is buried in code.** Production safety exists (`server/app/core/config.py:10-17` placeholder-secret detection) but a fork user has no secrets-setup / OWASP-mapping guide. → E214 (docs).
5. **Fork a11y extension is undocumented.** E177 proved the template a11y-clean but explicitly put extension guidance out of scope (`docs/epics/e177-*.md`); a fork adding domains has no guide for extending the a11y matrix / token contrast / aria patterns. → E215 (docs).

**Scope verdict:** ATHENA-meta-system + template-quality only. No product features. No CI re-arm (E211/E212 capture baselines via a *local* dev-server, not re-armed CI). @implementer not proposed (no harm evidence found in the unscoped implement loop).

### Proposed Epics (max 5)

| # | Epic | Priority | Points | Rationale |
|---|------|----------|--------|-----------|
| E211 | VRT Phase B — 336-baseline visual regression matrix | P1 | 13 | E171 Phase A shipped the 14-page smoke matrix (`visual.spec.ts`); the full 336-baseline matrix (14 pages × 6 themes × 2 presets × 2 viewports) was deferred (`epic-progress.md:251`). Capture all baselines so theme/preset rendering becomes a versioned visual contract no fork can silently break. **Exec note:** needs a live local dev-server (CI is off). |
| E212 | Cross-theme/preset a11y matrix (axe × 6 themes × 2 presets × 14 pages) | P1 | 10 | E177 shipped a static axe-core check (0 violations) but deferred the dynamic matrix (`epic-progress.md:252`). Run axe across 6 themes × 2 presets × 14 pages so WCAG AA is proven theme-invariant, not just for the default theme. Same live-dev-server exec note as E211. |
| E213 | First slice of athena-saas-profile — registry mechanism + install safety gate | P1 | 13 | Phase 2 design is complete (364-line spec) and unblocked by athena-core v0.2.1 (E203 registry-read shipped). Build the foundation: `~/.claude/athena-profile-registry.json` schema + profile `install.sh` safety gate + core-side registry consumption. Every downstream Phase 2 slice depends on it. **The only genuinely-new capability this cycle; fully batch-executable.** |
| E214 | Fork-safe secrets setup + OWASP Top 10 compliance guide | P1 | 15 | Secret-placeholder detection exists (`config.py:10-17`) but forks have no setup/OWASP guide. Write fork-oriented secrets-setup + OWASP Top 10 mapping (Pydantic=A03, JSX-escape=A03 XSS, CORS allowlist=A01). Docs-only. **Critic flag:** demand inferred, not signalled — trim candidate. |
| E215 | WCAG AA extension guide for custom domains | P1 | 8 | E177 proved the template a11y-clean but put fork extension guidance out of scope. Document how a fork extends the a11y matrix, custom-token contrast targets, keyboard-nav + aria patterns. Docs-only; references E212's matrix. **Critic flag:** demand inferred — trim candidate. |

**Budget**: 59 / 80 SP · 5 / 5 epics — within budget. 0×P0, 5×P1. Load-bearing core = E211+E212+E213 (36 SP).

### Risk Assessment

- **E211/E212 (do):** lock the visual + a11y contract so a fork can't silently regress rendering or WCAG AA when it re-themes. **(don't):** the design-system testing story stays half-built (infra without ground truth). **Caveat:** original deferral reason ("first dev-server CI run") still holds — CI is off, so baseline capture needs a hands-on local dev-server + Playwright run; **these two do not fit the headless `/athena:batch auto` cron autopilot.**
- **E213 (do):** turns the Phase 2 plugin from a design doc into a real, installable foundation; unblocks every later profile slice; batch-friendly + no upstream deps. **(don't):** Phase 2 stays theoretical a second cycle despite athena-core v0.2.1 being ready to host it.
- **E214/E215 (do):** make the fork security + a11y story self-serve. **(don't):** forks keep reverse-engineering safety/a11y from code. **Caveat:** critic flagged both as intuition-driven (no demand signal) — lowest-confidence items; trim first.

### Recommendation

**Approve E213 + (E214/E215) for a clean, fully-automatable batch cycle, and run E211/E212 as a separate hands-on local session** — that respects the live-dev-server execution snag rather than feeding it to a headless cron loop that can't capture browser baselines. If you'd rather keep the whole slate together, approve all 5 but plan to drive E211/E212 manually. If the cycle must shrink to its essentials: **E213 is the one genuinely-new, fully-unblocked, batch-executable epic** — it is the highest-value single approval.

### Approval — 2026-06-02

- E211–E215: ✅ APPROVED — direct user approval via `/athena:plan approve all`. Epic files rendered at `docs/epics/e{211..215}-*.md` (5 files, parallel `render-cycle23-epics` workflow). Phase 51 rows added to `epic-progress.md` (Phase Status + Step Matrix + Dependency Rules + Phase Parallelism + Next Action); `EPIC_INDEX.md` regenerated via `scripts/state/render-index.sh` — `check-drift.sh` clean (exit 0).
- **Smoke-test use-cases enriched per user direction (post-render):** E213 install smoke expanded to a 9-case matrix (clean / idempotent / multi-profile coexistence / corrupt-registry fail-closed / root-change upgrade / empty-registry bootstrap / core-missing / `.tmpl` / `jq` gates); E212 gained an interaction-a11y sweep (keyboard nav, focus-trap+Escape, `aria-live` form-error, skip-link, reduced-motion — the axe-blind cases); E211 gained bounded critical-state snapshots (validation-error / invalid-token / empty-list / 404, default-cell only).
- Wave plan: Phase 51 = E211 + E212 + E213 + E214 + E215 (single 5-wide wave; `epic-graph.sh --phase 51` confirms no edges).
- **Execution split:** E213 / E214 / E215 are batch-executable; E211 / E212 require a hands-on local dev-server (Playwright VRT/a11y capture — not headless-cron-able).
- Source workflow: `cycle23-strategist-sweep` (6 agents — audit/evolve/comply/research → synthesis → critic; verdict SOLID). 3 stale audit candidates (pre-v0.2.1-resync drift) correctly filtered by synthesis.
- Next: `!git push origin main`, then `/loop 2m /athena:batch auto` → Phase 51 batch core (E213/E214/E215); run E211/E212 in a manual local session.

---

## Cycle 22 — 2026-06-02 — Mode: auto

### Analysis Summary

**Theme**: "Operationalize the dial — Phase 48 built the effort/cost dial and the Workflow-native QA/batch POCs; Phase 50 makes them *actually deliver* (the ultra tier currently promises a judge panel it never runs, and the cost dial is invisible to metrics), plus closes the two real outstanding debts: a production axios CVE and the never-applied athena-core sync."

**Method**: `/athena:plan auto` — all four sub-modes deduped against post-Cycle-21 ground truth (Cycle 21's E193–E205 all shipped 2026-06-01). Load-bearing claims hand-verified against the repo, not inferred from docs.

**Verified ground-truths (this cycle):**

1. **The dial promises a tier it doesn't implement.** `scripts/effort/resolve.sh` ultra tier exports `ATHENA_VERIFY_POSTURE="judge-panel+adversarial+multimodal"`, but `scripts/qa/verify-panel.sh` only branches on `thorough|ultra` into a *single* path — the thorough 4-lens + adversarial-3 refute panel. There is no judge-panel, no double-evaluator (independent contexts must agree), no spec-judge. So selecting `ultra` silently delivers `thorough`. This is exactly the deferred **E200.1** ("ultra double-evaluator + judge-panel-on-spec"). It is the single highest-leverage "operationalize the dial" gap — the dial's top setting is a no-op above thorough.
2. **The cost dial is invisible.** `resolve.sh` resolves a full `ATHENA_MODEL_MAP` (`reviewer/evaluator` → haiku/sonnet/opus per tier) and concurrency/iteration caps, but the `effort_resolved` audit event carries only `{event, source, tier, ts}` — no `model_map`, no `max_concurrent`, no `verify_posture`. So `/athena:metrics --effort` (E199) can show tier *distribution* but cannot correlate a tier to its actual model spend. The "tier = fan-out × model tier × verification depth" cost story has no data behind it. E207 fixes the event payload + adds a cost-proxy column to the dashboard.
3. **Production axios is on a vulnerable version.** `pnpm audit` (real run this cycle): installed axios is **1.13.6**; advisories require **≥1.15.1** — 7 *high* axios advisories flow into production paths (`--prod` audit: 20 vulns / 7 high), incl. credential theft, full MITM, NO_PROXY bypass, prototype-pollution response gadgets. axios is the *single* production HTTP client (architecture rule). Vite 7.3.1 also carries high dev-server advisories. The remaining 4 critical / bulk-high findings are all `@redocly/cli` build/docs tooling (handlebars / protobufjs / fast-xml-parser) and the vitest UI dev-server — dev/build surface, lower priority but bundled into the same maintenance epic.
4. **The athena-core sync was built but never run.** `make drift-check` → `scripts/sync-to-plugin.sh` dry-run reports **"Drift detected: 106 file(s) differ"** across agents/commands/skills/hooks/memory — confirming Cycle 21's note exactly. E202 (Path B: template canonical) shipped the machinery; nobody ran `--apply` or cut athena-core v0.2.0. The plugin story is presently fiction. E209 runs the apply + version cut (mechanical, the hard decision is already made).
5. **Pipeline events still don't flow (platform constraint, NOT re-proposed as a fix).** Despite E193's emitter, `.claude/audit.jsonl` shows 1 `commit` event and 0 `merge`/`qa_result`/`review_loop`/`autopilot_*` from real runs — PostToolUse(Bash) hook-firing remains the documented platform constraint. E207 deliberately uses the `effort_resolved` event (which *does* fire, via direct `resolve.sh` invocation, not a Bash-tool hook) as its data source, side-stepping the dead pipeline-event path rather than depending on it.

**Scope verdict:** ATHENA-meta-system + security only. No product features proposed (multi-tenancy / billing / admin all out of scope per owner). CI re-arm NOT proposed (owner disabled deliberately 2026-05-20). PostToolUse(Bash) hook-firing NOT proposed as an epic (platform constraint — E207 routes around it instead).

### Proposed Epics (max 5)

| # | Epic | Priority | Points | Rationale |
|---|------|----------|--------|-----------|
| E206 | Ultra-Tier Judge Panel (E200.1 — double-evaluator + spec-judge) | P0 | 18 | Make the dial's top setting real: add a `judge-panel` branch to verify-panel.sh that runs two *independent-context* evaluators which must agree (disagreement → escalate/HUMAN), plus an optional judge-panel-on-spec at ultra. Today `ultra` silently degrades to `thorough` — the most expensive dial setting is a no-op. Reuses the E200 schema-forced-verdict infra; gated behind `ATHENA_VERIFY_POSTURE=judge-panel*`. |
| E207 | Effort→Cost Observability (enrich `effort_resolved` + `/metrics --effort` cost view) | P1 | 10 | Add `model_map`, `max_concurrent`, `verify_posture` to the `effort_resolved` event payload, and a cost-proxy column (model-tier-weighted) to the `/metrics --effort` dashboard so the "cost dial" claim has data. Deliberately sources the one event that actually fires (`effort_resolved`), not the starved pipeline events — works *with* the platform constraint. |
| E208 | Dependency Security Refresh (axios CVE + vite + build-tool advisories) | P1 | 10 | Real `pnpm audit` finding: production axios 1.13.6 → ≥1.15.1 (7 high advisories incl. credential theft / MITM / NO_PROXY bypass); bump vite past its dev-server file-read advisory; isolate or pin `@redocly/cli` (4 critical + bulk-high — handlebars/protobufjs/fast-xml-parser, build/docs only) and vitest ≥4.1.0. Regression gate: full client suite green post-bump. |
| E209 | Apply athena-core Sync + Cut v0.2.0 | P1 | 12 | `make drift-check` confirms **106 files** stale in the sibling `../athena-core`. E202 built `sync-to-plugin.sh --apply` but it was never run. Run the apply, smoke-test install against a clean HOME, version-sync (package.json/plugin.json/marketplace.json), cut v0.2.0, wire `make drift-check` into a periodic guard so it can't silently re-drift. Decision already made (Path B); this is the mechanical execution. |
| E210 | Deploy/Launch Skill Consolidation + Fork-Safety Gating | P2→P1 | 10 | `deploy-gcr-zeabur.md` + `launch-checklist.md` overlap (both own "is it ready to deploy") and both encode *this repo's* owner-specific GCR/Zeabur SOP, which leaks into forks. Merge into one deploy-readiness skill with a fork-safety gate (no-op / generic guidance when repo identity ≠ origin). Promoted from P2 to fill the 5th slot — fork-safety is a genuine template-quality bug, not gold-plating. |

**Budget**: 60 / 80 SP · 5 / 5 epics — within cycle budget. 1×P0, 3×P1, 1×(P2→P1). No standalone P2/P3 consumes a slot.

### Risk Assessment

- **E206 (do):** net-new headless-Claude fan-out at the most expensive tier — token cost is real, but it only fires when the user explicitly selects `ultra`, and E200's spike already proved `claude -p --json-schema` viable. **(don't):** the dial's marquee feature stays vapor; users paying ultra latency/cost get thorough-quality output — a credibility hole in the whole Phase-48 effort-dial story.
- **E207 (do):** trivial payload change + one dashboard column; near-zero risk. **(don't):** the "cost dial" remains an unfalsifiable claim — can't prove ultra costs more or thorough is cheaper, undermining the dial's reason to exist.
- **E208 (do):** dependency bumps can break tests/build (axios 1.13→1.15 minor, low semver risk; vite/vitest majors need a smoke pass). **(don't):** ship a template with 7 high axios advisories in the *production* HTTP path — a security-conscious adopter's first `pnpm audit` fails the template at the door. Highest "embarrassment if found" risk of the cycle.
- **E209 (do):** `--apply` mutates the sibling repo (outside this template) — bounded, reversible via git in athena-core, smoke-tested before version cut. **(don't):** the published plugin stays 106 files / a full cycle behind; anyone installing athena-core gets pre-Cycle-21 athena — the plugin distribution is actively misleading.
- **E210 (do):** skill-merge could regress a deploy SOP the owner relies on — mitigated by keeping the union of both checklists. **(don't):** forks inherit hardcoded GCR/Zeabur owner-specific steps as if generic — a real fork-safety leak (same class as the Cycle-21 skill-drift findings).

### Recommendation

Ship **E206 + E207 together first** — they are the literal "operationalize the dial" core: E206 makes ultra deliver, E207 makes its cost visible, and together they close the Phase-48 loop (built the dial → now prove it both works and costs what it claims). **E208 is the highest-priority *standalone* item** — it is the only finding with external-adopter blast radius (a failing `pnpm audit` on the production HTTP client), so if the cycle must be trimmed, drop E210 (P2-origin) before E208. **E209** is low-intellectual-risk mechanical debt repayment that should not be deferred a *third* cycle — the plugin has been "machinery built, never run" since Cycle 21.

If forced to a single most-important action: **fix the axios CVE (E208).** Everything else is internal polish; the axios advisories are the one item a third party can see and judge the template by.

### Approval — 2026-06-02

- E206–E210: ✅ APPROVED — direct user approval via `/athena:plan approve E206,E207,E208,E209,E210`. Epic files created at `docs/epics/e{206..210}-*.md` (5 files). Phase 50 row added to `epic-progress.md`; `EPIC_INDEX.md` regenerated via `scripts/state/render-index.sh` (E196 mechanism) — `check-drift.sh` clean. Dependency rules + Phase Parallelism updated (all 5 independent → single 5-wide wave).
- Load-bearing facts verified pre-render: axios 1.13.6 in `pnpm-lock.yaml` (E208); `verify-panel.sh:66` collapses `thorough|ultra` (E206); `resolve.sh:166` emits only `{ts,event,tier,source}` (E207); both deploy/launch skills exist (E210); `make drift-check` = 106 files (E209).
- Wave plan: Phase 50 = E206 + E207 + E208 + E209 + E210 (single parallel wave; `epic-graph.sh --phase 50` confirms no edges).
- Next: `!git push origin main`, then `/loop 2m /athena:batch auto` → Phase 50 wave 1.

---

## Cycle 21 — 2026-05-30 — Mode: audit (deep enhancement research — 2-workflow multi-agent audit)

### Analysis Summary

**Theme**: "Foundation Truth before extension — make athena's documented machinery *actually true and instrumented*, then embed a user-selectable effort/Workflow dial, then resolve the template↔plugin fork."

**Method**: Two background multi-agent workflows (ultracode), each ending in an adversarial critique; load-bearing factual claims hand-verified against the repo.
- `athena-enhancement-research` (11 agents) — graded official Claude Code best practices (59 items) against 8 athena subsystems (agents / commands / skills / memory / pipeline / hooks / context-logs / plugin).
- `ultracode-into-athena` (5 agents) — extracted the ultracode effort-tier + Workflow orchestration mechanism and designed native embedding (12 mechanisms, 10 insertion points, 4 tiers).

**Verified ground-truths** (corrected both the synthesis AND its own critique):
1. `.claude/audit.jsonl` is gitignored and emits **only memory events** (35 tier0_loaded, 0 pipeline events). No hook emits commit/merge/review_loop/qa/autopilot_* — so confidence scorers + `/metrics` + memory-liveness all read events nothing produces. **Root-cause unblocker.**
2. CI was **deliberately disabled** (commit c7015b6, 2026-05-20, "manual trigger only"). → No "re-arm CI" epic proposed; merge-truth stays a documented decision, not an imposed gate. Respects owner intent.
3. `EPIC_INDEX.md` genuinely lags `epic-progress.md` (Phase 43/44 headers + E156–E160 commit/merge columns) — the human catalog drifted from the machine state file. Real but smaller than first claimed.
4. Auto-injected skills teach **deleted** patterns (auth-adapter gone E161; "No Tailwind" wrong since E167; tokens point at globals.css with 0 `:root` blocks) and generators emit page CSS that **Stop Rule #21 hard-blocks** (generated pages un-committable).
5. Memory Ebbinghaus loop is 3/4 dead (0 decay / cited / archived); decay only runs on manual `/athena:save` (last 2026-05-07) and has an idempotency bug.

**Decision inputs (owner, 2026-05-30):** record findings as epics; sequence 1→2→3; ultracode embedding depth = full (B) with a **user-selectable** dial (quick/standard/thorough/ultra) and **per-agent model-tiering for cost** (Workflow `agent({model})` + existing per-agent frontmatter → the dial is also a **cost dial**: `tier = fan-out width × model tier × verification depth`).

### Proposals (Phase 47 — 5 epics, 50 SP) — ACTIVE / AWAITING_APPROVAL

| Epic | Name | Size | SP | Priority | Rationale |
|------|------|------|----|----------|-----------|
| E193 | Pipeline-Boundary Event Instrumentation | M | 13 | P0 | Emit commit/merge/review_loop/qa_result/verification_check/autopilot_* into `audit.jsonl` from existing hooks. The single root-cause fix: unblocks autopilot validation, `/metrics`, and memory-liveness at once (all currently starve on an empty log). Dependency-free; everything downstream needs it. |
| E194 | Auto-Injected Skill Drift Purge | S | 8 | P0 | Fix client-patterns.md (adapter→gone; "No Tailwind"→Tailwind; tokens globals.css→themes.css), tdd-workflow.md, frontend-review.md (co-located CSS→primitive-first), openapi-first.md (hardcoded counts→"read the spec"). These inject every session and actively teach deleted patterns. Near-zero risk, high DX leverage. |
| E195 | Generator + Design-System Realignment | M | 8 | P1 | design.md + domain.md must emit Preset-slot/Tailwind styling, not `pages/**/*.css` that Stop Rule #21 blocks (generated pages currently un-committable); repoint token source to design-system.css + themes.css; add the missing primitive-first design-system skill. |
| E196 | State-File Truth (render EPIC_INDEX from epic-progress) | M | 8 | P1 | Generate EPIC_INDEX.md Phase Status + matrix from epic-progress.md (the loop's authoritative state) so the catalog can't drift by construction; small drift detector emitting `state_drift`; fix archive-context.sh H2-vs-H3 counting blind spot. |
| E197 | Memory Loop Closure | M | 13 | P1 | Fix score.sh decay idempotency (write last_retrieved on decay); move decay-all to a once/day SessionStart guard; loop-liveness assertion in `/metrics --memory`; point consolidation-detect at match.sh's tag resolver; add test-isolation guard (fixtures leaked into real Tier 0). |

**Budget**: 50 / 80 SP · 5 / 5 epics — within cycle budget. All P0/P1; no P2 in the active cycle.

### Roadmap (sequenced after Phase 47 — recorded per owner request, NOT yet proposed for approval)

**Phase 48 — Ultracode Orchestration (Cycle 22, sequence step 2)** — the user-selectable effort/Workflow + cost dial:

| Epic | Name | Size | SP | Pri | Note |
|------|------|------|----|-----|------|
| E198 | Effort Dial Foundation (`scripts/effort/resolve.sh` + `ATHENA_EFFORT` + `--effort` flag + per-role model-tier map) | M | 8 | P0 | Biggest payoff / lowest risk. Default `standard` = byte-identical to today (exports the same env vars drivers already read). Ship & observe before any Workflow layer. The cost dial lives here. |
| E199 | No-Silent-Caps Audit + `/metrics --effort` | S | 8 | P1 | Emit `coverage_dropped` only when a cap is actually hit (per critique — not a per-tier confessional); effort-vs-outcome chart. |
| E200 | Workflow-native `/athena:qa` Verification Panel (POC, depth B) | L | 18 | P0 | Gated thorough+. Adversarial-refute + perspective-diverse panel + completeness critic; schema-forced verdicts; model-tiered (cheap lenses, Opus synthesis). Spec phase confirms A-vs-B substrate — B chosen; 1-day spike to de-risk the net-new headless `claude -p --json-schema` infra (zero existing repo usage). |
| E201 | Workflow-native `/athena:batch` Pipeline Dispatch | L | 16 | P1 | Barrier-free `pipeline()` (fast epic commits while slow epic implements); schema'd agent reports (QA can't be silently skipped); effort-driven + model-tiered concurrency; retain Step 3.5 worktree probe at every tier. |

**Phase 49 — Template↔Plugin Resolution (Cycle 23, sequence step 3)**:

| Epic | Name | Size | SP | Pri | Note |
|------|------|------|----|-----|------|
| E202 | Template↔Plugin Decision + Execution | XL | split | P1 | Dogfood athena-core (delete dup assets + install via MIGRATION.md) **OR** declare template canonical + sync/extraction script + drift CI. Binary decision required at spec. Status quo (two diverging copies, non-product copy is the edit surface) is strictly the worst option. |
| E203 | athena-core v0.1.1 Hardening | M | 10 | P2 | Registry-read hotfix to stop-verifier.sh (unblocks profile Phase 2); lesson-tags.json cleanup; install smoke test vs clean HOME; version-sync guard across package.json/plugin.json/marketplace.json. |

**Deferred (not scheduled):** ultra-tier judge panels + multi-epic autopilot waves (P2); deploy/launch skill consolidation + fork-safety gating; a dedicated `@implementer` agent (critique flagged as speculative — pursue only if the unscoped main-session implement loop shows real harm); CI re-arm (owner disabled deliberately — revisit only if "autonomous pipeline" becomes the primary lens).

### State

| Field | Value |
|------|-------|
| State | APPROVED |
| Approved | 2026-05-30 — E193,E194,E195,E196,E197 (Phase 47, 50 SP) via `/athena:plan approve`; Phase 48/49 (E198–E203) rendered under "no limit 5 epics" override |
| Addendum | 2026-05-30 — **completeness audit** (hooks blind-spot + dropped-opportunity critic + product-scope) added **E204** (guard integrity — Rules 18/19/20 fail-OPEN on `feat/E{n}` + self-test canary) + **E205** (doc-truth reconciliation) to Phase 47, and expanded **E193** (M→L 13→16 SP; +Rule 6 read-only +dual-openapi +hook-firing root-cause). Phase 47 now **7 epics / ~69 SP**. Scope verdict: ATHENA-ONLY. Safe micro-fixes done directly in commit `c9f8a47` (pre-bash-guard SQL scoping, rule→lesson backfill, domain.md allowed-tools, dead `domain-expert.md.tmpl` deleted). |
| Epic files | `docs/epics/e{193..205}-*.md` (13 files) |
| Next | `!git push origin main` (user runs — guard blocks docs push), then `/athena:loop` (or `/loop 2m /athena:batch auto`) → Phase 47 wave 1 = E193·E194·E196·E197·E205, wave 2 = E195 (E204 already ✅) |

---

## Cycle 20 — 2026-05-19 — Mode: direct-approval (graft superpowers patterns into athena namespace)

### Analysis Summary

**Theme**: "Workflow Discipline + Memory-Aware Planning — port the high-leverage [obra/superpowers](https://github.com/obra/superpowers/tree/main/skills) patterns into the athena namespace **without duplicating** what athena already does well."

**Source documents**:
- `docs/superpowers/specs/2026-05-18-athena-phase-46-roadmap.md` — Phase 46 roadmap (brainstorm output)
- `docs/superpowers/plans/2026-05-19-e187-athena-plan-brainstorm.md` — E187 implementation plan (writing-plans output)

**Context**: Phase 45 closed the Ebbinghaus retrieve/reinforce/decay/forget loop on Tier 0 memory. Memory is now structurally sound but **passive** — agents *write* lessons but rarely *read* them during design. Meanwhile, `/athena:plan` → `/athena:spec` → `/athena:implement` has a structural gap: there's no design-dialogue gate. Specs get written before the idea is refined, which leads to mid-implementation rework.

The obra/superpowers skill library (14 skills) codifies several disciplines athena lacks: brainstorming, writing-plans (tactical, not strategic), verification-before-completion, receiving-code-review. **Most superpowers patterns overlap with existing athena capabilities** (TDD, dispatching-parallel-agents, using-git-worktrees, systematic-debugging, executing-plans) and porting them creates decision paralysis. Phase 46 cherry-picks **only the 3 patterns athena genuinely lacks** and grafts them onto existing athena primitives (`/athena:plan`, `@strategist`, Stop verifier, `/athena:learn`) instead of adding new top-level commands.

**Decision matrix** (full in roadmap §10 Appendix A):

| Superpowers skill | Action |
|---|---|
| `brainstorming` | **Graft** as `/athena:plan brainstorm` sub-mode (E187) |
| `writing-plans` | **Graft** as enriched `docs/epics/e{n}_{slug}.md` template (Phases + Checkpoints + Test Strategy) (E187) |
| `verification-before-completion` | **Graft** as `skills/verification-discipline.md` + Stop Rule #23 (E188) |
| 11 others | **Skip** — athena equivalents already exist (TDD/batch/worktrees/debugger/loop/reviewer/ship/etc.) |
| visual companion | **Defer** to Phase 47 |

**User directive**: "no limit 5 epics" — invoked but moot. Phase 46 has exactly 5 epics (42 SP < 80 SP budget). Override recorded for traceability with Cycle 19 precedent.

### Proposals (5 epics, 42 SP)

| Epic | Name | Priority | Size | SP | Rationale |
|------|------|----------|------|----|-----|
| E187 | `/athena:plan brainstorm` mode + enriched epic file template | P1 | M | 13 | **Foundation.** Adds Q&A design dialogue inside `/athena:plan` and enriches `docs/epics/e{n}_*.md` template with Implementation Phases / Per-Phase Checkpoints / Test Strategy. Harness script (`scripts/plan/brainstorm-emit.sh`) does deterministic writes; slash command markdown drives the LLM dialogue. Full impl plan already written. Everything else in Phase 46 depends on this. |
| E188 | Verification discipline skill + Stop Rule #23 | P1 | M | 8 | Codifies the "evidence-before-claim" pattern: when an agent commits with completion verbs ("done", "completed", "shipped"), require a `verification_check` audit event in the last 10 min. Whitelist `wip:`/`chore(state):`/`docs:`. Pilot against 50+ historical commits before activation. Independent of E187 — ships in Wave 1. |
| E189 | Memory-aware planning — `@strategist` reads Tier 0/1 during brainstorm | P1 | S | 8 | Reuses E182's `match.sh` tag-matching infra (`min_strength=0.4`, tag overlap ≥1) to surface relevant past lessons during brainstorm dialogue. Audit emits `tier0_loaded {context: brainstorm}`. Closes the "passive memory" gap — Phase 45 retrieve loop now triggers during design, not just at SessionStart. Depends on E187. |
| E190 | Lesson consolidation detector — `scripts/memory/consolidation-detect.sh` + `/athena:learn` Step 4.6 | P2 | S | 8 | Read-only detector. Computes pairwise theme-overlap (Jaccard on tags + cosine on first-paragraph token bags); flags clusters ≥ 0.7. Output: JSON list to `docs/context/promotion-proposals/consolidation-YYYY-MM-DD.md`. Human gate — no auto-merge. Anti-bloat brake complementing `/athena:forget`. Independent. |
| E191 | Cycle integration — `/athena:cycle` + `EPIC_INDEX.md` legend + CLAUDE.md update | P2 | S | 5 | Wire everything in: `/athena:cycle` first step becomes `/athena:plan brainstorm`; CLAUDE.md "Active Epic" + "Slash Commands" sections updated; EPIC_INDEX legend notes enriched epic format. Sequenced last to absorb any breakage from E187–E190. |

**Dependency chain**:
- **E187** (no deps) — foundation
- **E188** (no deps) — independent verification discipline
- **E190** (no deps) — independent consolidation detector
- **E189** depends on E187 (needs brainstorm sub-mode to wrap)
- **E191** depends on E187 + E188 + E189 (integrates all)

### Risk Assessment

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | E187 touches `@strategist` + `/athena:plan` (production-critical) | M | M | Preserve all existing modes byte-identical; brainstorm is purely additive. Snapshot tests of audit/research/comply/evolve/auto outputs before merge. |
| R2 | E188 Stop Rule #23 false positives block legit commits | M | M | Extensive whitelist (`wip:`, `chore(state):`, `docs:`, `chore(memory):`); 10-min audit grace; fixture replay against 50+ existing commits before activation. |
| R3 | E189 memory retrieval injects irrelevant lessons | M | L | Reuse E182 `match.sh`; require `min_strength=0.4` + tag overlap ≥1; graceful no-op on no-match. |
| R4 | E190 consolidation flags valid distinct lessons | L | L | Read-only output. Human gate via `/athena:learn` queue. Zero false positives confirmed on current 8 Tier 0 lessons (they're distinct). |
| R5 | E191 cycle integration introduces hidden state break | L | M | Sequenced last in wave plan. Full regression suite (515 client + 398 server tests) gates merge. |
| R6 | Phase touches `@strategist`, `/athena:plan`, `/athena:learn`, `/athena:cycle` simultaneously | M | M | Wave plan isolates dependencies (Wave 1 only `@strategist`/`/athena:plan` via E187; Wave 2-3 sequenced). |

### Recommendation

**Approve all 5.** Total 42 SP is well under the 80 SP cycle budget; SP-per-epic is bounded (≤13) for parallel-friendly dispatch. The phase has a coherent thesis (workflow discipline + memory activation) and a clear graft-not-duplicate boundary. The foundation epic (E187) has a complete impl plan already written — fast path to first merge.

### Approval — 2026-05-19

- E187–E191: ✅ APPROVED — direct user approval via `/athena:plan approve E187,E188,E189,E190,E191`. Epic files created at `docs/epics/e187-athena-plan-brainstorm.md`, `e188-verification-discipline.md`, `e189-memory-aware-planning.md`, `e190-lesson-consolidation-detector.md`, `e191-cycle-integration.md`. Phase 46 row added to `epic-progress.md` + `EPIC_INDEX.md`.
- Approval mode: **direct**. Source documents (roadmap spec + E187 impl plan) pre-computed via `superpowers:brainstorming` + `superpowers:writing-plans` skills.
- "No limit 5 epics" override invoked but moot — Phase 46 has exactly 5 epics.

### Post-Approve Completeness Audit — 2026-05-19

Re-examined the roadmap spec, E187 impl plan, and project conventions for gaps not covered by E187–E191. Six candidate epics evaluated:

| # | Candidate | SP | Verdict | Reason |
|---|---|---|---|---|
| C1 | Brainstorm session snapshot tests (@strategist Q&A flow) | 5 | **SKIP** | LLM-driven dialogue is not unit-testable without significant mocking infra. The deterministic part (harness) is already covered by E187's 7-fixture test suite. Skill-instruction enforcement covers the protocol. |
| C2 | Bilingual user guide for brainstorm-first workflow (`docs/guides/{en,zh-TW}/brainstorm-first.md`) | 3 | **PROPOSE → E192** | Project convention (~10 bilingual guides each side, see `docs/guides/en/`). Track B fork users explicitly expect this per CLAUDE.md "Fork 後客製化提示". Independent of E187–E191. |
| C3 | Memory-aware audit/research/comply/evolve modes (extend E189 beyond brainstorm) | 8 | **DEFER** | Scope creep — different retrieval patterns (codebase audit, web search) vs. brainstorm's dialogue-time retrieval. Belongs in Phase 47 or 48. |
| C4 | Tier 0 promotion for "brainstorm-first plan workflow" pattern | 2 | **SKIP** | Premature — E183 promotion-follow-through detector flags promotions ≥30d old with zero retrieval signals. Wait for natural `/athena:promote` cycle after Phase 46 ships. E191 already creates the candidate file. |
| C5 | JSON schema validation for brainstorm input | 3 | **SKIP** | YAGNI. E187 plan Task 5 Step 1 already guards required fields (epic / slug / name). Full JSON schema is overkill for a v1 internal interface used only by `@strategist`. |
| C6 | Brainstorm session resumption (resume from interrupted `/tmp/brainstorm-<epic>.json`) | 5 | **DEFER** | Real but rare risk. Defer to Phase 47 as quality-of-life if interrupts become common. Not foundational. |

**Recommendation: 1 additional epic — E192 (bilingual user guide)**. Phase 46 grows from 5 epics / 42 SP → 6 epics / 45 SP. Still well under 80 SP cycle budget.

### Proposed E192 (one-line spec)

| Epic | Name | Priority | Size | SP | Rationale |
|------|------|----------|------|----|-----|
| E192 | Bilingual User Guide for Brainstorm-First Workflow | P2 | S | 3 | Author `docs/guides/en/brainstorm-first.md` + `docs/guides/zh-TW/brainstorm-first.md` per existing 10-guide bilingual convention. Documents `/athena:plan brainstorm` flow + memory-aware retrieval (E189) + enriched epic file format. Track B fork users need this; CLAUDE.md alone is insufficient (CLAUDE.md is project-identity, not user-onboarding). Independent — no deps. Ships in Wave 1 alongside E187/E188/E190. |

### E192 Approval — 2026-05-19

- E192 ✅ APPROVED — direct user approval via `/athena:plan approve E192`. Epic file created at `docs/epics/e192-brainstorm-user-guide.md`. Phase 46 row updated in `epic-progress.md` + `EPIC_INDEX.md` (5 epics → 6 epics; 42 SP → 45 SP; Wave 1 now 4 epics parallel).
- Audit-recommended addition; ships in Wave 1 alongside E187 + E188 + E190 (4-way parallel via `/athena:batch auto`).

### Alignment Audit — 2026-05-19 (post-approve, pre-implement)

After initial approval, audited all 6 epic files + roadmap doc against the actual codebase. **2 misalignments fixed in-place** (this commit):

1. **roadmap §11 Q1 — `docs/templates/epic-template.md`**: referenced as if it existed, but it does NOT (audit confirmed). The canonical epic template is **inline in `.claude/commands/athena/plan.md`** § "approve E{n}" Step 2 description. Updated Q1 to reflect: the enrichment lands inline in `plan.md`, not a separate file.
2. **E189 — `match.sh --context=brainstorm`**: referenced as if `match.sh` had a `--context` flag and as if E182 had added a `context` field to the `tier0_loaded` event schema — **both false** (verified by reading `scripts/memory/match.sh` and `scripts/hooks/CLAUDE.md`). `match.sh` scores ONE lesson at a time; loop happens in the caller (E182's `inject.sh`). The `tier0_loaded` schema currently has `{ts, event, lesson, agent, epic}` only — no `context`. Fixed E189 to:
   - Introduce a new orchestrator `scripts/memory/brainstorm-retrieve.sh` (parallel to `inject.sh`) that loops over Tier 0 and calls `match.sh` per lesson
   - Acknowledge that adding `context` to `tier0_loaded` is a schema extension and bring it into E189's scope (additive, backward-compatible)
   - Update Key Files + Implementation + AC sections accordingly

Cross-checked clean (no fix needed): E187 file list, E188 paths, E190 `promotion-proposals/` exists, E191 CLAUDE.md section names exist, E192 guide paths exist, all dependency chains, all SP totals.

### Sequencing Recommendation

```
Wave 1 (parallel, max-concurrent 3):
  ├─ E187  /athena:plan brainstorm + enriched epic file template
  ├─ E188  Verification discipline + Stop Rule #23
  └─ E190  Lesson consolidation detector
  Rationale: no inter-deps. Use /athena:batch auto for parallel dispatch.

Wave 2 (sequential — only E189 here):
  └─ E189  Memory-aware planning
  Rationale: depends on E187's brainstorm sub-mode existing.

Wave 3 (sequential — only E191 here):
  └─ E191  Cycle integration
  Rationale: depends on E187, E188, E189. Sequenced last to absorb breakage.
```

After approval, expected command sequence:

```bash
git push origin main
/loop 2m /athena:batch auto   # auto-detects Wave 1, dispatches parallel
```

Expected: ~2-3 days wall-clock for 5 epics (Phase 45 cadence).

### Related Artifacts From This Session

- `docs/superpowers/specs/2026-05-18-athena-phase-46-roadmap.md` — full Phase 46 roadmap (committed `e093e74`)
- `docs/superpowers/plans/2026-05-19-e187-athena-plan-brainstorm.md` — E187 implementation plan (11 tasks, ~700 lines, complete TDD code)

Per-epic files will be created on `/athena:plan approve` per existing safety rules (NEVER create epic files without human approval).

### Out of Scope (deferred to Phase 47+)

- Dev system tooling (faster TDD, e2e scaffolding, type sync) — separate theme
- TDD / debugging / parallel-dispatch ports from superpowers — athena equivalents already exist
- Cross-project memory sync, embeddings — Phase 45 strength scores need ~30 days to settle
- Visual companion for `@strategist` brainstorm — cut from Phase 46 budget; novel + risky
- Cross-project lesson similarity clustering — depends on embedding work
- Auto-merge of consolidated lessons — human gate required for now (E190 = detector only)

---

## Cycle 19 — 2026-05-05 — Mode: direct-approval (mechanism transfer from human-memory science)

### Analysis Summary

**Theme**: "Memory Mechanism Maturity — close the Ebbinghaus retrieval/reinforcement/decay loop."

**Context**: The current Athena memory system implements 2 of 5 Ebbinghaus phases — encode (`[GENERALIZABLE]` tags) and store (`/athena:promote --apply` → Tier 0). The remaining three — **retrieve, reinforce, decay** — are unimplemented. Tier 0 grows monotonically (15 files / 4,085 lines and rising); the system has no signal which lessons get loaded, which trigger stop-verifier rules, which sit unread for 90 days. Without retrieval data, every downstream improvement (selective inject, strength scoring, forgetting) is impossible.

The mechanism transfer source: human-memory science (Ebbinghaus forgetting curve + retrieval-based reinforcement). Cued recall, retrieval-as-strengthening, and decay-without-erasure all map cleanly onto a harness-engineering pipeline. Build retrieval logging first (E180), accumulate 4–6 weeks of data, then design the decay curve from observation rather than a priori.

**User directive**: "No limit 5 epics" — override the standard 5-cap because the work is one coherent system (foundation → frontmatter → policy → consumers → metrics). Splitting it across two cycles would force dependency-bridge stubs.

---

### Proposals (7 epics, 24 SP)

| Epic | Name | Priority | Size | SP | Rationale |
|------|------|----------|------|----|-----|
| E180 | Memory Retrieval Logging (Ebbinghaus foundation) | P0 | S | 3 | Foundation: emit `tier0_loaded` / `rule_fired` / `agent_cited` to `.claude/retrieval.jsonl`. Every downstream epic depends on this signal existing. Ship first, gather data, defer decay-curve design until data is in. |
| E181 | Lesson Strength Score (decay + reinforcement) | P0 | M | 5 | YAML frontmatter on Tier 0 files: `strength`, `last_retrieved`, `retrieval_count`, `half_life_days`. Decay equation + reinforcement signals from E180 events. Threshold-flag for `/athena:learn`. |
| E182 | Selective SessionStart Injection (cued recall) | P1 | M | 4 | Replace bulk `NEW_PROJECT_PRIMER.md` dump with branch-scoped match against frontmatter `tags` + `domains`. Caps inject at 200 lines; preserves bulk-fallback for first-clone UX. |
| E183 | Promotion Follow-Through (premature promotion detection) | P1 | S | 3 | `/athena:learn --promotions` flags Tier 0 lessons promoted ≥30d ago with retrieval_count=0. Surfaces "premature promotion candidates" without auto-action. Tunes the proposer (E158) over time. |
| E184 | `/athena:forget` Command (forgetting as a feature) | P1 | M | 4 | Mirror `/athena:promote`. Archives (not deletes) lessons with `S < threshold` to `_archive/` with rolling `forgotten.md` log. `--revive` round-trips. Always human-gated. |
| E185 | Half-Life Metadata at Promotion (calibrate decay rate) | P0 | S | 2 | `@memory-curator` assigns `half_life_days` per category (architectural=365 / stack=180 / process=180 / incident=30 / tooling=90). Backfill 15 existing files. The single most important parameter. |
| E186 | Memory Metrics Dashboard (`/athena:metrics --memory`) | P2 | S | 3 | Single human-readable view: top-N retrieved, never-retrieved, strength histogram, half-life distribution, stop-verifier citation map, cadence health. Read-only over E180/E181/E184 outputs. |

**Dependency chain**:
- Foundation: **E180** (no deps), **E185** (no deps; ships in parallel — frontmatter migration is shared work with E181)
- Wave 2 (after E180+E185): **E181** (strength score), **E182** (selective inject), **E183** (follow-through), **E186** (metrics) — all depend on E180; E182 also reads E181 strength as tie-breaker
- Wave 3 (after E181): **E184** (forget) — needs strength threshold

### Approval — 2026-05-05

- E180–E186: ✅ APPROVED — direct user approval after session-side mechanism analysis. Spec files created in `docs/epics/e180-..` through `e186-..`. Phase 45 added to `epic-progress.md` + `EPIC_INDEX.md`.
- Approval mode: **direct**. Strategist analysis pre-computed in conversation; written down here for posterity.
- Out-of-scope across the phase: cross-machine sync, semantic embeddings, auto-decay-curve learning, hard delete, project-Tier-1 tracking (Tier 1 has its own E160 auto-compact policy already).

### Sequencing Recommendation

```
Wave 1: E180 + E185 (parallel, no deps)
Wave 2: E181 + E183 + E186 (parallel, all depend on E180)
        E182 (depends on E180+E181 — start after E181 begins)
Wave 3: E184 (depends on E181)
```

`/athena:batch --phase 45` should fan out E180+E185 first. After they merge, second wave runs E181 / E183 / E186 in parallel. E182 follows once E181's frontmatter migration lands. E184 is last.

### Related Artifacts From This Session

- `docs/epics/e180-memory-retrieval-logging.md` — Ebbinghaus foundation
- `docs/epics/e181-lesson-strength-score.md` — decay equation + reinforcement signals
- `docs/epics/e182-selective-sessionstart-injection.md` — cued-recall via branch diff
- `docs/epics/e183-promotion-follow-through.md` — `/athena:learn --promotions`
- `docs/epics/e184-athena-forget-command.md` — archival (not deletion); revive round-trip
- `docs/epics/e185-half-life-metadata-at-promotion.md` — file-category → half-life mapping
- `docs/epics/e186-memory-metrics-dashboard.md` — `/athena:metrics --memory`

### Alignment Audit — 2026-05-05 (post-plan, pre-implement)

After initial plan, audited all 7 specs against the actual codebase. **8 misalignments fixed in-place** (commit subsequent to the planning commit):

1. **E180 — hook filename**: `post-subagent-stop.sh` (didn't exist) → `subagent-stop-writeback.sh` (real, already emits `agent_complete`).
2. **E180 — events file**: separate `.claude/retrieval.jsonl` (premature) → existing `.claude/audit.jsonl` (precedent: E146 `agent_complete`). One file, one query surface.
3. **E180 — SessionStart inject reality**: today's hook injects only `NEW_PROJECT_PRIMER.md` (not 15 individual files). Acceptance criteria adjusted to reflect this.
4. **E180 — rule citation**: stop-verifier rules don't carry lesson refs. Added explicit `scripts/hooks/rule-to-lesson.json` map (manually curated, starts with rules 18–22).
5. **E181/E182/E185 — frontmatter ownership**: three epics modify the same YAML block. Now explicit: E181 owns the migration; E182 adds `tags`+`domains`; E185 sets `half_life_days`. Migration order documented.
6. **E182 — relationship to PRIMER**: was "replace bulk dump". Reality: PRIMER is curated and load-bearing. Now: two-block inject — Block A (PRIMER, unchanged) + Block B (cued category excerpts, new).
7. **E183 — promotion-proposals path**: `docs/context/promotion-proposals/archive/` (didn't exist) → actual files at `docs/context/promotion-proposals/*.md` + `archive-<ts>.md` (E160's pattern).
8. **E184 — `.claude/skills/athena-*/`**: not a pattern in this repo. Dropped; only `.claude/commands/athena/forget.md`.
9. **E185 — half-life rubric**: was abstract 5-row taxonomy. Aligned with `@memory-curator`'s actual 8 category files — categorization already happens, half-life now follows from the category. No new rubric for the curator to learn.
10. **E186 — flag interface**: clarified composability with existing `--epic` + `--since` from E146; preserved "no side effects" guardrail.

Net result: 7 epics now reference real filenames, real hook names, real paths, and align on a single shared frontmatter schema with documented migration order.

---

## Cycle 18 — 2026-04-15 — Mode: direct-approval (self-review)

### Analysis Summary

**Theme**: "Hardening — QA Gate Enforcement" — mechanize the `implement → qa → commit` contract with a filesystem-level refusal.

**Context**: A self-review of `.claude/commands/athena/batch.md` this session revealed that the command had no explicit anti-skip rule for QA — it relied entirely on implicit step ordering in `docs/context/epic-progress.md`. The gap was back-ported from `ai-casino-shift`'s hardened batch.md (four soft guards added: Step Delegation Rules, Mandatory Pipeline Order section, explicit after-implement→qa dispatch, safety guard #6). `/athena:loop` received a matching one-line tightening.

However, all four added guards depend on agent obedience. A subagent that misinterprets the spec, a hand-edit to the state file, or a future refactor that removes a guard can silently undo the contract. No filesystem-level check currently prevents `implement → commit` when the hooks run.

**Resolution**: E155 — Stop Verifier Rule #18 — adds a shell-level guard that refuses Stop events on `feat/e[0-9]+-*` branches when `impl=✅ ∧ qa ∈ {⬜, ❌}` in `epic-progress.md`. Moves the guarantee from "agent obedience" to "shell-script refusal" — the only layer immune to spec-interpretation errors.

---

### Proposals (1 epic, 3 SP)

| Epic | Name | Priority | Size | SP | Rationale |
|------|------|----------|------|----|-----|
| E155 | Stop Verifier Rule #18: QA Gate Enforcement | P0 | S | 3 | Mechanize the Mandatory Pipeline Order contract. Defense-in-depth: four soft spec guards (agent-obeyed) + one hard hook guard (filesystem-enforced). Companion to the batch.md / loop.md work in the same session. |

**Dependency chain**: None — self-contained

### Approval — 2026-04-15

- E155: ✅ APPROVED — spec file `docs/epics/e155-stop-verifier-rule-18-qa-gate.md` already created during self-review (contains full pseudocode, 6 test cases, acceptance criteria). Scope: shell rule + test fixture + 2 doc updates. Non-goals: no changes to existing rules, no changes to epic-progress.md format, no pre-commit hook (Stop verifier is the agreed enforcement surface).
- Approval mode: **direct**. No `/athena:plan` proposal phase — the gap was identified and specced during an interactive code review session, not during a normal planning cycle.

### Related Artifacts From This Session

- `.claude/commands/athena/batch.md` — 4 soft guards added (Step Delegation Rules, Mandatory Pipeline Order section, explicit after-implement→qa dispatch, safety guard #6)
- `.claude/commands/athena/loop.md` — safety guard #5 (mandatory pipeline order one-liner)
- `.claude/commands/athena/qa-enforcement-pattern.md` — portable reference doc for cross-project learning
- `docs/epics/e155-stop-verifier-rule-18-qa-gate.md` — the approved epic spec (Phase 39)
- `~/.claude/template-memory/workflow-patterns.md` — new entry: "Four-Guard Redundancy for Orchestrator Pipeline Contracts"
- `~/.claude/template-memory/anti-patterns.md` — new entry: "anti-020: Never Rely on Implicit Pipeline Order in Orchestrator State Files"

---

## Cycle 17 — 2026-04-09 — Mode: audit (harness-layer gap analysis)

### Analysis Summary

**Theme**: "Harness Engineering — Observability & Evaluation" — audit of the 6-layer harness framework (information boundaries, tool management, execution orchestration, memory/state, observability, constraints) identified Layer 5 (Observability/Evaluation) as the weakest. The system has mature scoping, orchestration, and constraint layers, but lacks quantitative visibility into agent-level reliability and independent acceptance verification.

**Context**: 145 epics complete (E0–E144), 37 phase groups, 16 strategy cycles. 499 tests (269 server + 230 client). 9 agents, 18 commands, 10 skills, 17 verifier rules. Strategy Cycle 16 delivered cross-project wisdom from 5 sibling projects (E125–E144). Prompted by user analysis of Prompt → Context → Harness Engineering evolution and Anthropic/OpenAI harness patterns.

---

#### AUDIT MODE — Harness Layer Gap Scan

**Finding 1 (P0): No context degradation detection in long sessions**

Bash hooks cannot introspect Claude's token count directly, but cumulative proxies (tool-call count, bytes read) are measurable via audit.jsonl. Currently no hook tracks session-level metrics or warns when context pressure mounts. Stop verifier catches quality drops reactively — no proactive "Context Reflect" signal (Anthropic pattern: restart with fresh agent beats history compression).

**Finding 2 (P0): No agent-level success metrics**

The audit.jsonl captures bash commands but not agent outcomes. Cannot answer: "which agent fails most?", "what's @debugger's avg duration?", "which epics trigger the most retries?". Blocks data-driven harness tuning. SubagentStop hook exists (timestamps write-backs) but doesn't emit aggregatable events.

**Finding 3 (P1): Generator/Evaluator coupling in @qa**

`@qa` both runs tests AND judges quality — same-agent self-evaluation is a known weakness. Acceptance criteria drift from specs can slip past when the executing agent also validates. Anthropic's "independent evaluator" pattern prescribes a split: one agent generates, another (clean context) evaluates against the original spec.

---

### Proposals (3 epics, 11 SP)

| Epic | Name | Priority | Size | SP | Rationale |
|------|------|----------|------|----|-----|
| E145 | Context Health Monitor | P0 | S | 3 | Measurable proxies (tool calls + bytes read) from audit.jsonl; warn at 200/500KB, critical at 400/1MB. Non-blocking PostToolUse hook. |
| E146 | Agent Metrics + /athena:metrics | P0 | M | 4 | SubagentStop hook emits agent_complete events; /athena:metrics aggregates per-agent runs, success rate, duration, retries. |
| E147 | Evaluator Agent (@evaluator) | P1 | M | 4 | Independent acceptance tester (read-only tools enforce Generator/Evaluator split); Phase 4 of /athena:qa. New evaluation-log.md. |

**Dependency chain**: E145 → E146 → E147 (sequential)

### Approval — 2026-04-09

- E145: ✅ APPROVED — scope refined from initial 70%/85% token proxy to measurable tool-call + bytes-read thresholds (bash hooks cannot introspect tokens)
- E146: ✅ APPROVED — scope refined: audit.jsonl already works (gitignored per-session); real gap is agent-level events + aggregation
- E147: ✅ APPROVED — as-is, read-only enforcement via `allowed-tools`
- Out-of-scope constraint: no e2e tests, no /athena:audit integration (per user directive)
- Spec files created: `e145-context-health-monitor.md`, `e146-agent-metrics.md`, `e147-evaluator-agent.md`

---

### Full Harness Framework Analysis (Session Ideas & Raw Analysis)

Prompted by user-provided analysis of "Prompt → Context → Harness Engineering" evolution with 6-layer framework and Anthropic/OpenAI patterns. Performed deep audit against all 6 layers.

#### Layer-by-Layer Maturity Assessment

| Layer | Maturity | Evidence |
|-------|----------|----------|
| 1. Information Boundaries & Roles | **Advanced** | 9 agents with YAML frontmatter, `allowed-tools` scoping, designated write-back docs, SessionStart context trimming (only active phase injected) |
| 2. Tool System Management | **Advanced** | Agent-scoped tool allowlists (e.g., @reviewer has no Write), 8 lifecycle hook events, `pre-bash-guard.sh` blocks destructive commands (exit 2) |
| 3. Execution Orchestration | **Advanced** | 18 slash commands, `epic-graph.sh` DAG + wave scheduling, `/athena:batch` worktree isolation (4 concurrent), retry with circuit breaker (E88), post-wave integration gate (E91) |
| 4. Memory & State Management | **Advanced** | 3-tier memory (Tier 0 global / Tier 1 project / session state), `/athena:save` simultaneous checkpoint, `[GENERALIZABLE]` promotion pipeline |
| 5. Observability & Evaluation | **Moderate** 🟡 | JSONL audit log + webhook exist but lack agent-level events; no independent Evaluator; no success-rate aggregation → **ADDRESSED BY PHASE 37** |
| 6. Constraints, Validation & Recovery | **Advanced** | Stop verifier 17 rules (retry verifier pattern: 70% × 4 retries → 99%), pre-deploy 9 gates, `post-bash-failure-inject.sh` with 12 known patterns |

**Verdict**: 5 of 6 layers Advanced. Layer 5 is the clear bottleneck.

#### Anthropic/OpenAI Patterns Referenced

1. **Context Reflect** (Anthropic): when context fills, restart with fresh agent beats compressing history. Like restarting a process on memory leak. → E145 implements a proxy-based early warning.

2. **Independent Evaluator** (Anthropic): Generator agent ≠ Evaluator agent. The executing agent cannot objectively judge its own output against the spec. → E147 implements the split.

3. **Directory-ize Prompt** (OpenAI): instead of one giant agent.md, expose a minimal index and load specific design/security docs on-demand. → Already practiced by our SessionStart hook (only injects active phase) + agent batch-reading pattern.

4. **Retry Verifier Pattern** (referenced in `stop-verifier.sh`): heuristic rules at 70% accuracy become 99% reliable with 4 retries. → Already implemented — 17 stop-verifier rules.

#### Dev-Speed Impact Assessment

When asked "Does this affect dev speed?", honest answer: **2 of 3 gaps do, 1 is marginal**.

| Gap | Speed Impact | Mechanism |
|-----|--------------|-----------|
| Context degradation | **High** | Long sessions cause late-session mistakes → stop-verifier catches them → fix-retry loop consumes time. Proactive warning prevents the cycle. |
| Agent metrics blindness | **Medium** | Can't optimize what we can't measure. Compounds over months — without data, harness tuning is guessing. |
| No independent Evaluator | **Low-Medium** | Stop verifier + @qa already catch most issues. Generator/Evaluator split is best-practice but not on the critical path. |

#### Ideas Considered but NOT Promoted to Epics

1. **Auto-spawn fresh agent on context critical** — instead of just warning (E145), have the hook actually terminate and re-dispatch. Rejected: too aggressive, breaks current task flow. Warning + user action is safer.

2. **Known-pattern accuracy tracking** — measure success rate of `post-bash-failure-inject.sh` pattern matches. Rejected as standalone epic: would require instrumenting the retry loop; fold into E146's general metrics.

3. **Merge conflict auto-bisect** — when E91 integration test fails post-merge, auto-bisect to identify which epic broke. Rejected: moderate effort, rare occurrence, manual triage already works.

4. **Stop verifier warning → blocking upgrade** — promote the 9 advisory rules to blocking. Rejected: would create too much friction; warnings exist for a reason (advisory signals, not bans).

5. **Cross-session metrics aggregation** — persist audit.jsonl to tier-0 global storage for long-term trends. Rejected: audit.jsonl is deliberately per-session/gitignored for privacy; aggregation lives in `/athena:metrics` output which users can snapshot manually.

#### Infrastructure Corrections Found During Audit

- **CLAUDE.md template vars unreplaced**: `{{PROJECT_DISPLAY}}` and `{{PROJECT_DESCRIPTION}}` were never substituted → fixed in commit `badd592`
- **session-summary.md severely stale**: showed Phase 30 / E0–E111 / Cycle 15; reality was Phase 36 / E0–E144 / Cycle 16 → fixed in commit `2096129`
- **session-summary.md count drift**: commands 17→18, skills 8→10, stop verifier 12→17 rules → fixed in commit `2096129`
- **False claim "audit.jsonl empty is a bug"**: actually gitignored and per-session (expected) → corrected in commit `badd592`
- **Removed `.github/workflows/audit.yml`**: weekly security audit workflow removed per user directive (this cycle)

#### Future Harness Directions (Beyond Phase 37)

Not epics yet, but patterns worth tracking for future cycles:

- **Dynamic tool allowlists**: today `allowed-tools` is static per-agent. A future agent could tighten its own tool access mid-task based on phase (e.g., "now I'm reviewing, drop Write").
- **Context-aware agent dispatch**: `/athena:qa` could choose between @qa and a lightweight @qa-fast based on diff size.
- **Tier-0 harness wisdom bucket**: promote harness-level lessons (not code lessons) into a new Tier 0 file `harness-patterns.md` alongside `failure-patterns.md`, `architecture-lessons.md`, etc.
- **Hook composition DSL**: current hooks are independent bash scripts. A small DSL to compose them (e.g., "run X only if Y passed") would reduce duplication.

---

## Cycle 14 — 2026-03-30 — Mode: auto

### Analysis Summary

**Theme**: "Production Readiness & Template Polish" — after 28 phases of feature development, testing mastery, documentation enrichment, and agent infrastructure, the template has deep capabilities but several operational gaps remain. This cycle focuses on what a developer cloning this template would hit within their first week of real use: stale tracking docs, missing environment validation at runtime, no structured error monitoring beyond Sentry DSN, and no "template customization complete" verification.

**Context**: 102 epics complete (E0–E101), 30 phase groups, 13 strategy cycles. 491 tests (247 server + ~226 client + 18 E2E implied), all passing. 9 agents, 17 commands, 8 skills, 12 verifier rules. Phase 28 just delivered testing mastery (contract tests, hypothesis, triangulation, QA audit scoring). The template is feature-rich but has accumulated operational debt from rapid iteration.

---

#### AUDIT MODE — Codebase Weakness Scan

**Finding 1 (P0): `test-status.md` is severely stale — shows 28 server tests, reality is 247+**

The `docs/context/test-status.md` file has not been updated since early development. It lists 28 server tests in 9 files and says "client tests not started." Reality: 40 server test files with ~247 test functions (unit + integration + contract + hypothesis), 36 client test files with ~226 tests, plus E2E. The "Test Quality Metrics" section has never been populated ("no runs yet"). The "Next Action" section says "Begin client/ test infrastructure" — which was completed many phases ago. This file is the @qa agent's primary write-back document and it gives completely wrong information to any agent or human reading it.

**Finding 2 (P1): No runtime environment validation beyond `make doctor`**

`make doctor` checks tools and env vars at development time, but there is no runtime startup validation. The server starts even with `CHANGE_ME` default secrets in production. The `config.py` has `_PLACEHOLDER_VALUES` detection but only for `_is_test_env()` gating — production startup with default secrets silently works. A developer deploying this template could accidentally go live with insecure defaults. Need: fail-fast on startup if `SECRET_KEY` is a placeholder and `ENVIRONMENT=production`.

**Finding 3 (P1): No health check dashboard or structured error tracking beyond Sentry DSN**

The template has `GET /health` with DB probe and Sentry SDK integration, but no structured health check page for operators. The `/getting-started` page checks env but only for initial setup. There is no admin-visible health dashboard showing: DB connection status, email provider status, OAuth config status, queue health, uptime. Competing SaaS templates (e.g., SaaS Boilerplate, Shipped, Bedrock) include admin dashboards with system health views.

**Finding 4 (P1): `session_cleanup` task runs in lifespan but sessions table was removed**

The `main.py` lifespan still spawns `cleanup_loop` from `app.tasks.session_cleanup` and references `SESSION_CLEANUP_INTERVAL_MINUTES` config. But session-based auth was removed in favor of stateless JWT. This is dead code that runs on every server start — a maintenance trap and confusion source for template cloners.

**Finding 5 (P2): No `make customize` or post-clone verification**

`make reset` strips template state, but there is no `make customize` that walks a developer through: setting project name, updating OpenAPI title, configuring email provider, choosing OAuth providers, setting up Zeabur project. The `make new-site` interactive CLI exists but does not verify completion. A "customization checklist" command that validates all placeholder values are replaced would catch common clone mistakes.

**Finding 6 (P2): Proxy config in `vite.config.ts` hardcodes localhost:8080**

The Vite dev proxy routes `/auth`, `/users`, `/health` to `http://localhost:8080`. This is not configurable via env var. Developers using non-standard ports or Docker networking must manually edit the config. Minor friction but repeated by every cloner.

**Finding 7 (P3): `docs/context/` write-back documents have uneven quality**

`strategy-log.md` (this file) and `session-summary.md` are well-maintained. `test-status.md` is severely stale (Finding 1). `review-findings.md`, `debug-log.md`, `deploy-log.md`, `spec-log.md` — some may have similar staleness. Agent write-back discipline varies.

---

#### RESEARCH MODE — Competitive Gap Analysis

**What competing SaaS templates have that this one lacks:**

1. **Stripe/billing integration out of the box** — Most paid SaaS starters (ShipFast, SaaS Boilerplate, Shipped) include Stripe subscription management. This template has a `billing/` domain placeholder but no actual Stripe integration. (Already tracked as future work; not proposing this cycle — too large.)

2. **Admin panel** — CRUD admin for users, viewing audit logs, managing feature flags. The dashboard exists but is client-side only with static content. No actual admin API endpoints.

3. **Feature flags** — Environment-based or database-backed feature toggles. Not present. Common in production SaaS but may be too app-specific for a template.

4. **Background job queue** — Celery/ARQ/SAQ for async work (emails, webhooks, data processing). Currently emails are sent inline. The `session_cleanup` uses `asyncio.create_task` which is fragile for production.

5. **Multi-tenancy patterns** — Row-level security or schema-per-tenant. Not present but highly template-relevant since most SaaS apps need it.

**Highest-impact for a template cloner right now**: Clean up dead code, fix stale docs, add runtime safety checks. These are low-effort, high-trust improvements. Stripe/admin/multi-tenancy are large features for a future cycle.

---

#### EVOLVE MODE — Dependency & Pattern Modernization

**Dependency check:**
- FastAPI >=0.115.6 — current stable is 0.115.x, fine
- Pydantic >=2.10.4 — current, no action needed
- SQLAlchemy >=2.0.36 — current stable is 2.0.x, fine
- React 18.3 — React 19 is available but still early for templates; stay on 18
- Vite — using latest v5/v6, fine
- Node 22 — current LTS, correct
- Python 3.12 — 3.13 is available but 3.12 is safer for template stability

**Pattern modernization opportunities:**
- The `session_cleanup` dead code should be removed (Finding 4)
- `fastapi-users >=14.0.0` — current is v15; already compatible
- Consider adding `ruff` as primary linter if not already present (faster than flake8/mypy combo)

**No urgent dependency upgrades needed.** The stack is modern and well-chosen.

---

### Proposed Epics (5)

| # | Epic | Priority | Points | Size | Rationale |
|---|------|----------|--------|------|-----------|
| E102 | Context Document Hygiene — test-status.md & Write-Back Refresh | P0 | 8 | M | Fix severely stale `test-status.md` (28→247+ server tests, 0→226 client tests). Populate Test Quality Metrics with actual first run. Audit all 8 agent write-back docs for staleness. Establish write-back accuracy as a verifier check. Findings 1 + 7. |
| E103 | Dead Code Removal & Lifespan Cleanup | P0 | 5 | S | Remove `session_cleanup` task, `SESSION_CLEANUP_INTERVAL_MINUTES` config, and lifespan cleanup_loop — all dead code from removed session-based auth. Audit for other dead imports/config. Clean `main.py` lifespan to only contain real startup logic. Finding 4. |
| E104 | Runtime Environment Safety — Fail-Fast on Insecure Defaults | P1 | 8 | M | Add startup validator: if `ENVIRONMENT=production` and `SECRET_KEY` is in `_PLACEHOLDER_VALUES`, raise `SystemExit` with clear error message. Add `make doctor --production` mode that checks production-readiness (secrets, email provider, OAuth, DB URL). Add CI check for placeholder detection. Finding 2. |
| E105 | Admin Health Dashboard API & View | P1 | 13 | L | Add `GET /admin/health` (superuser-only) returning structured JSON: DB status, email provider, OAuth config presence, app version, uptime, last migration. Add Dashboard "System Health" view consuming this endpoint. Template cloners get instant operational visibility. Finding 3 + Research item 2. |
| E106 | Post-Clone Customization Verifier — `make verify` | P1 | 13 | L | Add `make verify` command that checks: all `{{PLACEHOLDER}}` values replaced, OpenAPI title customized, `.env` secrets not defaults, at least one OAuth provider configured (or explicitly disabled), email provider set, Zeabur project linked. Outputs checklist with pass/fail per item. Finding 5. |

**Total: 47 SP / 80 budget — 5 epics**

### Risk Assessment

| Epic | Risk of Doing | Risk of NOT Doing |
|------|---------------|-------------------|
| E102 | Low — documentation refresh, no code changes | Agents and humans read wrong test counts; QA metrics never populated; write-back trust erodes |
| E103 | Low — removing dead code, small scope | Dead session cleanup runs on every startup; confuses template cloners who wonder what sessions table is |
| E104 | Medium — must not break dev/test environments (only gate production) | Template cloners deploy with `CHANGE_ME` secrets; security incident waiting to happen |
| E105 | Medium — new API endpoint + dashboard view, needs OpenAPI spec first | Template lacks operational visibility; cloners build ad-hoc health checks instead of getting one free |
| E106 | Medium — must handle diverse customization states gracefully | Cloners miss placeholder replacement; deploy half-customized templates; support burden increases |

### Dependency Chain

```
E102 (context hygiene) ──────── no deps, standalone documentation fix
E103 (dead code removal) ────── no deps, standalone cleanup
E104 (runtime safety) ────────── no deps, standalone (but benefits from E103 cleaning config first)
E105 (health dashboard) ──────── no deps, but spec-first (OpenAPI → server → client)
E106 (customization verifier) ── E103 (dead config removed first, so verifier checks clean config)
```

### Phase 29 Parallelism

```
Phase 29: E102 + E103 + E105 (all parallel, no deps)
        → E104 (after E103 cleans config)
        → E106 (after E103 cleans config)
```

### Recommendation

**Execute in two waves:**

1. **Wave 1** (E102 + E103 + E105): Three independent epics. E102 fixes the most embarrassing gap (test-status.md showing 28 tests when there are 247). E103 removes dead code that confuses every reader of `main.py`. E105 adds the admin health dashboard — the highest-value new feature for template cloners.

2. **Wave 2** (E104 + E106): After E103 cleans up dead config, E104 adds production safety gates and E106 adds the customization verifier. Both depend on having a clean config surface to validate against.

**Key deliverable**: After Phase 29, the template is not just feature-complete but **operationally trustworthy** — accurate docs, no dead code, runtime safety nets, operational visibility, and a customization verification step. A developer cloning this template gets confidence that nothing is stale, broken, or insecure by default.

**Validation gate**: After all 5 epics, run `make verify` (new), `make doctor`, full test suite. Target: zero stale context docs, zero dead code references, health dashboard operational, all placeholder checks passing.

---

✅ APPROVED — 2026-03-30. Epic specs created: e102–e106. Run `/athena:batch auto` to execute.

---

## Cycle 13 — 2026-03-30 — Mode: audit (Testing Mastery from test-master.md)

### Analysis Summary

**Theme**: "Testing Mastery" — absorb the 10 testing principles from `docs/test-master.md` into the project's skill system, stop verifier, contract test framework, and QA pipeline. Transform ad-hoc testing knowledge into operational, enforceable, agent-guided testing methodology.

**Context**: 96 epics complete (E0–E96), 27 phases. Testing infrastructure is mature (conftest with 3-tier DI chain, MSW + createCrudHandlers, coverage gates 90%/80%). But the **methodology layer** is missing — agents can still write brittle tests that test implementation details, over-mock internal functions, skip parametrize, and produce untriangulated test cases. The `tdd-workflow.md` skill covers RED-GREEN-REFACTOR but not the deeper principles.

**Source Material**: `docs/test-master.md` — 833-line educational document covering 10 testing principles in Traditional Chinese. The content is good study material but wrong format for operational use (tutorial tone, generic examples, no project-specific patterns). This cycle extracts the actionable value and deletes the tutorial.

**Gap Analysis (10 Principles vs Current State)**:

| # | Principle | Current | Gap |
|---|-----------|---------|-----|
| 1 | Test Behavior, Not Implementation | Mentioned in tdd-workflow.md | No enforcement — agents can still test internals |
| 2 | Humble Object | FastAPI route→service pattern exists | Not documented as testability pattern |
| 3 | Contract Tests | ❌ Missing | No schema validation for API responses |
| 4 | Dependency Injection | ✅ 3-tier Depends() chain | Well done — document as model |
| 5 | Wrappers | ✅ Adapter pattern (auth, email) | Not generalized as testing principle |
| 6 | Effective Mocking | MSW + conftest exist | No mock hygiene rules for agents |
| 7 | Triangulation | ❌ No parametrize patterns | Server tests lack multi-case coverage |
| 8 | Snapshot Tests | ❌ Not used | Could protect OpenAPI response shapes |
| 9 | Useful Libraries | factory-boy/faker installed but unused | hypothesis not installed |
| 10 | AI Agent Guidelines | tdd-workflow.md has basics | Not enforced in agent prompts or verifier |

---

### Proposed Epics (5)

| # | Epic | Priority | Points | Size | Rationale |
|---|------|----------|--------|------|-----------|
| E97 | Testing Master Skill — 10 Principles Codified | P0 | 8 | M | Rewrite `tdd-workflow.md` to merge RED-GREEN-REFACTOR + all 10 principles from test-master.md. Project-specific examples (FastAPI DI, MSW handlers, conftest patterns). Delete `docs/test-master.md` after extraction. All agents auto-load this skill when writing tests. |
| E98 | Stop Verifier v3 — Test Quality Rules | P0 | 8 | M | Add 4 new verifier rules: (1) no `assert_called` on internal project functions, (2) warn when 3+ test functions share identical structure (suggest parametrize), (3) warn if test file has >5 `mock.patch` decorators, (4) test file >200 lines warning. Extends stop-verifier.sh from 8→12 rules. |
| E99 | Contract Test Framework & OpenAPI Validation | P1 | 8 | M | Add `server/tests/contract/` with OpenAPI response schema validation — actual endpoint responses validated against `openapi.yaml` schemas. Add email provider contract test (verify interface across console/mailgun/zeabur). Create conftest fixtures for contract test pattern. Template for future integrations. |
| E100 | Triangulation & Property-Based Testing | P1 | 8 | M | Install `hypothesis`. Convert existing server tests to `@pytest.mark.parametrize` where applicable. Create `server/tests/factories.py` with factory-boy User/OAuthAccount factories. Add hypothesis strategies for common input types (emails, UUIDs, display names). Template patterns for client parametrize. |
| E101 | QA Agent Enhancement — Test Quality Audit | P1 | 8 | M | Enhance `@qa` agent and `/athena:qa` to audit test quality beyond coverage %: behavior-vs-implementation ratio, mock depth analysis, parametrize usage rate, contract test coverage. Add Test Quality Score to qa report. Integrate with stop verifier rules from E98. |

**Total: 40 SP / 80 budget — 5 epics**

### Risk Assessment

| Epic | Risk of Doing | Risk of NOT Doing |
|------|---------------|-------------------|
| E97 | Low — skill rewrite, no code changes | Agents keep writing brittle tests; methodology stays ad-hoc |
| E98 | Medium — verifier false positives possible (need tuning) | Anti-patterns accumulate; test quality degrades as codebase grows |
| E99 | Medium — contract tests add maintenance burden | API responses drift from spec silently; integration bugs caught late |
| E100 | Low — additive test improvement | Tests only cover happy paths; edge cases missed systematically |
| E101 | Medium — QA agent complexity increases | Coverage % gives false confidence; 90% coverage with brittle tests is worse than 70% with good tests |

### Dependency Chain

```
E97 (testing master skill) ─── no deps, foundation for E100 + E101
E98 (verifier v3) ─────────── no deps, foundation for E101
E99 (contract tests) ──────── no deps, standalone framework
E100 (triangulation) ──────── E97 (skill must define parametrize patterns first)
E101 (QA enhancement) ──────── E97 + E98 (needs both skill rules + verifier rules to audit against)
```

### Phase 28 Parallelism

```
Phase 28: E97 + E98 + E99 (all parallel, no deps) → E100 (after E97) → E101 (after E97 + E98)
```

### Recommendation

**Execute in three waves:**

1. **Wave 1** (E97 + E98 + E99): Three independent epics. E97 is the foundation — rewrites the testing skill with all 10 principles. E98 adds automated guardrails. E99 establishes contract testing pattern.

2. **Wave 2** (E100): After E97 delivers the skill, E100 applies triangulation patterns to existing tests using the newly codified rules.

3. **Wave 3** (E101): After both E97 (what to audit) and E98 (rules to enforce), E101 wires everything into the QA pipeline for automated quality scoring.

**Key deliverable**: After Phase 28, every `/athena:implement` and `/athena:qa` run will be guided by the 10 principles — not just coverage gates but **test quality gates**. The 833-line tutorial becomes a 70-line operational skill that shapes every test written by every agent.

**Validation gate**: After all 5 epics, run full test suite + new quality audit. Target: zero verifier warnings, all contract tests passing, >50% of test functions using parametrize.

---

✅ APPROVED — 2026-03-30. Epic specs created: e97–e101. Run `/athena:batch auto` to execute.

---

## Cycle 12 — 2026-03-28 — Mode: audit (Documentation Enrichment for Beginners) — ✅ COMPLETE

### Analysis Summary

**Theme**: "Documentation Enrichment for Beginners — Better Organization" — audit all documentation for accuracy, discoverability, and beginner DX gaps after Phase 25 (parallel pipeline) and Phase 26 (reviewer agent, dashboard, PR automation).

**Context**: 92 epics complete (E0–E91), 27 phases. The project has matured to 9 agents (8 + domain-expert template), 17 commands, 8 skills. Phase 25 added parallel pipeline (`/athena:batch`, `@orchestrator`, `epic-graph.sh`, webhook, JSONL audit). Phase 26 added `@reviewer` agent split from `@qa`, `@debugger` auto-retry, `/athena:dashboard`, PR automation hooks, and post-wave integration test gate.

**Current Documentation Inventory**:
- `README.md` — 260 lines, bilingual (ZH-TW primary, EN secondary)
- `docs/guides/en/` — 7 guides (quickstart, first-epic, ai-agent-team, without-claude-code, ci-explained, custom-agents, openapi-patterns)
- `docs/guides/zh-TW/` — 7 guides (mirror of EN)
- `docs/reference/` — 5 files (agents, commands, skills, parallel-pipeline-strategy, agent-webhook-improvement-plan)
- `dev-docs/public/DEVELOPER_DOCS.md` — full architecture doc (ZH-TW only)

---

### Finding 1: Reference Docs Are Stale — Agent/Command/Skill Counts Wrong (P0)

**`docs/reference/agents.md`** lists 7 agents. Actual count is 9 (8 real + 1 template): `@reviewer` and `@orchestrator` are missing entirely. The collaboration flow diagram does not show the reviewer/orchestrator roles. The CLAUDE.md session identity file header says "7 agents" in the injected system-reminder (the actual `CLAUDE.md` correctly says 8).

**`docs/reference/commands.md`** says "14 commands". Actual count is 17: missing `/athena:batch`, `/athena:dba`, and `/athena:dashboard`. The pipeline diagram does not mention parallel mode.

**`docs/reference/skills.md`** says "7 skills". Actual count is 8: missing `dba-migrations` skill.

**Impact**: A beginner reading reference docs gets an incomplete picture of the agent team. They would not discover `/athena:batch` (the highest-impact feature from Phase 25) or `@reviewer` (the dedicated code review agent from Phase 26).

### Finding 2: No Guide Cross-Linking — Guides Are Islands (P1)

Only `quickstart.md` has a "Next Steps" section linking to other guides. The remaining 6 guides (first-epic, ai-agent-team, without-claude-code, ci-explained, custom-agents, openapi-patterns) end without pointing the reader anywhere next. There is no index page listing all guides with descriptions. A beginner who finishes one guide has no clear path to the next.

**Missing learning path**: quickstart → without-claude-code (or first-epic) → ai-agent-team → custom-agents → openapi-patterns → ci-explained. This progression from basic to advanced is not documented anywhere.

### Finding 3: DEVELOPER_DOCS.md Partially Updated for Phase 25, No Phase 26 Content (P1)

The dev-docs mention `@orchestrator`, `/athena:batch`, JSONL audit, and webhook — these were added during Phase 25. However:
- Phase 26 features (`@reviewer`, `/athena:dashboard`, debugger auto-retry, PR automation, integration test gate) are not mentioned
- The version summary (section 13) does not include Phase 25 or 26
- The agent count in DEVELOPER_DOCS says 8 agents but actual is 9 (with `@reviewer` added in Phase 26)

### Finding 4: README Is Well-Structured But Has Minor Staleness (P2)

The README progressive disclosure is working well: Quick Start → Features → With/Without Claude Code → Agent Team → Documentation table. However:
- The ZH section says "16 個 Athena 指令" — should be 17 (with `/athena:dashboard`)
- The EN section mirrors correctly
- The comparison table mentions "8 條 stop verifier 規則" — correct
- The doc navigation table does not mention `/athena:dashboard` or the new `@reviewer` agent
- `custom-agents.md` says "7 general-purpose agents" — should be 8 (with `@reviewer`)

### Finding 5: No Beginner "Learning Path" Document (P2)

A new user cloning the repo faces 7 guides, 5 reference docs, a TECHSTACK.md, and the DEVELOPER_DOCS app. There is no single document that says: "If you are new, read these in this order." The README's doc table lists everything flat — no progression indicator. The `/getting-started` in-app page helps for the SaaS template itself but does not guide through the AI agent team documentation.

---

### Proposed Epics (5)

| # | Epic | Priority | Points | Size | Rationale |
|---|------|----------|--------|------|-----------|
| E92 | Reference Docs Refresh — Agents, Commands, Skills | P0 | 5 | S | Update `agents.md` to 9 agents (add @reviewer, @orchestrator, update flow diagram). Update `commands.md` to 17 commands (add batch, dba, dashboard). Update `skills.md` to 8 skills (add dba-migrations). Fix all count references across docs. |
| E93 | Guide Cross-Linking & Learning Path Index | P1 | 8 | M | Add "Next Steps" / "Related Guides" sections to all 7 EN guides + 7 ZH guides. Create `docs/guides/en/README.md` and `docs/guides/zh-TW/README.md` as learning path indexes (beginner → intermediate → advanced). Link from main README doc tables. |
| E94 | DEVELOPER_DOCS Phase 25–26 Refresh | P1 | 8 | M | Update dev-docs with Phase 26 content (@reviewer, /athena:dashboard, debugger auto-retry, PR automation, integration test gate). Update agent count from 8 to 9. Update version summary (section 13) with Phase 25 + 26 entries. Verify all section counts match reality. |
| E95 | README Count & Reference Accuracy Sweep | P2 | 5 | S | Fix agent/command/skill count mismatches in README (both ZH and EN sections), CLAUDE.md system-reminder injection, custom-agents.md, and any other files referencing stale counts. Single grep-and-fix sweep across all markdown files. |
| E96 | Improvement Plan Archival & Status Update | P2 | 8 | M | `agent-webhook-improvement-plan.md` was the planning doc for Phase 25–26. Now that both phases are delivered, update the plan with completion status for each item. Mark Phase 1+2 as DONE (E82–E86), Phase 3 as DONE (E87–E91). Add Phase 4 status (deferred). Move from `docs/reference/` to `docs/reference/archive/` or add COMPLETED header. Prevents future cycles from re-proposing already-done work. |

**Total: 34 SP / 80 budget — 5 epics**

### Risk Assessment

| Epic | Risk of Doing | Risk of NOT Doing |
|------|---------------|-------------------|
| E92 | Low — pure documentation updates | Beginners miss @reviewer, @orchestrator, /athena:batch — the project's most powerful features |
| E93 | Low — adding links and index files | Guides remain isolated islands; no learning progression for newcomers |
| E94 | Low — dev-docs content update | DEVELOPER_DOCS becomes increasingly inaccurate; ZH-speaking users get stale info |
| E95 | Low — grep + fix sweep | Count mismatches erode trust ("it says 7 but I see 9") |
| E96 | Low — archival + status marking | Future strategy cycles may re-propose Phase 25/26 work; planning doc implies work is still pending |

### Dependency Chain

```
E92 (reference refresh) ── no deps, standalone
E93 (guide cross-links) ── no deps, standalone
E94 (dev-docs refresh) ─── no deps, standalone (but benefits from E92 for consistent counts)
E95 (count sweep) ──────── should run AFTER E92 (so reference docs are already fixed)
E96 (plan archival) ────── no deps, standalone
```

### Phase 27 Parallelism

```
Phase 27: E92 + E93 + E94 + E96 (all parallel, no deps) → E95 (after E92)
```

### Recommendation

**Execute in two waves:**

1. **Wave 1** (E92 + E93 + E94 + E96): Four independent docs-only epics. E92 is the highest priority — fixes the reference docs that are directly wrong. E93 improves discoverability. E94 keeps the dev-docs current. E96 is housekeeping.

2. **Wave 2** (E95): The count sweep should run last, after E92 has already fixed the reference docs. This epic does a final pass to catch any remaining count mismatches across the entire codebase.

**Why 34 SP instead of 80**: These are all documentation-only changes with no code modifications. Most are S or M size. The total is deliberately conservative because docs work is faster to execute than code changes.

**Validation gate**: After all 5 epics, run a grep for `7 agent|7 個|14 command|14 個指令|7 skill|7 個技能` across all markdown files to verify zero stale counts remain.

---

⏸️ AWAITING HUMAN APPROVAL — run `/athena:plan approve E92,E93,E94,E95,E96` to proceed

---

## Cycle 10 — 2026-03-28 — Mode: feature (AI Agent Team & Webhook Improvement)

### Analysis Summary

**Theme**: "AI Agent Team & Webhook Infrastructure Improvement" — enable observability, strengthen quality gates, and lay the foundation for parallel epic execution.

**Context**: 81 epics completed across 24 phases. The project has matured to 8 agents, 15 commands, 16 hooks, and 8 skills. The current pipeline (`athena:loop`) is strictly serial — one epic at a time. With 60+ epics anticipated for ai-clock-work's next batch, serial execution (10-30 min/epic = 10-30 hours) is the primary bottleneck. The improvement plan (`docs/reference/agent-webhook-improvement-plan.md`) identifies 4 phases of work; this cycle targets Phase 1 (quick wins) and Phase 2 (core parallel pipeline).

**Current State Assessment**:
- `task-completed.sh` webhook is a stub (all code commented out) — zero external notification capability
- `post-bash-log.sh` writes plaintext `audit.log` — not queryable, no agent/epic attribution
- `stop-verifier.sh` has 5 rules — missing OpenAPI drift detection and console.log detection
- No `/athena:batch` command exists — parallel execution requires manual worktree management
- No `@orchestrator` agent — dependency graph resolution and batch scheduling are manual

**Key Findings from Improvement Plan**:

1. **Webhook is zero-cost to enable** (P0): The skeleton exists in `task-completed.sh`, just needs uncommenting + structured payload. Enables Slack/Discord/n8n integration immediately.

2. **JSONL audit log is a prerequisite for observability** (P0): Current plaintext format cannot support per-agent/per-epic metrics. Switching `post-bash-log.sh` to JSONL with agent/epic context enables `jq` queries and trend analysis.

3. **Stop verifier has gaps** (P1): Missing OpenAPI drift detection (spec edited but types not regenerated) and `console.log` residue check. These are core SDD and production-readiness rules.

4. **`/athena:batch` is the highest-impact feature** (P0): The parallel pipeline strategy document confirms worktree isolation works. A batch command that reads the dependency graph, partitions epics into waves, and dispatches up to 4 worktree agents would deliver ~4x throughput.

5. **`@orchestrator` agent is the control plane** (P1): Without a dedicated orchestrator, `/athena:batch` would need all coordination logic inline. A separate agent with Opus model handles dependency resolution, wave scheduling, merge conflict detection, and failure retry.

---

### Proposed Epics (max 5)

| # | Epic | Priority | Points | Rationale |
|---|------|----------|--------|-----------|
| E82 | Webhook Activation & JSONL Audit Log | P0 | 5 | Enable `task-completed.sh` webhook with structured JSON payload (Slack/Discord/n8n). Convert `post-bash-log.sh` to JSONL format with agent/epic/duration fields. Two quick wins in one epic — both touch `scripts/hooks/` only. |
| E83 | Stop Verifier Enhancement | P1 | 5 | Add 3 new rules: (1) OpenAPI drift detection — `openapi.yaml` changed but no corresponding types update, (2) `console.log` residue in `client/` source files, (3) large file warning (>500 lines). Strengthens the quality gate from 5 to 8 rules. |
| E84 | Epic Dependency Graph & Tier Classifier | P0 | 8 | Build `scripts/epic-graph.sh` that parses `epic-progress.md` dependency rules into a DAG, computes execution waves (topological sort), and classifies epics into Tier A (scriptable) / Tier B (agent batch) / Tier C (full loop). Foundation for E85. |
| E85 | `/athena:batch` Parallel Epic Command | P0 | 13 | Create the batch command in `.claude/commands/athena/batch.md`. Accepts epic list or `--phase N`. Reads dependency graph from E84, partitions into waves, dispatches up to 4 worktree agents per wave (via `Agent` tool with `isolation: "worktree"`), collects results, merges to main between waves. Includes `--dry-run` mode. |
| E86 | `@orchestrator` Agent & Orchestration Log | P1 | 7 | Create `@orchestrator` agent (Opus model) in `.claude/agents/orchestrator.md`. Responsibilities: read dependency graph, assign epics to worktree agents, monitor completion via webhook events, handle merge conflicts, auto-retry failures (max 2). Write-back doc: `docs/context/orchestration-log.md`. Wired into `/athena:batch` as the coordination engine. |

**Total: 38 SP / 80 budget — 5 epics**

### Risk Assessment

| Epic | Risk of Doing | Risk of NOT Doing |
|------|---------------|-------------------|
| E82 | Low — hook scripts only, no app code | No observability; cannot track agent activity or get notified of completions |
| E83 | Low — adding rules to existing verifier | OpenAPI drift and console.log residue slip into production; quality gate has known gaps |
| E84 | Low — standalone script, no existing code changes | E85 must inline all graph logic, making it fragile and hard to test |
| E85 | Medium — worktree coordination is complex; needs thorough testing with 2-3 epics before scaling | Serial pipeline remains; 60-epic batches take 10-30 hours instead of 3-5 |
| E86 | Medium — new agent needs clear boundaries to avoid scope creep | `/athena:batch` has all logic inline; no reusable coordination layer for future commands |

### Dependency Chain

```
E82 (webhook + audit) ─── no deps, standalone
E83 (stop verifier) ──── no deps, standalone
E84 (dependency graph) ── no deps, standalone
E85 (batch command) ───── E84 (needs graph parser)
E86 (orchestrator) ────── E84 (needs graph), E82 (uses webhook events)
```

### Phase 25 Parallelism

```
Phase 25: E82 + E83 + E84 (all parallel, no deps) → E85 + E86 (parallel after E84, E86 also after E82)
```

### Recommendation

**Execute in two waves:**

1. **Wave 1** (E82 + E83 + E84): Three independent epics, all parallelizable. E82 and E83 are quick wins (hooks only, ~1 session each). E84 is the critical-path foundation — must complete before Wave 2.

2. **Wave 2** (E85 + E86): The core parallel pipeline. E85 is the user-facing command; E86 is the coordination engine. These can develop in parallel since E85 can start with inline logic and wire in the orchestrator once E86 is ready.

**Why 38 SP instead of 80**: The improvement plan has 4 phases. This cycle covers Phase 1 + Phase 2 only. Phase 3 (reviewer agent, debugger auto-retry, dashboard) and Phase 4 (cross-terminal coordination) are deferred to Cycle 11+ after validating the parallel pipeline works on a real 5-10 epic batch.

**Validation gate**: After E85 ships, run `/athena:batch --dry-run` on a hypothetical 5-epic phase to verify wave partitioning before using it on a real batch.

---

✅ APPROVED — 2026-03-28. All 5 epics (E82–E86) approved as Phase 25.

---

## Cycle 9 — 2026-03-25 — Mode: refactory (Migration Domain-Based Consolidation)

### Analysis Summary

**Theme**: "Migrate from epic-based incremental migrations to domain-based consolidated migrations — following ai-clock-work's proven pattern"

**Context**: ai-clock-work uses 14 domain-based migration files (001_auth, 002_core, 003_attendance...) where each file creates ALL tables for one domain. ai-coding-template has 9 incremental migrations, many for archived example domains (places, portfolios, teams, billing moved to `docs/examples/domains/` in E70) — but their migrations still clutter `alembic/versions/`.

**Current State**:
- 9 migration files: `001` through `008` (with `006`/`006b` collision)
- Only `001_auth` + `002_sessions` are needed for the clean template
- Migrations `003`–`008` belong to archived example domains
- No migration is generated when running `make new-domain`

**Reference Pattern (ai-clock-work)**:
```
001_auth.py        — user, oauth_account
002_core.py        — companies, holidays, invite_tokens
003_attendance.py  — check_ins, known_devices
...each file = one domain, all tables consolidated
```

---

**FINDING 1: Stale Example Domain Migrations Still in versions/** (P0)

Migrations 003–008 create tables for places, portfolios, teams, and billing — domains that were archived to `docs/examples/domains/` in E70. Running `alembic upgrade head` on a fresh template creates tables for domains that no longer exist in the codebase. This confuses new users and bloats the schema.

**FINDING 2: Auth Split Across Two Files** (P1)

`001_fastapi_users_initial.py` creates user + oauth_account. `002_add_sessions_table.py` creates sessions. Following ai-clock-work's pattern, these should be consolidated into a single `001_auth.py`.

**FINDING 3: `make new-domain` Doesn't Generate Migrations** (P1)

The domain generator creates models, schemas, endpoints, and tests — but not the Alembic migration file. Developers must manually run `alembic revision --autogenerate`. ai-clock-work's pattern shows each domain should have a pre-written migration with explicit CREATE TABLE statements (not autogenerate).

**FINDING 4: Example Domain Migrations Not Co-located with Examples** (P2)

Example domain code lives in `docs/examples/domains/` but their migrations are in `server/alembic/versions/`. They should be co-located as reference examples in `docs/examples/migrations/`.

---

### Proposed Epics (4)

| # | Epic | Priority | Points | Rationale |
|---|------|----------|--------|-----------|
| E78 | Migration Archive & Core Consolidation | P0 | 8 | Archive stale example migrations; consolidate auth into single domain-based `001_auth.py` |
| E79 | Example Domain Migration Templates | P1 | 5 | Co-locate domain-based example migrations with archived example domains |
| E80 | Migration Generator in `make new-domain` | P1 | 5 | Auto-generate domain-based migration file when scaffolding a new domain |
| E81 | Alembic Env Hardening & CI Gate | P2 | 5 | Add `alembic check` CI gate; improve env.py for domain pattern |

**Total: 23 SP / 80 budget — 4 epics**

### Risk Assessment

| Epic | Risk of Doing | Risk of NOT Doing |
|------|---------------|-------------------|
| E78 | Low — straightforward file reorganization | Fresh `make init` creates phantom tables for non-existent domains |
| E79 | Low — documentation/reference only | Example domains lack migration reference; DX gap |
| E80 | Medium — template generation complexity | Manual migration step breaks the "zero-config" DX promise |
| E81 | Low — CI addition | Migration drift goes undetected until deployment |

### Recommendation

Execute E78 first (clears stale state), then E79+E80 in parallel (independent), finally E81 (CI gate validates everything). Phase can complete in 1-2 sessions.

### Dependency Chain
```
E78 (archive + consolidate) → E79 (example migrations) + E80 (generator) → E81 (CI gate)
```

⏸️ AWAITING HUMAN APPROVAL — run `/athena:plan approve E78,E79,E80,E81` to proceed

---

## Cycle 8 — 2026-03-20 — Mode: audit (Template Repo — Initialization DX)

### Analysis Summary

**Theme**: "Template repo — refresh/simplification scripts and project initialization DX"

72 epics shipped across 22 phases. The template now has robust tooling (`make go`, `make reset`, `new-site.sh`, `make doctor`, `make tutorial`, `make new-domain`). This audit examines what happens in the critical "clone -> customize -> build" flow and identifies gaps that make the first 10 minutes harder than they need to be.

**Source of Truth**: Direct analysis of `scripts/template-reset.sh`, `scripts/new-site/`, `Makefile`, `docs/templates/`, and the current server/client domain state.

---

**FINDING 1: `new-site.sh` Is Stale After E70 Domain Extraction — Domain Feature Prompts Reference Deleted Code** (P0)

`scripts/new-site/prompts.ts` (lines 86-89) offers "Places (CRUD + Map)" and "Portfolio (analytics + charts)" as domain feature choices. `scripts/new-site/scaffold.ts` (lines 62-97) has a `DOMAIN_REMOVAL_MAP` that references paths like `server/app/domains/places`, `client/src/pages/places`, etc. — all of which were removed by E70 (Example Domain Extraction, PR #96). These domains now live in `docs/examples/` and are no longer in the working tree.

Running `new-site.sh` today would:
1. Prompt the user to select domain features that do not exist in the codebase
2. Attempt to remove paths that are already gone (silently succeeds but is misleading)
3. Reference `TEMPLATE_FILES` entries like `.claude-plugin/plugin.json`, `.env.local.example`, `.env.production.example` that may not be present or named differently

The new-site CLI needs to be updated to reflect the post-E70 reality: domains are now opt-IN (install from examples) rather than opt-OUT (remove from core). The domain prompt should list `blog`, `todo`, `crm` (the example domains in `docs/examples/`) and offer to install them via `make new-domain`, not remove them.

**Specific files**: `scripts/new-site/prompts.ts`, `scripts/new-site/scaffold.ts`, `scripts/new-site/types.ts`, `scripts/new-site/__tests__/`

**FINDING 2: No `make init` — Reset and Customize Are Separate, Disconnected Steps** (P1)

The post-clone flow requires two separate commands with no connection between them:
1. `make reset` — deletes project-specific history, resets context docs
2. `./scripts/new-site.sh` — interactive project customization (name, theme, OAuth, etc.)

There is no `make init` or combined flow. A new user has to know about both commands and run them in the right order. The Makefile's `go` target does NOT call reset first — it goes straight to `check-prereqs -> setup -> dev`. If someone clones and runs `make go`, they get the template running with all the template's own context docs, epic history stubs, and placeholder names intact.

The ideal flow: `make init` = reset + new-site + (optional) first domain scaffold, ending with `make dev` ready to go. This would be the true "clone -> customize -> build" single command.

**Specific files**: `Makefile` (add `init` target), possibly a thin `scripts/init.sh` wrapper

**FINDING 3: `new-site.sh` Uses `createdb` Directly — Fails Without Local PostgreSQL Client** (P1)

`scripts/new-site/setup.ts` (line 56) runs `createdb` as a setup step. This requires the PostgreSQL client tools to be installed locally AND a running PostgreSQL instance. But the template uses Docker for PostgreSQL (`docker compose up -d db`). The `make go` flow handles this correctly (uses `docker compose` for DB), but `new-site.sh` bypasses it with a raw `createdb` call that will fail for most users who only have Docker-based Postgres.

The setup step should use `docker compose exec db createdb` or simply rely on `make ensure-db` + `make migrate` (which creates the DB via Alembic if it exists).

**Specific files**: `scripts/new-site/setup.ts`

**FINDING 4: No "Strip to Core" Script — Template Users Cannot Quickly Reduce to Auth+Dashboard** (P2)

A common use case: someone clones the template wanting ONLY the auth system + dashboard shell, without the example domains, dev-docs, bilingual guides, legal pages, SEO components, or the 4-theme system. Currently, stripping requires manually identifying and removing 20+ files across server/, client/, and docs/. E70 extracted example domains to `docs/examples/`, but the client still ships with legal pages, landing page, getting-started page, and all 4 themes active.

A `make strip` or `scripts/strip-to-core.sh` would remove everything except: auth (sign-in, sign-up, forgot-password, verify-email, OAuth), dashboard shell, theme system (keep dark only), and the API layer. This is a "less is more" option for experienced developers.

**Specific files**: New `scripts/strip-to-core.sh`, update Makefile

**FINDING 5: new-site Coverage Artifacts and node_modules in Working Tree** (P3)

`scripts/new-site/coverage/` contains 14 HTML/CSS/JSON files from a previous test coverage run. `scripts/new-site/node_modules/` has vitest cache files. Neither is tracked in git (good), but they clutter the working tree and could confuse developers browsing the scripts directory. The `.gitignore` has no specific rule for `scripts/new-site/coverage/` — it's only excluded by the generic `coverage/` pattern. The `node_modules/` exclusion works via the global pattern. Minor hygiene issue, not worth a standalone epic.

---

### Proposed Epics (max 5)

| # | Epic | Priority | Points | Rationale |
|---|------|----------|--------|-----------|
| E73 | New-Site CLI Post-E70 Sync | P0 | 13 | Fix stale domain feature prompts and removal maps in `scripts/new-site/`. Change domain model from opt-OUT to opt-IN (install from `docs/examples/`). Update `TEMPLATE_FILES` list, `DOMAIN_REMOVAL_MAP`, `ProjectConfig` type, all 6 test files. Validate with `--dry-run`. |
| E74 | Unified `make init` Flow | P1 | 8 | Add `make init` target that chains: reset -> new-site -> ensure-db -> migrate -> generate-types. Single command for "clone -> customize -> build". Add `.initialized` sentinel file to prevent accidental re-runs. Update README and tutorial to reference `make init` as the primary post-clone command. |
| E75 | New-Site Setup Hardening | P1 | 5 | Fix `createdb` step to use Docker-based DB creation (consistent with `make ensure-db`). Add `EMAIL_PROVIDER` and `EMAIL_FROM` to generated `.env` (post-E66 alignment). Update `generateEnvContent()` to include all current env vars. Add error recovery guidance for each setup step. |
| E76 | Strip-to-Core Script | P2 | 13 | Create `scripts/strip-to-core.sh` + `make strip` that removes: legal pages, landing page, getting-started page, dev-docs app, bilingual guides, example domains, SEO component, extra themes (keep dark only). Leaves auth + dashboard + API layer + theme system shell. Manifest records what was stripped. Update Makefile. |

**Total: 39 / 80 story points**

### Risk Assessment

| Risk | Severity | If not addressed |
|------|----------|-----------------|
| new-site.sh references deleted domains | High | Running the CLI post-clone produces a broken/misleading experience. Domain feature selection is a no-op that confuses users. The flagship onboarding tool is effectively broken. |
| No unified init flow | Medium | New users must discover and run two separate commands in the right order. Many will skip `make reset` and start with `make go`, inheriting template-specific context docs and stale epic history. |
| createdb fails without local Postgres client | Medium | Setup step fails silently (status: "fail") for Docker-only Postgres users. The new-site CLI reports a warning but the user doesn't know how to fix it. |
| No strip-to-core option | Low | Power users who want a minimal starting point must manually delete files. Not blocking, but reduces template appeal for experienced developers who want less, not more. |

### Recommendation

**Execution order** (dependency chain: E73 -> E74 -> E75, E76 independent):

1. **E73 (New-Site CLI Sync)** — FIRST, 1-2 sessions (13 SP). Critical fix — the CLI is currently broken for the domain feature flow. Must update before any new user tries `new-site.sh`. Changes are localized to `scripts/new-site/` with full test coverage already in place.

2. **E74 (Unified `make init`)** — SECOND, 1 session (8 SP). Depends on E73 being fixed first (init calls new-site). Creates the "one command" post-clone experience. Low risk — thin wrapper around existing commands.

3. **E75 (Setup Hardening)** — THIRD, <1 session (5 SP). Fixes the createdb Docker alignment and env var generation. Can be done alongside E74 since both touch `scripts/new-site/setup.ts` but different functions.

4. **E76 (Strip-to-Core)** — INDEPENDENT, 1-2 sessions (13 SP). No dependency on E73-E75. Can be parallelized. Lower priority but high value for the "experienced developer" persona.

**Total effort**: 3-4 sessions. All changes are in scripts/ and Makefile — no server/client code changes except for E76 (which removes client files). E72 (OAuth Callback Fix) is already approved and should be implemented before or in parallel with this cycle.

✅ APPROVED — 2026-03-20. All 5 epics (E73–E77) approved as Phase 23.

---

## Cycle 7 — 2026-03-20 — Mode: audit (Cross-Project Alignment — ai-clock-work)

### Analysis Summary

**Theme**: "Align email, environment, and deploy patterns with battle-tested ai-clock-work architecture"

Cross-project audit comparing ai-coding-template (66 epics, 21 phases) with ai-clock-work (production-deployed). Three systemic gaps found — all centered on email delivery architecture and its ripple effects on environment config and deployment.

**Source of Truth**: User-initiated comparison of `/Users/MH/Documents/git_saas/ai-clock-work` patterns.

---

**FINDING 1: SMTP-Coupled Email Architecture — Fragile, Infrastructure-Heavy, Not Template-Friendly** (P0)

The current `server/app/services/mail_service.py` uses `fastapi-mail` with SMTP transport exclusively. This creates three problems:

1. **Dev requires Docker**: Mailpit container must be running to capture emails. `make go` starts it, but any developer who skips Docker or uses Codespaces without Docker Compose gets zero email visibility. The console fallback (`ENVIRONMENT != "production"` → `logger.info()`) works but is an afterthought, not a first-class provider.

2. **Production requires SMTP relay**: Deploying to Zeabur requires a separate email service (SendGrid, Mailgun, etc.) with SMTP credentials. Zeabur's own free Email API (AWS SES backend) uses HTTP, not SMTP — so it's incompatible with the current `fastapi-mail` approach.

3. **No provider abstraction**: `MailService` class mixes transport logic (SMTP connection, retry) with business logic (template rendering, token capture). Adding a new provider means rewriting the class. ai-clock-work solved this cleanly:
   - `EmailProvider` abstract base class with `send()` method → `EmailResult` dataclass
   - `get_email_provider()` factory with singleton caching → reads `EMAIL_PROVIDER` env var
   - 3 concrete providers: `ConsoleProvider` (dev), `MailgunProvider` (HTTP API), `ZeaburProvider` (HTTP API)
   - Jinja2 template renderer in separate module (not inline HTML strings)

**Specific files**: `server/app/services/mail_service.py` (replace), `server/app/core/config.py` (add `EMAIL_PROVIDER`), `server/app/services/user_manager.py` (update to use factory)

**My thinking**: This is the highest-impact change. The SMTP dependency is the single biggest friction point for Zeabur deployment — it forces users to source a separate email provider when Zeabur includes one for free. The provider pattern from clock-work is proven in production and directly portable. We should also remove the `fastapi-mail` dependency entirely — HTTP API providers use `httpx` (already a transitive dependency via `httpx-oauth`). The inline HTML templates should move to Jinja2 files for maintainability, but the Jinja2 dependency is already available via FastAPI/Starlette.

**FINDING 2: Environment Variables Misaligned with Provider Pattern** (P1)

Current `config.py` has 6 SMTP-specific variables (`SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_USE_TLS`). After the email provider refactor, these should be replaced with:
- `EMAIL_PROVIDER` (enum: console/mailgun/zeabur, default "console")
- `EMAIL_FROM` (renamed from `SMTP_FROM`)
- `MAILGUN_API_KEY` + `MAILGUN_DOMAIN` (provider-specific)
- `ZEABUR_EMAIL_API_KEY` (provider-specific)

Additionally, two DX improvements from clock-work:
- **Root-level `.env.local`**: Currently only `server/.env.example` exists. clock-work has `.env.local` (ready to `cp .env.local .env`) and `.env.production` (template for Zeabur vars). This reduces the "first 5 minutes" friction.
- **`LOG_FORMAT` setting**: clock-work supports `console` (human-readable, default) vs `json` (structured, for production log aggregators). This is a one-line addition to config.py with a conditional formatter in logging setup.

**Specific files**: `server/app/core/config.py`, `server/.env.example`, new `.env.local`, new `.env.production`, `docker-compose.yml` (update server env vars)

**My thinking**: This is a natural follow-on to E66. The env var rename is a breaking change for anyone using the template's current SMTP config — but since no one has deployed yet (v1.0.0 just tagged, no known external users), this is the right time to make the break. The `.env.local` / `.env.production` pattern is a measurable DX improvement — one less step in the onboarding flow.

**FINDING 3: Deploy Script Generates SMTP Vars — Incompatible with Provider Pattern** (P1)

`scripts/deploy-zeabur.sh` Gate 3 (lines 159-257) prompts for `SMTP_HOST` and generates `SMTP_*` vars in `.env.zeabur`. After E66+E67, this should generate:
- `EMAIL_PROVIDER=zeabur`
- `ZEABUR_EMAIL_API_KEY=<prompt user>`
- `EMAIL_FROM=noreply@{client_domain}`

The script should also add a note about creating the Zeabur Email API key in the dashboard.

**Specific files**: `scripts/deploy-zeabur.sh` (Gate 3 section)

**My thinking**: This is a small, mechanical change but critical for the "first deploy" experience. Without it, a user running `make deploy ARGS="--first-time"` would get SMTP prompts for a system that no longer uses SMTP.

---

### Proposed Epics (max 5)

| # | Epic | Priority | Points | Rationale |
|---|------|----------|--------|-----------|
| E66 | Email Provider Refactor | P0 | 13 | Replace `fastapi-mail` SMTP with abstract provider pattern: `EmailProvider` base → factory (`get_email_provider()`) → 3 providers (console/mailgun/zeabur). Jinja2 template renderer. Remove `fastapi-mail` dependency, add Jinja2 email templates. Update `UserManager` to use factory. Port existing inline HTML to Jinja2 files. Preserve E2E token capture for dev. ~15 files touched. |
| E67 | Environment & Config Alignment | P1 | 5 | Replace 6 `SMTP_*` vars with `EMAIL_PROVIDER`/`EMAIL_FROM`/provider-specific keys in `config.py`. Add `LOG_FORMAT` setting. Create root `.env.local` (dev-ready) + `.env.production` (Zeabur template). Update `server/.env.example`, `docker-compose.yml`. Make Mailpit optional (profile-gated). |
| E68 | Deploy Script Email Update | P1 | 3 | Update `scripts/deploy-zeabur.sh` Gate 3: replace SMTP prompts with `EMAIL_PROVIDER=zeabur` + `ZEABUR_EMAIL_API_KEY` prompt. Add setup instructions for Zeabur Email dashboard. Update generated `.env.zeabur` template. |
| E69 | Template Reset Script | P1 | 5 | `scripts/template-reset.sh` + `make reset` — deletes archives, resets context docs, removes project-specific content. One-time post-clone cleanup. |
| E70 | Example Domain Extraction | P1 | 8 | Move billing/teams/places/portfolios to `docs/examples/domains/`. Create `scripts/add-example-domains.sh` installer. Strip domain-specific i18n keys, CSP directives, OpenAPI schemas from core. |
| E71 | Context Doc Reset | P1 | 3 | Template-ready versions of all 9 context files. Stored in `docs/templates/context/` for reset script. EPIC_INDEX reset to empty Phase 0. |

**Total: 37 / 80 story points**

### Risk Assessment

| Risk | Severity | If not addressed |
|------|----------|-----------------|
| SMTP dependency blocks Zeabur deploy | High | Users deploying to Zeabur must source a separate SMTP service (SendGrid, Mailgun with SMTP credentials), even though Zeabur includes a free HTTP email API. First-deploy experience is unnecessarily complex. |
| No provider abstraction | Medium | Any future email provider change (e.g., Resend, SES direct) requires rewriting `MailService`. Clock-work's pattern makes it a one-file addition. |
| Env vars misaligned with architecture | Medium | `.env.example` documents SMTP vars that won't exist post-refactor. Deploy script generates incompatible config. New users get confused. |
| Mailpit required in dev | Low | Console provider eliminates the Docker dependency for basic dev. Mailpit remains available for users who want full email preview (profile-gated). |

### Recommendation

**Execution order** (strict dependency chain — E66 → E67 → E68):

1. **E66 (Email Provider Refactor)** — FIRST, 1-2 sessions (13 SP). Core architectural change. Creates the provider package, removes `fastapi-mail`, migrates templates to Jinja2. This is the foundation — E67 and E68 depend on it.

2. **E67 (Environment & Config)** — SECOND, 1 session (5 SP). Renames env vars to match new provider pattern. Creates root-level env templates. Updates docker-compose. Must happen after E66 because the new var names (`EMAIL_PROVIDER`, etc.) are defined by the provider factory.

3. **E68 (Deploy Script)** — THIRD, <1 session (3 SP). Mechanical update to deploy script. Must happen after E67 because it generates the new env var format.

**Total effort**: 2-3 sessions. No new infrastructure required. Pattern is proven in production (ai-clock-work).

✅ APPROVED — 2026-03-20. All 6 epics approved as Phase 21.
✅ COMPLETED — 2026-03-20. All 6 epics delivered (PRs #92–#97).

---

## Completed Cycles

### Cycle 7 — 2026-03-20 — Mode: audit (Cross-Project Alignment — ai-clock-work)

**Theme**: "Align email, environment, and deploy patterns with battle-tested ai-clock-work architecture"
**Proposed**: E66 (Email Provider Refactor), E67 (Env & Config Alignment), E68 (Deploy Script Email Update), E69 (Template Reset Script), E70 (Example Domain Extraction), E71 (Context Doc Reset)
**Outcome**: All 6 epics approved as Phase 21. All delivered (PRs #92–#97). Replaced SMTP with HTTP API provider pattern, cleaned up env vars, updated deploy script, added template reset, extracted example domains, created template-ready context docs.
**Total**: 37 SP. APPROVED — 2026-03-20. COMPLETED — 2026-03-20.

### Cycle 6 — 2026-03-17 — Mode: auto (Post-v1.0.0 Hardening)

### Analysis Summary

**Theme**: "Raise the production floor — security hardening, E2E test gap, OpenAPI accuracy, CSP completeness, GDPR baseline"

v1.0.0 shipped with 57 epics complete. This audit found no critical vulnerabilities and no `pnpm audit` issues, but identified 5 meaningful gaps that prevent the template from being called "production-hardened": a broken CSP for Stripe, E2E tests that exist but never run in CI, a stale OpenAPI description, missing GDPR account self-deletion endpoint, and GitHub Actions not SHA-pinned (supply-chain risk). All 5 are achievable in short epics with low implementation risk.

---

**FINDING 1: CSP Blocks Stripe.js — Billing Feature Silently Broken in Strict Environments** (P0)

`server/app/middleware/security_headers.py` sets a `Content-Security-Policy` with:
- `script-src 'self'` — blocks `https://js.stripe.com` (required to load Stripe.js checkout)
- `connect-src 'self' https://*.sentry.io` — blocks `https://api.stripe.com` (Stripe API calls from browser) and `https://q.stripe.com` (Stripe telemetry)
- `frame-src` is unset (defaults to `default-src 'self'`) — blocks Stripe's hosted payment fields which load in an iframe from `https://js.stripe.com`

The billing domain (E36) redirects to Stripe Checkout via URL redirect (no iframe), which avoids the frame issue, but any Stripe.js integration attempted by a template user (for embedded payment elements) will fail. The missing `connect-src` entries are a confirmed bug for the hosted Checkout flow when Stripe makes analytics calls. Stripe's documented requirements: `script-src https://js.stripe.com`, `connect-src https://api.stripe.com`, `frame-src https://js.stripe.com https://hooks.stripe.com`.

**Specific file**: `server/app/middleware/security_headers.py` — add Stripe CSP directives

**FINDING 2: Playwright E2E Test Suite Exists But Is Never Run in CI** (P1)

`client/e2e/auth-flow.spec.ts` has a complete E2E test suite (sign-up, sign-in, forgot-password, email verification flows). `playwright.config.ts` exists. `@playwright/test` is in `devDependencies`. But `.github/workflows/ci.yml` contains zero references to Playwright, `e2e`, or the test spec. The tests run only if a developer manually executes them locally. This was tracked as a deferred idea since Cycle 1 ("E2E Playwright test suite") — but now that the auth-flow spec is written, the only missing piece is CI integration. The gap means any regression in the auth UI flows (sign-in, sign-up, OAuth) would be caught only in production.

**Specific files**: `.github/workflows/ci.yml` — add Playwright E2E job; `playwright.config.ts` — verify baseURL configuration for CI

**FINDING 3: OpenAPI Spec Description Still Says "investment tracker" — Template Identity Mismatch** (P1)

`docs/openapi.yaml` line 4: `description: Full-stack investment tracker — Auth & Identity Core (fastapi-users)`. This was the original app description from before the template was generalized (E34 cleaned up code but not the OpenAPI metadata). The `info.version` is also `0.1.0` while the project is at `v1.0.0`. Template users who run `pnpm generate:types` get types with a hardcoded description that says "investment tracker", which is confusing and non-generic. The description should be replaced with a template placeholder pattern consistent with `CLAUDE.md` (which already uses `{{PROJECT_DISPLAY}}`).

**Specific files**: `docs/openapi.yaml` — update `info.description`, `info.version`, and `info.title` to use template-appropriate content; run `pnpm generate:types` afterward

**FINDING 4: No DELETE /users/me Endpoint — GDPR Right to Erasure Unimplemented** (P1)

`fastapi-users` v14+ includes `DELETE /users/{id}` (superuser-only) via `get_users_router()`. However, there is no `DELETE /users/me` endpoint for **self-service account deletion** (GDPR Art. 17 — right to erasure). The Privacy page (`src/pages/legal/PrivacyPage.tsx`) explicitly states that users "can request deletion of their account and associated data", but no such endpoint exists. A user currently has no programmatic path to delete their own account without contacting an admin. This was tracked as a deferred idea ("GDPR data export + account deletion") — the deletion half is now P1 given the template's legal page makes the commitment.

**Specific files**: `docs/openapi.yaml` (spec first), `server/app/api/v1/endpoints/users.py` (new `DELETE /users/me` endpoint), `docs/openapi.yaml` (add `/users/me` DELETE operation), client `DashboardPage.tsx` settings view (add "Delete Account" button)

**FINDING 5: GitHub Actions Use Tag Pins Instead of SHA Pins — Supply Chain Risk** (P2)

`.github/workflows/ci.yml`, `audit.yml`, and `docker-publish.yml` use tag-pinned actions (`actions/checkout@v4`, `pnpm/action-setup@v4`, etc.) rather than SHA-pinned actions (e.g., `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683`). Tag pins are mutable — a compromised or typo-squatted action package could hijack CI. SLSA level 2+ and GitHub's own security hardening guide recommend SHA pinning all third-party actions. This is an OWASP A08 (Software and Data Integrity Failures) concern. The fix is mechanical (replace tags with SHAs) and has zero functional impact.

**Specific files**: `.github/workflows/ci.yml`, `.github/workflows/audit.yml`, `.github/workflows/docker-publish.yml`

---

### Additional Observations (Below Severity Threshold — Deferred)

- **slowapi last release 2024-02-05**: The `slowapi` package (used for rate limiting on auth endpoints) had its last release on 2024-02-05 — over 13 months ago. No CVEs found yet, but abandonment risk remains. Already in Deferred Ideas (P3). Recommend re-evaluating at Cycle 7.
- **fastapi-users 15.0.4 available**: Currently pinned to `>=14.0.0` and running `15.0.4` (latest). No action needed — already on latest.
- **Client dependencies clean**: `pnpm audit` reports no known vulnerabilities. No action needed.
- **N+1 query risk low**: `lazy="selectin"` is used for the portfolio_places relationship (appropriate for async). `lazy="joined"` is used for cross-domain Place refs. No unbounded list queries found — all list endpoints have pagination (page/page_size parameters).
- **Database indexes adequate**: FKs are indexed. Composite index on `(latitude, longitude)` for nearby query. `stripe_event_id` has unique index for idempotency.
- **Webhook security**: Stripe webhook validates signature via `stripe.Webhook.construct_event()`. Correct.
- **Teams access control**: `require_role()` dependency enforces RBAC at team endpoints. `GET /teams/{team_id}/members` verifies team membership before listing. No IDOR found.
- **CSP `connect-src` missing Stripe API**: Confirmed above (Finding 1). No other CSP gaps found.
- **OpenAPI version 0.1.0 vs project 1.0.0**: Part of Finding 3.

---

### Proposed Epics (max 5)

| # | Epic | Priority | Points | Rationale |
|---|------|----------|--------|-----------|
| E57 | CSP Stripe Fix | P0 | 3 | Add `script-src https://js.stripe.com`, `connect-src https://api.stripe.com https://q.stripe.com`, `frame-src https://js.stripe.com https://hooks.stripe.com` to CSP. Add corresponding tests for headers middleware. Prevents billing breakage for any template user using Stripe.js. |
| E58 | E2E Tests in CI | P1 | 8 | Add Playwright E2E job to `ci.yml`: install Playwright, spin up dev server + backend, run `auth-flow.spec.ts`. Gate on PRs to main. ~30-45 min added to CI but catches auth regression immediately. The test file already exists — this is only CI wiring. |
| E59 | OpenAPI Spec Identity Hardening | P1 | 3 | Update `docs/openapi.yaml`: replace `description` ("investment tracker" → generic template description), bump `version` to `1.0.0`, add `{{PROJECT_DESCRIPTION}}` placeholder pattern comment. Regenerate `client/src/api/types.ts` via `pnpm generate:types`. CI already gates on stale types — this ensures the next `generate:types` run passes cleanly. |
| E60 | GDPR Account Self-Deletion | P1 | 8 | Add `DELETE /users/me` endpoint (spec first). Cascade delete: user record, sessions, social_accounts, domain data (places, portfolios — already `CASCADE` via FK). Return 204. Add "Delete Account" button to Dashboard Settings view with confirmation modal. Update Privacy page to reference the endpoint. ~264 server tests + 407 client tests — add coverage for new endpoint and UI component. |
| E61 | GitHub Actions SHA Pinning | P2 | 3 | Pin all third-party actions to their full commit SHAs in `ci.yml`, `audit.yml`, `docker-publish.yml`. Use `actions/checkout@{sha}`, `pnpm/action-setup@{sha}`, etc. Add comments with the tag version for readability. No functional change — pure supply-chain hardening. |

**Total: 25 / 80 story points**

### Risk Assessment

| Risk | Severity | If not addressed |
|------|----------|-----------------|
| CSP blocks Stripe.js | High | Any template user building with Stripe.js embedded elements gets silent failures; our own Stripe billing analytics calls are blocked |
| E2E tests not in CI | Medium | Auth flow regressions (sign-in, sign-up, OAuth) go undetected until production. Auth-flow.spec.ts investment wasted. |
| OpenAPI description says "investment tracker" | Medium | Template identity confusion — generated types carry the wrong description; template users see wrong app identity in API docs |
| No DELETE /users/me | Medium | Privacy page makes a GDPR erasure promise the API cannot fulfill. Legal exposure for template users who ship without adding this themselves. |
| Actions tag-pinned | Low | Unlikely but catastrophic if a pinned action is compromised. SLSA L2 compliance requires SHA pins. |

### Recommendation

**Execution order** (all parallel — no dependencies between epics):

1. **E57 (CSP Fix)** — FIRST, 1 hour (3 SP). Pure middleware + test change. Zero risk. Fixes a real billing breakage.

2. **E59 (OpenAPI Identity)** + **E61 (SHA Pins)** — SECOND, parallel (3+3 SP). Low-risk, mechanical changes. E59 immediately improves first-impressions for template users; E61 is a one-time security improvement.

3. **E58 (E2E CI)** + **E60 (GDPR Deletion)** — THIRD, parallel (8+8 SP). Higher effort but high impact. E58 completes the "Playwright installed but not in CI" gap. E60 closes the Privacy page commitment gap.

**Total effort**: ~2-3 sessions. No new infrastructure required. All changes are targeted and self-contained.

✅ APPROVED — 2026-03-17. All 5 epics approved as Phase 19.

### Cycle 5 — 2026-03-15 — Mode: audit (File Organization & Simplification)

**Theme**: "Reduce accidental complexity — remove dead files, consolidate redundancy, shrink the repo footprint"
**Proposed**: E51 (Dead File Cleanup), E52 (Epic Archive Consolidation), E53 (Strategy Log Compression), E54 (Design Artifacts Audit), E55 (Gitignore Cleanup). E56 (Batch Epic Learning) added during execution.
**Outcome**: All 6 epics approved as Phase 18. All delivered (PRs #74–#79). Deleted 5 dead files, moved 41 epic specs to archive, compressed strategy-log, audited design artifacts, verified gitignore coverage, added `/athena:learn --batch` mode.
**Total**: 19 SP. APPROVED — 2026-03-15.

### Cycle 4 — 2026-03-15 — Mode: auto (Beginner DX Depth)

**Theme**: "More focus on reducing the gap for beginners" — post-Cycle 3 depth pass
**Proposed**: E46 (Visual README & Onboarding Discovery), E47 (Full-Stack Domain Generator), E48 (Dev Container & Codespaces), E49 (Documentation Consistency Sweep), E50 (Example Domain README & CI Explainer)
**Outcome**: All 5 epics approved as Phase 17. E46 delivered (PR #68). E47-E50 in progress. Key findings: screenshot placeholder still empty, domain generator server-only (no client scaffolding), no Dev Container config, Node version mismatch in 5+ files, `/getting-started` page undiscoverable.
**Total**: 52 SP. APPROVED — 2026-03-15.

### Cycle 3 — 2026-03-15 — Mode: auto (Beginner DX Focus)

**Theme**: "Reduce the gap for starters/beginners to use this template"
**Proposed**: E41 (Zero-Config Dev Startup `make go`), E42 (README Rewrite), E43 (Bilingual Developer Docs), E44 (Guided First-Run Experience), E45 (Env Validation & Smart Defaults)
**Outcome**: All 5 epics approved as Phase 16. All delivered (PRs #61-#65). Transformed "first 5 minutes" from 9 manual steps to 1 command (`make go`). Added bilingual docs, guided tutorial, env validation (`make doctor`), README rewrite.
**Total**: 55 SP. APPROVED — 2026-03-15.

### Cycle 2 — 2026-03-14 — Mode: auto (Production SaaS Features)

**Theme**: Audit + evolve + comply — competitive gap analysis for SaaS template
**Proposed**: E34 (Template Hygiene: parameterize domain remnants), E35 (RBAC & Team Scoping), E36 (Stripe Billing), E37 (i18n Framework), E38 (Dependency Security & Node 22)
**Outcome**: All 5 epics approved as Phase 13. All delivered. Removed hardcoded `place_invested` remnants, added RBAC with roles/teams, Stripe billing integration, react-i18next i18n framework, Node 22 migration + npm audit fixes.
**Total**: 71 SP. APPROVED — 2026-03-14.

---

## Deferred Ideas

| Idea | Priority | Added | Notes |
|------|----------|-------|-------|
| Market data integration (price feeds) | P2 | 2026-03-13 | Domain-specific, not template concern. |
| Transaction history model | P2 | 2026-03-13 | Domain-specific, not template concern. |
| CSV/PDF export | P3 | 2026-03-13 | Portfolio reports, tax documentation. |
| PostGIS migration | P3 | 2026-03-13 | Replace Python Haversine with native spatial queries at scale. |
| React 19 + Router v7 migration | P3 | 2026-03-13 | No urgency, track for future. |
| slowapi replacement | P3 | 2026-03-13 | Unmaintained (last release 2024-02-05). Evaluate fastapi-limiter or custom middleware at Cycle 7. |
| Admin dashboard enhancement | P2 | 2026-03-14 | Current dashboard is static. Add user management, system health, audit log viewer. |
| GDPR data export (portability) | P2 | 2026-03-14 | Right to data portability (Art. 20) — export user data as JSON/CSV. Deletion covered by E60. |
| axe-core a11y CI gate | P3 | 2026-03-14 | Automate WCAG contrast checks in test suite. |
| Video tutorial / screencast walkthrough | P2 | 2026-03-15 | High impact for onboarding but requires different skillset (recording, editing). |
| Interactive playground / sandbox | P3 | 2026-03-15 | Hosted demo for zero-install evaluation. GitPod/CodeSpaces config. |
| VS Code extension for non-Claude users | P3 | 2026-03-15 | Expand tooling beyond Claude Code CLI. |
| Storybook for component documentation | P3 | 2026-03-15 | Component library showcase for UI developers. |
| API key management | P2 | 2026-03-17 | Machine-to-machine auth: allow users to create/revoke API keys. Common SaaS feature. |

---

## Industry Watch

| Date | Trend | Relevance |
|------|-------|-----------|
| 2026-03-14 | AI-assisted dev tools (Claude Code, Cursor, Copilot) becoming mainstream | Our AI agent system is a unique differentiator — double down on DX |
| 2026-03-14 | SaaS templates converging on auth+billing+teams as baseline | We now have all three (auth+RBAC+Stripe) — template is at table stakes |
| 2026-03-17 | SLSA framework adoption growing — supply-chain security required for enterprise | SHA-pinning GitHub Actions (E61) is the minimum viable SLSA L2 compliance |
| 2026-03-17 | GDPR enforcement increasing EU-wide — DPAs issuing fines for missing erasure endpoints | DELETE /users/me (E60) is no longer optional for any template claiming GDPR readiness |
