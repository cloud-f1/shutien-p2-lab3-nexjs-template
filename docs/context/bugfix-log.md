# Bugfix History Log

> Auto-appended by PostToolUse hook on `fix:` commits.
> Root cause and test fields are enriched during `/athena:save`.

---

## 2026-04-13T15:20:27+08:00 — cf58de7
**Message:** fix(talk): wire 'b' hotkey to appendix + mark build.sh executable
**Files:** docs/presentations/ai-coding-template-talk/build.sh,docs/presentations/ai-coding-template-talk/scripts/main.js
**Root Cause:** _(pending — enrich during /athena:save)_
**Test Added:** _(pending)_

## 2026-05-30T19:08:13+08:00 — c9f8a47
**Message:** fix(hooks): scope destructive-SQL guard to real DB execution + backfill rule-lesson map + prune dead template
**Files:** .claude/agents/domain-expert.md.tmpl,.claude/commands/athena/domain.md,scripts/hooks/pre-bash-guard.sh,scripts/hooks/rule-to-lesson.json
**Root Cause:** _(pending — enrich during /athena:save)_
**Test Added:** _(pending)_

## 2026-05-31T01:32:11+08:00 — fd70ac9
**Message:** fix(hooks): E204 — repair fail-open QA gate (Rules 18/19/20 branch matcher) + fail-open canary
**Files:** Makefile,docs/context/epic-progress.md,docs/epics/EPIC_INDEX.md,scripts/hooks/CLAUDE.md,scripts/hooks/stop-verifier.sh,scripts/hooks/tests/test-stop-verifier-canary.sh
**Root Cause:** _(pending — enrich during /athena:save)_
**Test Added:** _(pending)_

## 2026-05-31T22:37:40+08:00 — c1a1065
**Message:** fix(memory): lesson-tags branch-cue fail-open — match feat/E{n} (same class as E204)
**Files:** scripts/memory/lesson-tags.json
**Root Cause:** _(pending — enrich during /athena:save)_
**Test Added:** _(pending)_

## 2026-06-04T09:45:35+08:00 — 5b23f2d
**Message:** fix(flow): adversarial-validation fixes for /athena:flow (E216)
**Files:** .claude/commands/athena/flow.md,docs/context/epic-progress.md,docs/context/strategy-log.md,docs/epics/EPIC_INDEX.md,docs/epics/e216-athena-flow.md,docs/superpowers/specs/2026-06-04-athena-flow-design.md,scripts/flow-tests/test-flow-command.sh
**Root Cause:** _(pending — enrich during /athena:save)_
**Test Added:** _(pending)_

## 2026-06-15T00:38:10+08:00 — 53a5771
**Message:** fix: commit the correct working-tree blobs for the modular graft
**Files:** docs/context/session-summary.md,next-app/components.json,next-app/drizzle/migrations/meta/_journal.json,next-app/lib/schema.ts,next-app/package.json,next-app/pnpm-lock.yaml,next-app/public/r/registry.json,next-app/registry.json
**Root Cause:** _(pending — enrich during /athena:save)_
**Test Added:** _(pending)_

## 2026-06-15T02:10:58+08:00 — a967653
**Message:** fix(flow): await pipeline() in the wave loop
**Files:** .claude/commands/athena/flow.md
**Root Cause:** _(pending — enrich during /athena:save)_
**Test Added:** _(pending)_

## 2026-06-15T03:53:39+08:00 — 375317f
**Message:** fix(E261): replace removed lucide `Github` icon + harden smoke.sh
**Files:** next-app/components/marketing/cta.tsx,scripts/smoke.sh
**Root Cause:** _(pending — enrich during /athena:save)_
**Test Added:** _(pending)_

## 2026-06-15T13:57:45+08:00 — 7b3c85c
**Message:** fix(flow): worktree-readiness gotcha — node_modules + shadcn-add + .claude
**Files:** .claude/commands/athena/flow.md
**Root Cause:** _(pending — enrich during /athena:save)_
**Test Added:** _(pending)_

