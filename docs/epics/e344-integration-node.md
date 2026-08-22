# E344 — 整合節點：`/athena:integrate` + @integrator

> Phase 83 · feature/orchestration · Cycle 37（graph-engineering 缺口分析，2026-08-22）
> Status: ⬜ pending
> Depends: none

## Problem

athena 的協調圖缺一個節點：**沒有任何角色負責「把大家的成果合起來會怎樣」**。

每個 epic 的 QA 只看自己那份 diff。`/athena:batch` 的 Step 4c 整合閘門是在**合併之後**
才跑，也就是說：問題被發現時已經在 `main` 上了，而且沒有任何東西指出是哪兩個 epic
互相作用造成的。

Phase 82 實際發生過一次，而且是唯一逃過所有關卡的缺陷：

| Epic | 各自的產出 | 各自的 QA |
|---|---|---|
| E336 | 側欄「管理」連結 → `/dashboard/admin` | ✅ PASS |
| E337 | admin 專屬 stat card「已驗證使用者」→ `/dashboard/admin` | ✅ PASS |

兩者**各自都正確**。合起來後 `a[href='/dashboard/admin']` 匹配到兩個元素，
Playwright strict mode 讓 `auth-flow.spec.ts:41` 與 `dashboard-smoke.spec.ts:22`
同時變紅 —— 它們一路溜進 `main`，直到人工跑 e2e 才被發現。

這不是誰的疏失，是**圖上少一個節點**。

## Solution

`/athena:integrate`（+ `.claude/agents/integrator.md`），在波次的分支都存在、各自 QA
通過之後、**publish 之前**執行。

### 協定

1. **收集波次分支** — 從 `epic-progress.md` / `epic-graph.sh` 取得本波 epic 與其分支名，
   確認每個分支存在且該 epic 的 `qa` 步驟為 ✅（未過 QA 的不進整合）。
2. **建立暫存整合分支** — `integration/phase{N}-wave{M}`，從當前 `origin/main` 切出，
   依序 merge 每個 epic 分支。**這個分支是拋棄式的，不 publish** —— publish 仍走各自的
   PR 以保留審查粒度。它唯一的職責是證明組合可行。
3. **跨分支檔案重疊偵測** — 對每一對分支計算 `git diff --name-only main..branch` 的交集。
   有交集不必然是錯（E339 動 E338 的 `_items-table.tsx` 是合理的），但**必須被列出並要求
   說明**，因為那正是組合缺陷最可能發生的位置。
4. **合併衝突處理** — 有衝突就停下並報告是哪兩個分支、哪些檔案。不自動解衝突。
5. **在合併結果上跑完整關卡** — 從 `next-app/`：
   `pnpm typecheck` · `pnpm lint` · `pnpm test:coverage` · `pnpm test:int` ·
   **`pnpm db:e2e-setup && pnpm test:e2e`**（e2e 是本 epic 的核心 —— Phase 82 那個缺陷
   只有 e2e 抓得到；DB 隔離已於 #117/#118 修好，e2e 現在真的跑得起來）。
6. **組合專屬失敗的歸因** — 這是本節點的關鍵價值。任一關卡在整合分支上失敗時，
   **對每個 epic 分支單獨重跑該關卡**：
   - 在某個單一分支上也失敗 → 那個 epic 的問題，回報給它
   - **每個分支單獨都通過、只有合併後失敗 → 組合缺陷**，回報涉及的分支對與失敗細節
   這個區分是人工很難做、機器很容易做的事。
7. **報告 + 清理** — 輸出結構化報告；無論成敗都刪掉暫存整合分支（可用 `--keep` 保留以便
   人工檢查）。
8. **回傳判定** — PASS → orchestrator 繼續 publish；FAIL → **停止 publish**，報告歸因結果。

### 接線

- `.claude/commands/athena/batch.md` — 在 publish 步驟**之前**插入整合節點；現有的
  Step 4c（merge 後整合閘門）保留為第二道防線，但主閘門前移。
- `.claude/commands/athena/flow.md`、`loop.md` — 波次概念適用處同步指路。
- `CLAUDE.md` — Slash Commands (epic) 區塊 + Agent Team 清單加入 @integrator。
- `docs/reference/agent-org-chart.md`（若存在）同步。

## Key Files
- `.claude/commands/athena/integrate.md`（新）
- `.claude/agents/integrator.md`（新）
- `.claude/commands/athena/batch.md`（插入整合節點）
- `CLAUDE.md`

## Acceptance Criteria
- [ ] `/athena:integrate --phase N` 可執行；未指定波次時自動取下一個「分支已存在且 QA 全過」的波
- [ ] 暫存整合分支建立→合併→跑關卡→**刪除**（`--keep` 可保留）；不論成敗都不留垃圾分支
- [ ] 跨分支檔案重疊清單正確列出（以 Phase 82 的 E338/E339 為驗證案例：應列出 `_items-table.tsx` 與 `e2e/items-mobile.spec.ts`）
- [ ] **e2e 納入整合關卡**且真的執行（附實際輸出，不接受「已跳過」作為通過）
- [ ] **組合專屬失敗的歸因可運作** — 以 Phase 82 的 E336+E337 撞號為回歸案例：
      在還原選擇器修正的狀態下重放該波，整合節點必須報出「兩分支單獨皆通過、合併後
      `auth-flow.spec.ts` 與 `dashboard-smoke.spec.ts` 失敗」並指名這兩個 epic
- [ ] FAIL 時 orchestrator 確實停止 publish（不是只印警告）
- [ ] 合併衝突時停下並指出分支對與檔案，不嘗試自動解
- [ ] `batch.md` 的插入是外科式的，不重寫既有協定；Step 4c 保留為第二道防線
- [ ] 去品牌化與路徑正確性：文件引用的每個路徑實際存在

## Cross-Epic
- E345 — 整合節點跑的關卡結果由帳本記錄；本 epic 先落地，E345 接在其上
- E340 `/athena:approve` — 同樣是「把人工跨面動作機械化」的形狀，協定寫法沿用
- #117 / #118 — e2e 的 DB 隔離已修好，這是本 epic 得以把 e2e 納入閘門的前提

## Out of Scope
- 自動解決合併衝突（永遠是人的判斷）
- 把整合分支當成 publish 對象（維持一 epic 一 PR 的審查粒度）
- 跨 phase 的整合（本 epic 的單位是「波」）
