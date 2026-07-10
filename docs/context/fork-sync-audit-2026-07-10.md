# Template ↔ Fork（ai-rc-engineer-pm）雙向同步稽核 + 執行計畫

> 日期：2026-07-10 · 稽核方式：4 條平行唯讀稽核線（agents/commands · skills · scripts/hooks · fork 產品演化）
> 對象：TEMPLATE = `ai-coding-nexjs-template`（main @ 286ae89，含 PR #84–86 全部強化）
>       FORK = `../ai-rc-engineer-pm`（瑞成工程專案管理系統，v1.1.0，Phase 78 已核准進行中）

---

## 一、總體結論

1. **資產層（agents/commands/skills/scripts/hooks）流量壓倒性是 Template → Fork。** Fork 的 athena 資產停留在 ~2026-06 中的狀態，完全缺 2026-07-10 模板大稽核的所有成果：human-merge publish protocol、frontmatter 標準、telemetry 修復、state-update.sh、command-lint、skills 目錄正規化。
2. **Fork 有 4 個 CRITICAL 級安全缺口**（模板已修、fork 未修）：
   - `loop.md` / `batch.md` / `autopilot.md` 仍直接 `gh pr merge --auto` 自我合併
   - `ship.md` 在 main 上會**直接 push main 且無任何品質閘**（全案最危險的一條）
   - `pr.md` 的 Gate 2–4 在 repo root 跑 `pnpm install/build/test`（root 無 package.json，必炸）
   - `deployer.md` 允許直接 push main + force-push rollback
3. **Fork 有 9 個散裝 `.md` skills 永遠不會載入**（含 qa agent 引用的 `tdd-workflow.md`），其中 3 個還是 FastAPI/Vite 時代死內容。
4. **Fork → Template 回收方向較窄但真實**：RBAC「editNodes vs isAssigned」教訓、DB-backed login lockout、audit `onBehalf`、defineAction 文件、check:orphans 進 alignment-audit、redesign-bundle 回流協議等。
5. **根因**：兩 repo 各自演化、沒有 drift-check 機制覆蓋 fork（`make drift-check` 只看 athena-core plugin）。→ 戰略建議見 §五。

## 二、遷移風險邊界（絕不可覆蓋的 fork 內容）

- `CLAUDE.md` 產品身分全部（瑞成 PMS、三環境部署表、Phase 78 敘事）
- **Agent 人格名**（TONY·ATLAS·SAGE·PENNY·VERA·DOC·ARGUS·QUINN·JUDE·PORTER·DELTA·REMI·MAX）— 烙在每個 agent 的 `description:` 裡，`tony.md` 路由表依賴 verbatim
- 領域內容：badge-login（R#####）、seeds（seed-admin/seed-baseline split）、`docs/_handoff/` 設計包、`lib/rc-permissions.ts` 雙 guard family
- **Epic 編號撞號**：fork 的 E324–E327（產品硬化）≠ 模板的 E324–E325（backport wave）——任何跨 repo epic 編號假設都不安全
- 部署設定：`.zeaburignore`、`zbpack.json`、zeabur-deploy skill 內的 server/project ID
- Fork 刻意關閉的功能：email/OAuth、self-service password reset
- `stop-verifier.sh` Rule 2 guard 名單：合併時必須取**聯集**（模板 guard family + fork 的 `can()`/rc-permissions family），不能盲蓋
- **Phase 78 in-flight 碰撞面**：`lib/auth.ts`、`lib/schema/*`、`actions/cases/*`、`drizzle/migrations/` —— 本次遷移**只動資產層，不動 next-app code**（唯一例外候選：`lib/define-action.ts` 補 null-role guard，1 行、不在 P78 檔案清單內）

## 三、執行計畫（4 批）

### Batch F1 — Fork：CRITICAL 安全修復（自我合併 + 壞閘門）
> fork 分支 `chore/athena-sync-wave1`，一個 PR

1. 複製 `scripts/state/state-update.sh` + 2 個測試檔（commands 引用它，先到位）
2. `loop.md` / `batch.md` / `flow.md` — merge-careful：publish protocol、Step 1a reconciliation、stall breaker、state-update 整合、size tiering、Step 3.5 exit-code 修復、posture invariants；**保留** fork 的 CronList 自我取消行為決策（列為問題請示）、瑞成 SSOT 段落
3. `ship.md` / `pr.md` / `autopilot.md` — copy-verbatim 級（never-push-main、pre-merge-check 閘、AUTOPILot_ALLOW_MERGE 語意）
4. `deployer.md` — merge：pull-only、`model: haiku`、`/api/health`（先驗證 fork 健康端點路徑）、revert-not-force-push；保留瑞成三環境內容
5. `deploy.md` — 重寫為模板 runtime-vs-build-time 版；**保留** fork staging 慣例；清除 `VITE_*`/`SENTRY_DSN_SERVER` 死變數

### Batch F2 — Fork：agents frontmatter + telemetry/state 基礎設施
> fork 分支 `chore/athena-sync-wave2`，一個 PR

