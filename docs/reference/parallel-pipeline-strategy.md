# 並行 Epic 管線策略

> **🏁 COMPLETED** — 2026-03-28
>
> Phase 25 (E82–E86, PRs #115–#119) + Phase 26 (E87–E90, PR #120) 全部交付。
> 所有 5 項策略均已實作或由已交付工具支援。
>
> 當 Epic 數量 > 10 時，serial `athena:loop` 效率不足。本文件記錄並行化策略。

---

## 瓶頸分析

`athena:loop` 單次執行一個 Epic：`spec → implement → qa → commit → merge`。
每個 Epic 約 10–30 分鐘，60 個 Epic = **10–30 小時**（序列）。

---

## 策略一：同終端並行 Worktree（最佳 ROI） ✅ DELIVERED

> 實作：`/athena:batch` (E85 PR#118) + `@orchestrator` (E86 PR#119) + `scripts/epic-graph.sh` (E84 PR#117)

使用 `Agent` 工具的 `isolation: "worktree"` 參數，每個 subagent 取得獨立 git worktree：

```
Epic A → Agent (worktree) → implement + test → PR
Epic B → Agent (worktree) → implement + test → PR    } 同時執行
Epic C → Agent (worktree) → implement + test → PR
Epic D → Agent (worktree) → implement + test → PR
```

- 建議最多 **4 個並行** subagent
- 每個 worktree = 獨立分支，無 git 衝突
- 主終端負責：分配 Epic、收集結果、合併 PR
- **吞吐量提升約 4 倍**

---

## 策略二：多終端分批 ⏸️ DEFERRED

> 策略一已提供足夠並行能力。多終端協調列為 Phase 4（DEFERRED），待需求出現再實作。

每個 Claude Code 終端 = 獨立 agent，按批次分配：

| 終端 | 分配 | Epic 範圍 |
|------|------|-----------|
| Terminal 1 | Batch A | Epic 1–15 |
| Terminal 2 | Batch B | Epic 16–30 |
| Terminal 3 | Batch C | Epic 31–45 |
| Terminal 4 | Batch D | Epic 46–60 |

**風險**：PR 合併時可能衝突。應將接觸不同檔案的 Epic 分在同一批次。

---

## 策略三：合併相似 Epic（降低總數） ✅ DELIVERED

> 實作：`scripts/epic-graph.sh --classify` (E84 PR#117) 支援 Tier A/B/C 分類，可自動辨識可合併 Epic。

60 個獨立 Epic 可能過度拆分：

- **合併相關 Epic**：例如 5 個「為 domain X 加 CRUD」→ 1 個 Epic 含 5 個 domain
- **腳本生成機械性變更**：若 20 個 Epic 是「加欄位 X 到 Y」，腳本秒級完成
- **模板驅動**：`make new-domain` 已可 scaffold 全端 — 重複性 domain 直接使用

---

## 策略四：跳過 Loop 處理機械性工作 ✅ DELIVERED

> 實作：`/athena:batch --tier=A` (E85 PR#118) 支援 Tier A 腳本化批次處理。

`athena:loop` 適合**複雜、需判斷**的 Epic。機械性工作：

- 寫批次腳本從模板生成程式碼
- 最後統一跑一次 QA（非逐 Epic）
- 單一 PR 包含整批變更

---

## 策略五：管線分層（推薦） ✅ DELIVERED

> 實作：`scripts/epic-graph.sh` Tier 分類 (E84 PR#117) + `/athena:batch` 分層執行 (E85 PR#118)。

將 Epic 依複雜度分三層：

| 層級 | 速度 | 適用場景 | 方法 |
|------|------|----------|------|
| **Tier A — 腳本化** | 秒級 | 模板/regex 變更、設定更新 | 腳本自動生成，無需 AI |
| **Tier B — Agent 批次** | 分鐘級 | 簡單 CRUD、加欄位、接線 endpoint | 並行 worktree agent，輕量 QA |
| **Tier C — 完整 Loop** | 10–30 分鐘 | 複雜功能、新模式、安全相關 | 完整 `athena:loop`，徹底 QA |

### 執行流程

```
1. 分類 60 個 Epic → Tier A / B / C
2. Tier A：一次性腳本執行，單一 commit
3. Tier B：4 個 worktree agent 並行，每批 4 個 Epic
4. Tier C：逐一 athena:loop，確保品質
5. 每批完成後合併 main，解決衝突
```

---

## 實作指令參考

### Worktree 並行 Agent 呼叫範例

```
Agent(
  description="Implement Epic N",
  prompt="Implement Epic N per spec...",
  isolation="worktree",
  run_in_background=True
)
```

同時發送 4 個 Agent 呼叫 → 4 個 Epic 並行執行。

### 批次命令（已實作 `/athena:batch` — E85 PR#118）

```
/athena:batch E1,E2,E3,E4    → 4 個 worktree agent 並行
/athena:batch --tier=B        → 自動選取所有 Tier B epic 並行
/athena:batch --dry-run       → 僅顯示分配計畫
/athena:batch auto            → 自動從 EPIC_INDEX 讀取下一波可並行 Epic
```

---

## 注意事項

- 並行 agent 共享同一台機器資源（CPU、記憶體）— 建議不超過 4 個
- 每個 worktree agent 完成後需手動或自動合併分支
- 依賴關係的 Epic 不可並行 — 先建立依賴圖
- 合併順序很重要：先合基礎 Epic，再合依賴它的 Epic

---

## 完成紀錄

| 欄位 | 值 |
|------|-----|
| 完成日期 | 2026-03-28 |
| 涵蓋 Phase | Phase 25 (E82–E86) + Phase 26 (E87–E90) |
| PR 列表 | #115, #116, #117, #118, #119, #120 |

### 計畫 vs 實際結果

| 策略 | 原預估效果 | 實際交付 |
|------|-----------|---------|
| 策略一：Worktree 並行 | 4x 吞吐量 | `/athena:batch` + `@orchestrator` 已就緒，支援最多 4 並行 agent |
| 策略二：多終端分批 | 無限並行 | DEFERRED — 策略一已足夠 |
| 策略三：合併相似 Epic | 降低總數 | `epic-graph.sh --classify` 支援 Tier 分類 |
| 策略四：跳過 Loop | 秒級處理 | `/athena:batch --tier=A` 支援腳本化批次 |
| 策略五：管線分層 | 對症下藥 | Tier A/B/C 完整實作 + `/athena:dashboard` 視覺化 |

### 新增工具清單（計畫外額外交付）

- `@reviewer` agent — 從 @qa 分離的獨立審查 agent (E87)
- `@debugger` auto-retry — 失敗模式匹配 + 自動重試 (E88)
- `/athena:dashboard` — 管線即時狀態視覺化 (E89)
- PR automation hooks — 自動 label + assign (E90)
