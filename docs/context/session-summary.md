# AI-Coding-Template — Session Summary
> **Tier 1 Project Memory** · Updated by all agents on Stop
> Load this file to resume any session without re-explaining context.

---

## Latest Session — 2026-06-13 (Next.js migration → production-ready + audit remediation)
Branch: `main` | Latest commits: `e7cd75a` (skills sweep #8), `f7c22fe` (#7), `a241a1d` Phase 57 (#6)

### Done this session (all merged to `main`, PRs #1–#8)
- **Migrated the whole app** from Vite SPA (`client/`) + FastAPI (`server/`) → **Next.js 16** in `next-app/`. Removed the legacy stack; unified the repo (deleted a stray nested `next-app/.git`).
- **Phase 53** (PR #1): shared Zod validations (`lib/validations/`), RBAC, account settings, admin panel, Playwright e2e, Vitest. e2e caught **2 critical pre-existing bugs**: (a) Credentials+DrizzleAdapter DB-session login was 100% broken → switched to **JWT sessions**; (b) dashboard `$count` crash on zero items.
- **Phase 54** (PR #2): shadcn blocks UI (login-01/signup-01/sidebar-01/dashboard-01) + **Dockerized** + athena hardening (pre-merge gate, husky/hooks fixed, P4 retro-spec). Bug: sidebar-01 needed a `TooltipProvider` (was crashing every dashboard page).
- **Phase 55** (PR #3): **3-tier RBAC** admin/editor/viewer (migration 0003 user→viewer) + demo seed; consolidated `docker-compose` to one stack + mailpit; athena worktree-parallel default.
- **Phase 56** (PR #5): shadcn **blue preset** `b1Yn96132` + full **繁體中文** i18n. (+ PR #4 demo quick-login buttons.)
- **Phase 57** (PR #6): ran a multi-agent **Workflow audit** (33 verified findings) then a remediation Workflow — security/auth hardening, WCAG a11y, i18n completeness, **built the Items CRUD feature**, cleanup/perf. **E236**: task-tiered model dispatch in `/athena:flow` + `/athena:batch` (sonnet baseline, opus for complex/ultra — no more blanket-Opus).
- **Skills** (PRs #7, #8): created `nextjs-saas-patterns` + `athena-loop-speedups` via skill-creator; deprecated dead-stack skills (server/client-patterns, dba-migrations) and updated 7 others to the Next.js stack.

### Current state
- **All green:** typecheck · lint (0 err) · 31 Vitest unit · 29 Playwright e2e; `docker compose up` verified by screenshot (blue theme + 繁中 + 3 roles + Items CRUD).
- **Run locally:** `docker compose up --build -d` → http://localhost:3000 · mailpit :8025. Logins: admin@/editor@/viewer@example.com (Admin123!/Editor123!/Viewer123!).
- **Gate before merge:** `scripts/pre-merge-check.sh [--e2e]`. **Auth rule:** JWT sessions required for Credentials; RBAC re-reads role from DB (see `nextjs-saas-patterns`).
- **Known limitation:** skill-creator's description optimizer needs `ANTHROPIC_API_KEY` (Claude Code uses OAuth) → descriptions hand-tuned; eval fixtures saved at `.claude/skills-workspace/`.

### Open / next
- Drafted (not started) `/goal`: deep-dive enhancement plan to make the whole project modular + AI-agent-ready / quick-start-able as a SaaS template.
- New docs: `docs/context/audit-2026-06-13.md` (full audit), `docs/context/loop-speedup-retro.md` (loop retro).

---

## Latest Session — 2026-05-30
Branch: `main` | Commit: `9a7753a docs(epics): plan Phase 47-49 — Foundation Truth + Ultracode Orchestration + Template↔Plugin`

### Done This Session
- **Deep enhancement audit via 2 multi-agent workflows** (each ending in an adversarial critique; load-bearing claims hand-verified against the repo): `athena-enhancement-research` (11 agents — Claude Code best-practices × 8 athena subsystems) + `ultracode-into-athena` (5 agents — extracted the ultracode effort-tier + Workflow mechanism, designed native embedding).
- **Cycle 21 planned & APPROVED via `/athena:plan`** → 11 epics **E193–E203** rendered by a parallel Sonnet workflow; `EPIC_INDEX.md` + `epic-progress.md` + `strategy-log.md` updated; DAG + Phase 47/48/49 waves verified.
  - **Phase 47 Foundation Truth** (E193–E197): pipeline-event instrumentation · skill-drift purge · generator/design-system realignment · state-file truth · memory-loop closure.
  - **Phase 48 Ultracode Orchestration** (E198–E201): user-selectable effort/cost dial (`quick|standard|thorough|ultra` + per-role model tiering) + Workflow-native qa/batch.
  - **Phase 49 Template↔Plugin** (E202–E203): dogfood-vs-canonical decision + athena-core hardening.
- **Committed `9a7753a`** (14 files). Push BLOCKED by `pre-bash-guard.sh:9` → awaiting user `!git push origin main`.
- **Fixed a latent bug found during verification**: `epic-graph.sh` glues inline `# comments` onto the last dep token (pre-existing, masked by sequential execution) → new deps written comment-free so Phase 47/48/49 waves parse correctly.

### Current State
- **Cycle 21 = APPROVED**; Phase 47–49 epics are **PENDING (⬜)** in both catalogs. Local commit `9a7753a` is **ahead 1, unpushed** (guard-blocked).
- Verified ground-truths reshaping the plan: `audit.jsonl` emits only memory events (no pipeline events → **E193** keystone); CI **deliberately disabled** 2026-05-20 (no re-arm proposed); `EPIC_INDEX` lagged `epic-progress` (→ **E196**); skills teach deleted patterns — adapter/“No Tailwind”/globals.css (→ **E194**); memory decay 3/4 dead + idempotency bug (→ **E197**).
- **Plan-completeness audit COMPLETE (4 agents)** — found a **CRITICAL hooks bug**: Stop-verifier **Rules 18/19/20 fail-OPEN on real `MH/feat/E{n}` branches** (regex expects lowercase `e` / no prefix → matches none) so the QA-gate (E155), migration-review (E157), and OpenAPI-contract (E156) gates **have never fired on an actual epic branch**. Also: PostToolUse(Bash) audit events aren't flowing (root cause behind E193); Rule 6 (OpenAPI drift) *mutates the working tree* mid-Stop + dual-openapi SSOT drift (`docs/openapi.yaml` 31KB vs `docs/openapi/openapi.yaml` 3.4KB actually bundled); ~40% of rule→lesson mappings missing; Rule 23 a no-op.
- **Scope verdict: ATHENA-ONLY.** The product is an *intentional* empty starter (`server/app/domains/` = `__init__.py` only); recent commits are 100% athena/docs/memory; the shipped deliverable is athena-core. Product's only real gaps are **doc-truth drift** (MEMORY.md/PRD claim domains live; test counts 216/383 vs real 515; RBAC/team-scoping oversold; Stripe dep dangling) → folds into Foundation-truth, NOT new product features.

### Next Actions (ordered)
1. `!git push origin main` — user runs it (agent-tool guard blocks the docs commit push; a bare push would dodge the regex, which we won't do).
2. **DECIDE (human gate): add hooks-hardening to Phase 47.** Audit recommends ~3 P0 epics — fix Rules 18/19/20 branch-regex (≈1-line, S/high — the QA gate is currently fail-open) + a **guard self-test canary** so a fail-open gate can't recur; expand **E193** to include audit-event root-cause + Rule 6 read-only + dual-openapi reconcile; one **doc-truth reconciliation** epic (domains/tests/roster/CI/Stripe).
3. Decide: `pre-bash-guard` docs-push whitelist → fold into **E196** or standalone.
4. Execute Phase 47: `/athena:loop` (one step) or `/loop 2m /athena:batch auto` → starts **E193** (keystone, no deps).

### Open Questions
- **Add the hooks fixes as new epics (E204+) or fold into Phase 47?** ← awaiting human call. Critical Rule 18/19/20 fix is a "just-do-it-now" S/high bug fix (could land before any epic).
- **Push policy**: `pre-bash-guard.sh` blocks ALL `git push origin main` (incl. docs) → contradicts `strategy-log`'s prescribed docs-push. Whitelist `docs:` / `chore(roadmap):`?
- **E200 / E202 are the consequential specs** (A-vs-B substrate → B chosen; dogfood-vs-canonical) — Sonnet-drafted; worth a human skim before execution.
- **Scope: RESOLVED → ATHENA-ONLY** (product stays an empty demo substrate; only doc-truth drift folds in).

---

## Session — 2026-05-20
Branch: `main` | Commit: athena-core v0.1.0-alpha — Phase 1 plugin shipped (9 milestones / 93 commits)

### Done This Session
- **athena-core Phase 1 built end-to-end** — distributable Claude Code plugin at `/Users/MH/Documents/git_saas/athena-core/`:
  - **M1 (scaffold)** — `.claude-plugin/plugin.json` manifest; extension registry (stop-rules / commands / agents / skills / spec-formats); `install.sh` idempotent installer; `INSTALL.md`
  - **M2 (memory)** — Ported `score.sh`, `match.sh` (+`--mode-auto` breadth), `inject.sh`, `half-life-resolve.sh`; `scripts/lib/common.sh` two-root resolver; hermetic test suites
  - **M3 (hooks)** — `hooks.json` (5 hooks); `stop-verifier.sh` meta-runner (dynamic rule discovery); `pre-bash-guard.sh`; session-start + subagent-stop hooks; `tests/test-hooks.sh`
  - **M4 (skills)** — `using-athena.md` gateway skill; `reviewer-convergence.md`; ported + sanitized tdd-workflow, verification-discipline, systematic-debugging, launch-checklist
  - **M5 (agents)** — 11 agents universalized (orchestrator, strategist, reviewer, qa, evaluator, debugger, best-practice, memory-curator, spec-writer, deployer, designer); prescriptive stack refs removed
  - **M6 (commands)** — 17 athena commands universalized; `implement.md` stack-detect logic; sanitization rule: parenthetical examples OK, prescriptive refs removed
  - **M7 (seed memory)** — 7 seed files: new-project-primer, testing-patterns (+Behavior Over Implementation), anti-patterns, failure-patterns, dx-patterns, security-learnings (+CSRF sec-012), workflow-patterns
  - **M8 (marketplace)** — `marketplace.json`; `README.md` (install badge + usage guide); `CHANGELOG.md`; `CONTRIBUTING.md`; `docs/ARCHITECTURE.md`; `docs/CUSTOMIZATION.md`
  - **M9 (CI + release)** — `.github/workflows/test.yml`; `tests/run-all.sh` auto-discovery runner; tagged `v0.1.0-alpha`

### Current State
| Layer | Status | Detail |
|---|---|---|
| Epics | ✅ 193/193 | E0 → E192 |
| Phases | ✅ 48/48 | Phase 0 → Phase 46 + Infra |
| athena-core plugin | ✅ v0.1.0-alpha | 9 milestones / 93 commits / master (local — push pending) |
| Agents | 11 | @designer (E163) |
| Commands | 24 athena + 1 pattern doc | + `/athena:plan brainstorm` (E187); `/athena:cycle` now brainstorm-first |
| Stop Verifier | 23 rules | +Rule #23 verification discipline (E188) |
| Themes | 6 | dark/indigo/navy/sage/rose/forest |
| Presets | 4 | default/compact/editorial/dense (E179) |
| Primitives | 40 in components/ui/ | + 3 in components/dashboard/ (E175) |
| Server tests | ~398 / 95.25% coverage | unit + integration + contract + hypothesis + schemathesis |
| Client tests | 515 / 89.31% stmts / 84.59% branches | 86 files |
| Memory pipeline | ✅ Full loop | retrieve → reinforce → decay → forget + brainstorm-aware retrieval (E189) |
| Brainstorm guides | ✅ Bilingual | `docs/guides/{en,zh-TW}/brainstorm-first.md` |

### Next Actions (ordered)
1. Create GitHub remote for athena-core: `gh repo create alexhsieh/athena-core --public` then `git push -u origin master && git push origin v0.1.0-alpha`
2. After remote is live: update `marketplace.json` GitHub URLs, create GitHub release for v0.1.0-alpha
3. After 30+ days of use: `/athena:promote --apply docs/context/promotion-proposals/20260519-brainstorm-first.md`
4. First dev-server CI run will mint VRT + a11y baselines (Option B from E171 + E177)

### Open Questions
- athena-core has no GitHub remote yet — pending `gh repo create alexhsieh/athena-core --public`

---

## Quick Reference
```
Pipeline: spec → implement → qa → commit → merge (QA mandatory before commit)
Auth: fastapi-users v15 — stateless JWT + refresh rotation with sha256 family revoke (E161)
Adapter pattern in api/auth.ts: DELETED in E161 — server returns unified AuthResponse
Themes: 6 (dark/indigo/navy/sage/rose/forest) + system; recipe in docs/design/css-architecture.md
Presets: 4 (default/compact/editorial/dense); cookbook in docs/design/PRESET_RECIPES.md (E179)
Production: Zeabur (make deploy ARGS="--first-time | --redeploy | --status | --env-only")
Observability: SENTRY_DSN_SERVER fail-fast in prod / no-op in dev; request_id in every log line
Coverage: client ≥80% / server ≥80% gate (Rule #18 enforces); current 89.31% / 95.25%
Stop-verifier: 23 rules, including #21 ban new pages/*.css, #22 ban new styles/common rules (E176)
Auto-promote: producer (agent tags) → proposer (PostToolUse hook drafts) → consumer (/athena:promote --apply)
Auto-compact: Stop hook runs scripts/archive-context.sh; per-file H2 limits; qa-patterns NEVER archived
Reviewer loop: scripts/reviewer-loop.sh — 4-round max, verdicts CONVERGED/STUCK/MAX_REACHED
Autopilot: /athena:autopilot <epic> — 4 confidence scorers; merge/prod-deploy default PAUSE
VRT: client/e2e/visual.spec.ts (E171 Phase A); pnpm test:e2e --project=visual --update-snapshots to seed
A11y: client/e2e/a11y.spec.ts + a11y-primitives.spec.ts (E177); pnpm test:e2e --project=a11y
Memory (E180–E186): /athena:metrics --memory dashboards 7 sections; /athena:forget archives weak Tier 0
Batch hardening: /athena:batch Step 3.5b auto-falls-back to --max-concurrent 1 if Agent isolation broken
athena-core: /Users/MH/Documents/git_saas/athena-core/ — v0.1.0-alpha local; push pending GitHub remote
```
<!-- last activity:  at 2026-05-19T16:55:15Z -->
<!-- last activity:  at 2026-05-19T16:58:27Z -->
<!-- last activity:  at 2026-05-19T16:58:59Z -->
<!-- last activity:  at 2026-05-19T18:25:43Z -->
<!-- last activity:  at 2026-05-20T00:00:00Z -->
<!-- last activity:  at 2026-05-30T03:35:22Z -->
<!-- last activity:  at 2026-05-30T03:35:32Z -->
<!-- last activity:  at 2026-05-30T03:35:49Z -->
<!-- last activity:  at 2026-05-30T03:36:21Z -->
<!-- last activity:  at 2026-05-30T03:36:30Z -->
<!-- last activity:  at 2026-05-30T03:36:33Z -->
<!-- last activity:  at 2026-05-30T03:41:24Z -->
<!-- last activity:  at 2026-05-30T03:41:42Z -->
<!-- last activity:  at 2026-05-30T03:42:24Z -->
<!-- last activity:  at 2026-05-30T03:42:55Z -->
<!-- last activity:  at 2026-05-30T03:43:33Z -->
<!-- last activity:  at 2026-05-30T03:45:09Z -->
<!-- last activity:  at 2026-05-30T03:46:22Z -->
<!-- last activity:  at 2026-05-30T03:46:30Z -->
<!-- last activity:  at 2026-05-30T03:46:54Z -->
<!-- last activity:  at 2026-05-30T03:47:46Z -->
<!-- last activity:  at 2026-05-30T04:11:14Z -->
<!-- last activity:  at 2026-05-30T04:11:15Z -->
<!-- last activity:  at 2026-05-30T04:11:16Z -->
<!-- last activity:  at 2026-05-30T04:11:17Z -->
<!-- last activity:  at 2026-05-30T04:11:19Z -->
<!-- last activity:  at 2026-05-30T04:11:27Z -->
<!-- last activity:  at 2026-05-30T04:11:33Z -->
<!-- last activity:  at 2026-05-30T04:11:35Z -->
<!-- last activity:  at 2026-05-30T04:12:18Z -->
<!-- last activity:  at 2026-05-30T04:12:22Z -->
<!-- last activity:  at 2026-05-30T04:12:23Z -->
<!-- last activity:  at 2026-05-30T05:10:14Z -->
<!-- last activity:  at 2026-05-30T05:10:35Z -->
<!-- last activity:  at 2026-05-30T05:11:47Z -->
<!-- last activity:  at 2026-05-30T05:13:37Z -->
<!-- last activity:  at 2026-05-30T08:22:06Z -->
<!-- last activity:  at 2026-05-30T11:18:14Z -->
<!-- last activity:  at 2026-05-30T17:35:50Z -->
<!-- last activity:  at 2026-05-31T14:21:27Z -->
<!-- last activity:  at 2026-05-31T14:22:14Z -->
<!-- last activity:  at 2026-05-31T14:22:30Z -->
<!-- last activity:  at 2026-05-31T14:22:34Z -->
<!-- last activity:  at 2026-05-31T14:22:47Z -->
<!-- last activity:  at 2026-05-31T14:22:50Z -->
<!-- last activity:  at 2026-05-31T14:23:31Z -->
<!-- last activity:  at 2026-05-31T14:23:50Z -->
<!-- last activity:  at 2026-05-31T14:24:23Z -->
<!-- last activity:  at 2026-05-31T14:24:34Z -->
<!-- last activity:  at 2026-05-31T14:25:12Z -->
<!-- last activity:  at 2026-05-31T14:25:12Z -->
<!-- last activity:  at 2026-05-31T14:27:41Z -->
<!-- last activity:  at 2026-05-31T14:28:36Z -->
<!-- last activity:  at 2026-05-31T14:30:29Z -->
<!-- last activity:  at 2026-05-31T14:41:32Z -->
<!-- last activity:  at 2026-06-01T11:29:40Z -->
<!-- last activity:  at 2026-06-01T12:15:36Z -->
<!-- last activity:  at 2026-06-01T12:16:24Z -->
<!-- last activity:  at 2026-06-01T12:18:48Z -->
<!-- last activity:  at 2026-06-04T01:41:37Z -->
<!-- last activity:  at 2026-06-04T01:50:11Z -->
<!-- last activity:  at 2026-06-04T03:39:15Z -->
<!-- last activity:  at 2026-06-12T19:19:52Z -->
<!-- last activity:  at 2026-06-13T04:31:42Z -->
<!-- last activity:  at 2026-06-13T04:31:50Z -->
<!-- last activity:  at 2026-06-13T04:31:51Z -->
<!-- last activity:  at 2026-06-13T04:32:37Z -->
<!-- last activity:  at 2026-06-13T04:35:41Z -->
<!-- last activity:  at 2026-06-13T06:11:06Z -->
<!-- last activity:  at 2026-06-13T06:46:18Z -->
<!-- last activity:  at 2026-06-13T06:53:00Z -->
<!-- last activity:  at 2026-06-13T07:07:44Z -->
<!-- last activity:  at 2026-06-13T07:13:42Z -->
<!-- last activity:  at 2026-06-13T08:26:43Z -->
<!-- last activity:  at 2026-06-13T08:28:48Z -->
<!-- last activity:  at 2026-06-13T08:29:21Z -->
<!-- last activity:  at 2026-06-13T08:54:19Z -->
<!-- last activity:  at 2026-06-13T08:55:06Z -->
<!-- last activity:  at 2026-06-13T08:55:35Z -->
<!-- last activity:  at 2026-06-13T08:55:55Z -->
<!-- last activity:  at 2026-06-13T08:56:06Z -->
<!-- last activity:  at 2026-06-13T08:56:09Z -->
<!-- last activity:  at 2026-06-13T08:56:10Z -->
<!-- last activity:  at 2026-06-13T08:56:17Z -->
<!-- last activity:  at 2026-06-13T08:56:21Z -->
<!-- last activity:  at 2026-06-13T08:56:25Z -->
<!-- last activity:  at 2026-06-13T08:56:40Z -->
<!-- last activity:  at 2026-06-13T08:56:47Z -->
<!-- last activity:  at 2026-06-13T08:56:52Z -->
<!-- last activity:  at 2026-06-13T08:56:59Z -->
<!-- last activity:  at 2026-06-13T08:57:02Z -->
<!-- last activity:  at 2026-06-13T08:57:16Z -->
<!-- last activity:  at 2026-06-13T08:57:19Z -->
<!-- last activity:  at 2026-06-13T08:57:36Z -->
<!-- last activity:  at 2026-06-13T08:57:37Z -->
<!-- last activity:  at 2026-06-13T08:57:37Z -->
<!-- last activity:  at 2026-06-13T08:57:38Z -->
<!-- last activity:  at 2026-06-13T08:57:52Z -->
<!-- last activity:  at 2026-06-13T08:58:04Z -->
<!-- last activity:  at 2026-06-13T08:58:06Z -->
<!-- last activity:  at 2026-06-13T08:58:14Z -->
<!-- last activity:  at 2026-06-13T08:58:17Z -->
<!-- last activity:  at 2026-06-13T08:58:20Z -->
<!-- last activity:  at 2026-06-13T08:58:26Z -->
<!-- last activity:  at 2026-06-13T08:58:28Z -->
<!-- last activity:  at 2026-06-13T08:58:29Z -->
<!-- last activity:  at 2026-06-13T08:58:35Z -->
<!-- last activity:  at 2026-06-13T08:58:36Z -->
<!-- last activity:  at 2026-06-13T08:58:36Z -->
<!-- last activity:  at 2026-06-13T08:58:38Z -->
<!-- last activity:  at 2026-06-13T08:58:48Z -->
<!-- last activity:  at 2026-06-13T08:58:48Z -->
<!-- last activity:  at 2026-06-13T08:59:12Z -->
<!-- last activity:  at 2026-06-13T08:59:15Z -->
<!-- last activity:  at 2026-06-13T08:59:19Z -->
<!-- last activity:  at 2026-06-13T08:59:21Z -->
<!-- last activity:  at 2026-06-13T08:59:26Z -->
<!-- last activity:  at 2026-06-13T08:59:29Z -->
<!-- last activity:  at 2026-06-13T08:59:32Z -->
<!-- last activity:  at 2026-06-13T08:59:43Z -->
<!-- last activity:  at 2026-06-13T08:59:48Z -->
<!-- last activity:  at 2026-06-13T08:59:53Z -->
<!-- last activity:  at 2026-06-13T09:00:08Z -->
<!-- last activity:  at 2026-06-13T09:01:03Z -->
<!-- last activity:  at 2026-06-13T09:12:21Z -->
<!-- last activity:  at 2026-06-13T09:15:38Z -->
<!-- last activity:  at 2026-06-13T09:22:53Z -->
<!-- last activity:  at 2026-06-13T09:25:17Z -->
<!-- last activity:  at 2026-06-13T09:30:17Z -->
<!-- last activity:  at 2026-06-13T09:32:35Z -->
<!-- last activity:  at 2026-06-13T09:35:56Z -->
<!-- last activity:  at 2026-06-14T16:25:56Z -->