1. 12 個 agents：`name:` + `tools:` 標準（**逐檔保留 persona description**）；reviewer 輸出契約、qa +Agent tool + testing-strategy ref、debugger E159→Sentry、memory-curator mkdir、evaluator blessed-write、orchestrator effort-tier
2. hooks 全套 merge：`lib/audit-common.sh`（新）、`post-bash-dispatch.sh`（新）+ settings.json 收斂單一 entry、post-bash-log、audit-emit-pipeline、stop-verifier（**Rule 2 guard 聯集**）、session-start（log rotation + session-anchor）、context-health-monitor、subagent-stop-writeback、task-completed、user-prompt-submit、5 個小 hook
3. `scripts/checks/command-lint.sh`（新）+ pre-merge-check Gate 7；**先跑 lint 修 fork 自己的 findings**
4. `scripts/state/render-index.sh`（prose-preserving 版）——**先對 fork 真實檔案 dry-run diff 驗證再收**；`check-drift.sh` digest 版
5. 雜項：brainstorm-emit `size:`、forget.sh jq 修復、smoke.sh + `scripts/docs/anchor-check.cjs`、check-orphan-exports 更新、template-reset 修復、`.gitignore` 3 條、Makefile（`hook-test`/`verify`/dev-docs targets；**保留** fork 的 `deploy-zeabur` target）
6. 測試檔 6 個複製 + 全套 `make guard-selftest`/`hook-test`/state tests 驗證

### Batch F3 — Fork：skills 正規化 + 次要 commands
> fork 分支 `chore/athena-sync-wave3`，一個 PR

1. 9 個散裝 .md：刪 2 tombstone + `deploy-readiness.md`；`debugging`/`design-system`/`verification-discipline` 用模板目錄版；`openapi-first.md` → `spec-first/`（保留 E281 OpenAPI 段落）；`tdd-workflow.md` P1–P10 併回 `testing-strategy/` 後刪；`frontend-review.md` a11y/perf 內容嫁接進 security-audit 附錄後刪
2. 新 skills 安裝：`security-audit`（+a11y/perf 附錄）、`drizzle-migration-safety`、`release-versioning`
3. Merge：`testing-strategy`（保留瑞成測試數據 + RC_TODAY + war stories）、`chief-of-staff`（補路由列、保留產品列）、`deploy-config`
4. 次要 commands：`align.md`（CRUD 段、保留排除清單）、`design.md`（Step 6 頁面註冊，先驗 fork sidebar 結構）、`domain.md`（Step 5 --fields）、`qa-report.md`（epic 註冊——正中你 Tier-1 memory 記過的 gotcha）、`dashboard.md`、`save.md`/`load.md`/`implement.md`/`plan.md` 等小修
5. （單獨小 commit）`lib/define-action.ts` null-role guard 1 行 —— 若決定不碰 next-app code 則改開 fork issue

### Batch T1 — Template：回收 fork 精華
> template 分支 `feat/fork-backport-wave3`，一個 PR

1. `security-audit` skill 增補：editNodes-vs-isAssigned（authorization-flag vs ownership 混淆）、「UI-only constraint 必須 server 端重驗」兩課
2. `nextjs-saas-patterns` 增補：defineAction factory 文件化（模板有 code 沒文件）、DataTable container-query/`dense` 模式（先驗模板元件有無該 props）、三條泛化架構課
3. `alignment-audit` 補 `pnpm check:orphans` bullet；reviewer.md/audit.md 補「雙 guard family 取聯集」框架敘述
4. `user-guide-builder` 補 Cloudflare edge-cache 細節；Makefile 補 `deploy-zeabur` target（Road-1 對等）
5. **記入 backlog（不本次實作）**：DB-backed login lockout 模式（@saas auth 硬化）、audit `onBehalf` + login 事件（@saas/audit-log）、mockup-to-epics 增補 redesign-bundle 回流協議、`docs/architecture/product-overview.md` 單頁模式、OpenAPI 生成（fork E281）評估

## 四、執行安排

- 每批 = 專屬 subagent 工作包（**明確指定 model，禁 fable 繼承**）：機械複製 sonnet、merge-careful 命令檔（loop/batch/deploy/stop-verifier）由主迴圈或 opus 處理
- Fork main 目前領先 origin 2 個 commit（純狀態註記，低風險）——同步分支從 local main 切出、PR 順帶包含，保持線性
- 驗收：每批跑 fork 的 `make guard-selftest` + `bash scripts/checks/command-lint.sh` + state tests；F3 後跑一次 `/athena:load` 冒煙
- Publish：全部 push branch + 開 PR，**human merge**（fork 3 個 PR + template 1 個 PR）

## 五、戰略建議（兩 repo 各自怎麼強化）

1. **建立 template↔fork 資產 drift-check**（根因修復）：仿 E202 plugin 機制做 `scripts/sync-to-fork.sh --target ../ai-rc-engineer-pm` + 排除清單（persona/產品內容 sentinel 標記），`make drift-check` 加 fork 目標。skills 內容納入 drift 範圍（本次發現 testing-strategy/alignment-audit 各自演化正是漏這塊）。
2. **Fork**：先讓 Phase 78（E324–E327）落地再動任何 schema/auth 層；補 component-test 中層（模板 test/component/ 模式）列為 fork 下一個 epic；strategy-log 凍結在 Cycle 7 → 補一條「Phase 69+ 直接建 epic」的說明註記避免誤導。
3. **Template**：fork 的 E324/E325/E327 落地後，把 lockout/onBehalf 泛化成 `@saas` 模組（backlog 已記）；評估 OpenAPI 生成是否值得進模板。
4. **流程**：fork 每完成一個 phase，跑一次雙向 drift 稽核（可做成 `/athena:audit --fork` 子模式）。

## 六、四份原始稽核報告要點索引

- agents/commands 線：12+27 檔全數比對，檔名集合兩邊一致；`dba.md`/`learn.md`/`metrics.md` byte-identical
- skills 線：skills-lock.json 僅管 3 個 vendor skill、兩邊一致；`install-*` 一次性 skills 依「已安裝才裝」原則全部 skip
- scripts 線：fork scripts 層唯一獨有檔 `design-system-coverage.sh` 為 Vite 死碼，不回收
- fork 演化線：Phase 79（E328–E333）CR-pending 勿實作；stg/prd admin 密碼待輪換（fork 自身 ops 債，已在其 CLAUDE.md 記載）