## 2026-06-15T16:03:17+08:00 — e4572cc
**Message:** fix(smoke): abnormal-exit guard — distinguish harness crashes from gate failures
**Files:** scripts/smoke.sh
**Root Cause:** _(pending — enrich during /athena:save)_
**Test Added:** _(pending)_

## 2026-06-15T18:21:25+08:00 — 08ae639
**Message:** fix(ui): topbar on all dashboard routes + unify brand + light shimmer + e2e
**Files:** next-app/app/(auth)/layout.tsx,next-app/app/(dashboard)/dashboard/page.tsx,next-app/app/(dashboard)/layout.tsx,next-app/app/cobalt-fx.css,next-app/components/app-sidebar.tsx,next-app/components/marketing/marketing-footer.tsx,next-app/components/marketing/marketing-nav.tsx,next-app/e2e/cobalt-ui.spec.ts
**Root Cause:** _(pending — enrich during /athena:save)_
**Test Added:** _(pending)_

## 2026-06-30T09:03:58+08:00 — 063c86f
**Message:** fix(batch): auto-stop cron loop when no pending phases remain
**Files:** .claude/commands/athena/batch.md
**Root Cause:** _(pending — enrich during /athena:save)_
**Test Added:** _(pending)_

## 2026-06-30T19:57:22+08:00 — ecc3bbc
**Message:** fix(loop): auto-stop cron loop when all phases are complete
**Files:** .claude/commands/athena/loop.md
**Root Cause:** _(pending — enrich during /athena:save)_
**Test Added:** _(pending)_

## 2026-07-10T13:20:12+08:00 — 662424d
**Message:** fix(athena): align deploy.md Gate 6 + health path with deployer.md
**Files:** .claude/commands/athena/deploy.md
**Root Cause:** _(pending — enrich during /athena:save)_
**Test Added:** _(pending)_

## 2026-07-10T13:46:17+08:00 — 46446ca
**Message:** fix(ci): add packageManager to dev-docs/user-docs package.json
**Files:** dev-docs/package.json,user-docs/package.json
**Root Cause:** _(pending — enrich during /athena:save)_
**Test Added:** _(pending)_

