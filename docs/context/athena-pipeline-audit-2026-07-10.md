# Athena Pipeline 全面稽核報告 — 2026-07-10

> 範圍：12 agents · 27 athena commands · 24 正規 skills + 10 散落 .md · 22 hooks + settings.json + 支援腳本。
> 方法：5 條並行稽核線，每個引用路徑逐一驗證存在性、script CLI 介面與文件比對、live audit.jsonl（3,434 行）實測。
> 統計：**Critical 4 · High 13 · Medium 21 · Low 16**。全部 major scripts（effort/resolve.sh、epic-graph.sh、pre-merge-check.sh、memory/*、confidence/*）皆存在且介面吻合 — 缺陷集中在「內容/一致性」而非斷鏈。

---

## 一、總體結論

系統骨架健康：dba/designer/evaluator/reviewer 的 agent 合約、qa.md 的失敗處理（MAX_ITERATIONS、token budget、STUCK 偵測）、autopilot 的 merge 安全模型、memory 五件組的 script 契約，都是高水準設計。

缺陷聚成 **4 個系統性主題**：

1. **Merge 權限假設錯誤（會讓 cron 卡死）** — loop/batch/ship 假設 agent 能 merge PR；實際 GitHub 權限是 pull-only。autopilot 是唯一做對的（`AUTOPILOT_ALLOW_MERGE` gate）。
2. **FastAPI/Vite 遷移殘留** — 集中在 reactive hooks（pre-bash-guard、post-bash-failure-inject、worktree-setup、pr-created）、deploy.md env 表、debugger E159、dashboard server/client 分欄、3 個死掉的 deploy skill 檔。
3. **遙測半邊全滅** — `post-bash-log.sh` 的 `--argjson unknown` bug 導致 **bash/agent_complete 事件從未寫入過**（3,434 行中 0 筆）；`state_drift` 佔 98% 噪音把 context-health monitor 永久釘死在 red；stop-verifier block flag 從未被寫入 → `/athena:metrics` 實際上一直是空的。
4. **Frontmatter / 載入格式風險** — 12 個 agent 全用 `allowed-tools:`（非標準 `tools:`）且缺 `name:`，唯讀保證可能整體失效；plan/promote/forget 三個 command YAML 壞掉；10 個散落 .md 根本不是合法 skill 卻被 stop-verifier 和 qa.md 當作會自動載入。

---

## 二、Critical 發現（4）

| # | 位置 | 問題 | 修法 |
|---|---|---|---|
| C1 | `loop.md:43,46`、`batch.md:149,483,783`、`ship.md:27` | merge 步驟用 `gh pr merge`（pull-only 權限必失敗）；ship 在 main 上直接 push main 繞過所有 gate | 統一「publish step」：push branch → `gh pr create` → 寫 `⏸ awaiting human merge (PR #N)` → EXIT；下次呼叫用 `gh pr view --json state` 對帳翻 ✅。仿 autopilot 的 gate 模型 |
| C2 | `deploy.md:12-15` | env 表是已刪除的 Vite/FastAPI 雙服務（`VITE_SENTRY_DSN`、server+client service IDs） | 重寫為單一 next-app service：runtime vs `NEXT_PUBLIC_*` build-time（E322），連結 deploy/deploy-zeabur.sh + Road 2 |
| C3 | `scripts/hooks/post-bash-log.sh:7,29` | `jq --argjson exit unknown` 報錯 → bash 事件永久靜默丟失，metrics 無資料 | exit code 非數字時 fallback `-1`；補 regression fixture |
| C4 | `stop-verifier.sh:262`、`qa.md:204` | 指向散落 .md「假 skill」（verification-discipline、tdd-workflow）— 內容從不載入，但 Rule 23 的補救指引依賴它 | verification-discipline 轉正為目錄 skill + 改 hook 指標；tdd-workflow 併入 testing-strategy + 改 qa.md |

## 三、High 發現（13）

1. **`pr.md:13-21`** — Gates 2–4 在 repo root 跑 pnpm（無 package.json，全數立即失敗）→ 改呼叫 `scripts/pre-merge-check.sh [--e2e]`。
2. **`implement.md:9`** — spec 讀 `docs/specs/$ARGUMENTS.md`；epic spec 實際在 `docs/epics/e{n}-*.md` → Glob epics 優先。
3. **`batch.md:267` vs `:18,:414`** — Step 3.5 隔離探針在 auto mode 的觸發條件自相矛盾（照 :267 會無探針並行 4 agent，重演 Phase 45 事故）→ 改為「僅當 MAX_CONCURRENT==1 或單 epic 時跳過」。
4. **12 agents frontmatter** — 缺 `name:`、用 `allowed-tools:` 非 `tools:` → 唯讀 agent 可能拿到全部工具；同步影響 athena-core plugin。
5. **QA 三人組工具矛盾** — qa.md 被要求 spawn @dba/@debugger 但無 Agent tool；reviewer/evaluator 被要求 append 檔案但無寫入工具 → 明確合約（dispatcher-writes 或 scoped 授權）。
6. **`evaluator.md:22`** — 指定文件 `docs/context/evaluation-log.md` 不存在（qa.md:291 也依賴）→ 提交 stub。
7. **`plan.md:2`、`promote.md:2-4`、`forget.md:2-4`** — YAML frontmatter 壞掉（嵌套引號 / 孤兒續行）→ 已實證 loader fallback 到 H1，TONY 路由描述失效。
8. **`qa-report.md:107-116`** — approve 只寫 EPIC_INDEX，不寫 epic-progress.md Phase Status row → 核准的 epic 對 loop/batch 隱形（repo 自己記錄過的教訓）→ 抽出共用「epic 註冊」程序。
9. **`save.md:14-15,45-47`** — 寫入不存在的 TECHSTACK.md §12/S13、CLAUDE.md「Active Track」→ 改 targets（注意 `user-prompt-submit.sh` 的 write-back banner 也寫 §12，要一起改）。
10. **`debugger.md:153-167`** — E159 request_id 節全是 FastAPI 殘留（`RequestIDMiddleware`、死連結 sre-observability.md），「No request_id, no triage」會擋掉所有 triage → 刪除或改寫為 Sentry event ID。
11. **`audit-emit-pipeline.sh:64,81`** — macOS bash 3.2 空陣列 `unbound variable`，零參數呼叫必死且被 `|| true` 吞掉 → `${JQ_ARGS[@]+"${JQ_ARGS[@]}"}`。
12. **`subagent-stop-writeback.sh:102` / stop-verifier** — `.claude/.stop-verifier-blocked` flag 沒有任何 writer → `failure` status 永不可達 → stop-verifier exit-2 分支補 `touch`。
13. **`worktree-setup.sh`** — 未掛載（registry 表宣稱 WorktreeCreate 不存在）且複製死掉的 `server/.env`/`client/.env`、漏掉 `next-app/.env*` — 可能是 batch worktree 隔離不穩的元兇。另 `pr-created.sh` reviewer 自動指派因 `^server/`/`^client/` 計數恆為 no-op。

## 四、Medium 重點（21，摘選）

- **`state_drift` 洪水**：98% 噪音 + printf 未跳脫引號可產生壞 JSONL + context-health 永久 red → 每次 Stop 只 emit 一筆 summary、jq 跳脫、health proxy 改 session-scoped + log rotation。
- **batch.md 內部矛盾三連**：`:287-291` probe exit code 取到 `tail` 的（永遠 0）+ 函式外 `return`；`:578` vs `:488` checkout-main 兩說；Guard 5 vs parallel posture 的 wave barrier 矛盾 → 集中成一段「Posture invariants」。
- **`flow.md:212`** chain mode 硬編碼 opus（違反自家 tiered dispatch）；`flow.md:20` 只讀 env 不讀 `--effort` flag；flow 標記 ✅ 的 cell 粒度未定義（會讓 loop 漏掉 merge step）。
- **複雜度分級無資料來源**：EPIC_INDEX 矩陣沒有 Size 欄 → 全部 fallback「simple」→ 複雜 epic 靜默降級 sonnet → 加 Size 欄。
- **老 stack 殘留 sweep**：`pre-bash-guard.sh`（Alembic 訊息、backend/frontend 指引錯誤）、`post-bash-failure-inject.sh`（12 個 pattern 中 ~8 個死 stack，會注入誤導性建議）、`dashboard.md` + `batch.md:709` server/client 分欄、`deployer.md`（/health 應為 /api/health、幻想的 GitHub Actions→Zeabur、develop branch、force-push rollback）、`memory-curator.md` python-jose 範例、`post-test-coverage-gate.sh` pytest 優先解析、`scripts/design-system-coverage.sh`（量測不存在的 client/src → 刪）。
- **散落 skill 檔分類**：DELETE `deploy-gcr-zeabur.md`、`launch-checklist.md`；MERGE `deploy-readiness.md`(Tier1→deploy-config)、`tdd-workflow.md`(→testing-strategy)、`frontend-review.md`(→reviewer)；CONVERT `verification-discipline`、`debugging`、`upgrade-stripe`、`design-system`（修幻影 Rule #21/#22 + 虛構 barrel import）、`openapi-first`→`spec-first`（`lib/types/` 不存在，實際是 Zod-first）。同步更新 `new-project.sh:47`、`template-reset.sh:174`、`TEMPLATE-VS-PRODUCT.md:62-63` 的引用。
- **`auto-promote-check.sh`** watermark 不前進 → proposal 洗版；**epic-ID 抽取**大小寫規則 6 個 hook 不一致（`feat/e12-` 被半數 hook 標成 none）→ 抽共用 helper。
- **`design.md`/`designer.md`** `--layout=dashboard` 產出的頁面 URL 深度錯（`/<slug>` 而非 `/dashboard/<slug>`）且無 sidebar/breadcrumb 註冊步驟 → align 會判 orphan page。
- **`domain.md`** `--fields` 從未成為明確步驟（可能只 scaffold title-only 就停）；usage 與 script 實際 CLI 不符。
- **gate 編號漂移**：`pre-deploy-guard.sh` 的 Gate 5/6 訊息 vs `deployer.md` 定義不一致。
- **Rule 4/5 範圍問題**：console.log 檢查 repo-global（doc-only session 也會被前人違規擋下）；Rule 5 只看 staged、漏 untracked 新檔。
- **Rule 23 降級**：無 python3 時 fallback 接受任何歷史 verification_check（10 分鐘窗消失）→ 純 shell date 比較。
- **`Task` vs `Agent`** legacy tool 名散在 spec-writer/spec/save/design；`loop.md`/`batch.md` 列不存在的 `CronList/CronDelete`（自動停 cron 路徑不可執行 → 改為回報請使用者停）。
- **CLAUDE.md「Active Epic」已過時**（寫 Phase 75 pending，實際 EPIC_INDEX 標 75–76 ✅ 完成、backlog drained）。

## 五、Low 摘選（16）

qa.md/batch.md 編號跳號；`dashboard.md:80,238` skill 計數只數散落 .md（改 `ls -d */`）；install-ecpay-billing frontmatter 格式與 6 個兄弟不一致；rebrand/user-guide-builder 配對 repo 外的 gh-cf-deploy（fork 斷路，加 fallback 註記）；tony.md 無 frontmatter；`sync-to-plugin.sh` hooks 同步對是 no-op 卻印 [OK]；`user-prompt-submit.sh` write-back banner regex 過寬；`docs/context/review-log.md` 無主；hooks/CLAUDE.md registry 表漏 3 個已掛載 hook、Rule 2 漏 `defineAction(`；smoke-test.sh vs smoke.sh 重複。

## 六、缺口 — 建議新增

**新 skills（優先序）**：
1. `security-audit` — qa --review-only 承諾 security audit 但無 backing skill；編碼本 stack 真實攻擊面（Server Action = public POST → Rule 2 guard family、getLiveRole、Zod 驗證、webhook signature）。
2. `drizzle-migration-safety` — @dba 無 backing skill：破壞性變更偵測、expand-migrate-contract、backfill/rollback SOP。
3. `debugging` — 免費（散落檔已是 current，轉正即可；@debugger 目前無任何 skill）。
4. `release-versioning` — SemVer→package.json→APP_VERSION→tag 流程只活在 CONTRIBUTING 散文。
5. `performance-audit`、`i18n-coverage` — 次優先。

**新機制**：
- **Command/agent lint 進 pre-merge-check**：YAML frontmatter 可解析、引用路徑存在、tool 名在 harness 白名單、stale-stack token（pytest/uvicorn/client//server//VITE_）— 本報告多數問題可自動抓。
- **`lib/audit-common.sh`** 共用 emitter（repo-root、epic 抽取、jq-safe emit_jsonl）。
- **hooks 測試接進 make guard-selftest**（現有 12 組 fixture 沒進任何 make target/CI）+ 補 post-bash-log、audit-emit-pipeline fixtures。
- **state-update helper**：`state-update.sh E{n} step status` 取代 4 個 command 手改雙檔。
- **stall breaker**：loop/batch auto 查 audit.jsonl，同一 epic+step 連續 K 次失敗 → 硬停 cron 要求人工。
- **pipeline 觀測事件**：loop_step / batch_wave_start|end。
- **TONY 路由表補齊**：align/audit/learn/save/qa-report/domain/new-project/user-guide 無路由。
- **PostToolUse(Bash) 四 hook 合併 dispatcher** + audit.jsonl rotation（>5MB 滾動）。

---

## 七、分批執行計畫

### Batch 1 — Critical + 安全（pipeline 正確性）
1. Human-merge protocol：loop/batch/ship 統一 publish step + 對帳規則；ship 禁 push main
2. pr.md Gates 2–4 → pre-merge-check.sh；implement.md spec 路徑修正
3. deploy.md 重寫（單服務 env 表 + 7 gates 內嵌 + 交棒使用者 push/merge）
4. Audit-integrity 三連修（post-bash-log、audit-emit-pipeline bash3.2、block flag）+ regression fixtures
5. verification-discipline 轉正 + stop-verifier/qa.md 指標修正

### Batch 2 — High 一致性
6. 12 agents frontmatter 標準化（name: + tools: + Task→Agent）+ lint 進 pre-merge-check
7. QA 三人組工具/合約調和；evaluation-log/autopilot-log stub；Tier 0 bootstrap
8. plan/promote/forget frontmatter 修復
9. 共用 epic 註冊程序（plan + qa-report）
10. batch.md 矛盾調和（Step 3.5 / checkout / Guard 5 / probe exit code）→ Posture invariants 段
11. state_drift 節流 + context-health session-scoped + health-state 重置
12. save.md / user-prompt-submit.sh 寫入目標修正

### Batch 3 — 老 stack 清除 + skills 整理
13. Hooks sweep：pre-bash-guard、post-bash-failure-inject（換 nextjs-saas-patterns gotchas）、worktree-setup（掛載 + next-app/.env*）、pr-created reviewer 邏輯、post-test-coverage-gate、design-system-coverage.sh 刪
14. Agents sweep：debugger E159、deployer 全面校正、memory-curator 範例、dashboard.md/batch.md server-client 殘留
15. 散落 skills 處置：2 DELETE、3 MERGE、4 CONVERT + 3 個引用檔同步更新
16. flow.md（opus 硬編碼、effort flag、✅ 粒度）+ EPIC_INDEX Size 欄
17. epic-ID helper（lib/audit-common.sh）+ emitter 統一
18. 文件再同步：hooks/CLAUDE.md registry、CLAUDE.md Active Epic、design.md 路徑深度、domain.md --fields 步驟

### Batch 4 — 強化新增
19. 新 skills：security-audit、drizzle-migration-safety、debugging（轉正）、release-versioning
20. hooks 測試接 make target + 新 fixtures
21. TONY 路由表補齊
22. state-update.sh helper + stall breaker + pipeline 事件
23. PostToolUse dispatcher 合併 + log rotation
24. Low 清尾（編號、計數、frontmatter 格式、sync-to-plugin [SKIP] 標示等）

> 每個 Batch 完成後跑 `scripts/pre-merge-check.sh` + `make guard-selftest`，走 branch + PR（agent 不 merge），並執行 `make drift-check` 確認 athena-core sync 邊界。