## 2026-08-22T15:21:51+08:00 — acf1fa8
**Message:** fix: hook 測試洩漏宿主狀態 + e2e 與開發共用資料庫 (#117)
**Files:** .claude/skills/testing-strategy/SKILL.md,CLAUDE.md,docker-compose.yml,next-app/drizzle/e2e-setup.ts,next-app/package.json,next-app/playwright.config.ts,scripts/hooks/context-health-monitor.sh,scripts/hooks/tests/test-context-health-monitor.sh
**Root Cause:** _(pending — enrich during /athena:save)_
**Test Added:** _(pending)_

## 2026-08-22T16:21:12+08:00 — d58c01b
**Message:** fix(docker): 移除硬編容器名 + 修好被兩個 epic 撞出來的 e2e 選擇器
**Files:** docker-compose.yml,next-app/e2e/auth-flow.spec.ts,next-app/e2e/dashboard-smoke.spec.ts
**Root Cause:** _(pending — enrich during /athena:save)_
**Test Added:** _(pending)_

## 2026-08-23T20:56:13+08:00 — 8915c9d
**Message:** fix(E350): listSalesPages 移出公開介面 — 草稿銷售頁不再洩漏 (#131)
**Files:** next-app/actions/sales-pages.ts,next-app/app/(dashboard)/dashboard/admin/sales-pages/page.tsx,next-app/lib/sales/queries.ts,next-app/test/int/sales-pages.int.test.ts
**Root Cause:** _(pending — enrich during /athena:save)_
**Test Added:** _(pending)_

## 2026-08-24T22:57:32+08:00 — b569b9a
**Message:** fix(2FA): otplib epoch 單位錯誤導致兩步驟驗證完全失效
**Files:** next-app/e2e/two-factor.spec.ts,next-app/lib/totp-utils.test.ts,next-app/lib/totp-utils.ts
**Root Cause:** `verifyToken()` 把毫秒傳給 otplib v13 的 `epoch` 選項，但該選項單位是「秒」
——伺服器比對 step `floor(ms/30)` 而非 `floor(sec/30)`，真實驗證器 App 的碼永遠不符，2FA
在正式環境完全失效（連啟用都過不了）。skew 容忍量 `±PERIOD*1000` 也變成 ±8.3 小時。
**[GENERALIZABLE] 為什麼沒被抓到:** 單元測試的 `tokenAt()` helper 用了同一個錯誤單位，
與產品程式碼自洽 → 22 個斷言全綠而功能是死的（「綠燈但壞掉」）。**當測試 helper 重新實作
產品程式碼的計算方式時，它驗證的是「兩邊一致」而非「行為正確」。** 對協定型程式碼
（TOTP/HMAC/簽章）至少要有一個斷言用外部/標準來源產生期望值，不要自己算。
唯一算對的是 e2e（不帶 epoch，用函式庫自己的時鐘），但它自 Phase 72 起無人跑得動——
**跑不動的測試等於沒有測試**，紅燈被擱置 13 個 phase。
**Test Added:** `lib/totp-utils.test.ts` — 「accepts a token from a standards-correct client」
用不帶 epoch 的 `generateSync`（＝真實驗證器算法）對 `verifyToken` 的預設時鐘，兩邊單位
一致才會過；修正前紅、修正後綠。另修好 3 個被此 bug 遮住、從未執行過的 e2e 缺陷
（teardown 順序倒置、`afterEach` 打斷 `describe.serial` 鏈、3 處過寬 locator）。

## 2026-08-28T01:37:56+08:00 — 6e85c4b
**Message:** fix(E366): allowlist totalPages() as an intentional public pagination-math API
**Files:** scripts/check-orphan-exports.mjs
**Root Cause:** _(pending — enrich during /athena:save)_
**Test Added:** _(pending)_

## 2026-09-09T20:54:13+08:00 — 6f220d1
**Message:** fix(E368): 影響列數與稽核完整性 — 把 items.ts 的正確寫法推及全類 + Rule 26
**Files:** next-app/actions/admin.ts,next-app/actions/api-keys.ts,next-app/actions/notifications.ts,next-app/actions/team.ts,next-app/actions/webhooks.ts,next-app/test/int/rows-affected-audit.int.test.ts,scripts/hooks/CLAUDE.md,scripts/hooks/lib/rows-affected-scan.awk,scripts/hooks/stop-verifier.sh,scripts/hooks/tests/test-rule-26-rows-affected.sh
**Root Cause:** _(pending — enrich during /athena:save)_
**Test Added:** _(pending)_

## 2026-09-12T17:50:05+08:00 — 84c5076 (squashed as ac750e0, PR #206)
**Message:** fix(hooks): archive-context.sh must not evict undated reference sections
**Files:** scripts/archive-context-tests/test-h3-fixture.sh,scripts/archive-context.sh,scripts/hooks/tests/test-archive-context-undated-sections.sh
**Root Cause:** The dated-entry rule was added to the "newest" entry order only
(PR #204). Oldest-first files still counted every heading as an entry, so
review-findings.md's undated `## Severity Levels` legend ranked as entry #1 and
was archived as "the oldest" once the file reached its 15-entry limit. The file
preamble had the same defect independently: it ranked 0 and `0 <= cutoff`, so it
was archived too. Fired twice on 2026-09-12 nine minutes apart — the second time
with #204 already merged, which is what showed #204 had only covered half the
class.
**Test Added:** scripts/hooks/tests/test-archive-context-undated-sections.sh (8
assertions across both entry orders). test-h3-fixture.sh scenario C kept its
assertion but its fixture now carries dates, since undated headings are reference
blocks by contract.
