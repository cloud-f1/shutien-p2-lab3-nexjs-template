# Agent 代理 | Agents

> 9 個 AI Agent（8 個實體 + 1 個領域專家模板）各司其職，組成完整的開發團隊。
> 每個 Agent 有獨立的記憶文件、專屬 hook、以及明確的職責邊界。
>
> 9 AI agents (8 real + 1 domain-expert template) forming a complete development team.
> Each agent has its own memory document, dedicated hooks, and clear responsibility boundaries.

---

## Agent 一覽 | Overview

| Agent | 專注領域 / Focus | 模型 / Model | 說明 / Description |
|-------|-----------------|-------------|-------------------|
| **@spec-writer** | OpenAPI-first 功能規格 | Opus | 讀取 `qa-patterns.md` 避免已知問題，輸出完整 spec 含 AC、依賴圖、story 拆分。觸發：`/athena:spec` |
| **@qa** | 安全審查 + 測試 | Sonnet | 雙階段審查（code review + test execution），80% 覆蓋率門檻，審查後回寫 `qa-patterns.md`。觸發：`/athena:qa` |
| **@reviewer** | 唯讀程式碼審查 | Sonnet | 安全審計、架構審查、模式一致性檢查、無障礙驗證。不可修改檔案或執行測試，輸出至 `review-findings.md`。觸發：`/athena:qa --review-only` |
| **@orchestrator** | 平行 Epic 協調 | Opus | 協調 worktree 隔離的平行 Agent，管理依賴圖、處理合併衝突、重試失敗。不寫實作程式碼，僅協調。觸發：`/athena:batch` |
| **@best-practice** | 架構決策 | Opus | 權衡分析、技術選型建議，維護 `TECHSTACK.md`。手動觸發或被其他 Agent 諮詢 |
| **@debugger** | 根因分析 | Sonnet | 假設驅動除錯，比對已知故障模式，編輯前自動備份。自動委派（偵測到錯誤時） |
| **@deployer** | 6 道部署閘門 | Sonnet | 依序檢查：git clean → tests pass → build ok → env vars → health check → deploy。觸發：`/athena:deploy` |
| **@memory-curator** | 跨專案智慧萃取 | Sonnet | 從 Tier 1 專案記憶萃取 `[GENERALIZABLE]` 經驗至 Tier 0 全域記憶。觸發：`/athena:promote` |
| **@strategist** | 審計 + 提案 | Opus | 4 模式分析（audit/evolve/comply/research），提案 ≤5 epics ≤80 SP，**需人工審核**。觸發：`/athena:plan` |

> **Note:** `domain-expert.md.tmpl` 是領域專家模板，由 `/athena:domain` 產生特定領域的 Agent 實例。
> `domain-expert.md.tmpl` is a template used by `/athena:domain` to generate domain-specific agent instances.

---

## 協作流程圖 | Collaboration Flow

```
使用者需求
  │
  ├─→ @spec-writer ──→ 產出 spec 文件
  │                      │
  │                      ▼
  │               /athena:implement ──→ 寫程式碼
  │                      │
  │                      ▼
  │                 @reviewer ──→ 程式碼審查（唯讀）
  │                      │
  │                      ▼
  │                    @qa ──→ 測試執行
  │                      │
  │              ┌───────┴───────┐
  │              ▼               ▼
  │           通過              失敗
  │              │               │
  │              ▼               ▼
  │         commit + merge   @debugger 介入
  │
  ├─→ @strategist ──→ 分析 → 提案 → 人工審核 → 新 Epics
  │
  ├─→ @orchestrator ──→ 平行批次執行（worktree 隔離，最多 4 並行）
  │
  └─→ @memory-curator ──→ 萃取經驗 → Tier 0 全域記憶
```

---

## Agent 定義檔位置

所有 Agent 定義位於 `.claude/agents/` 目錄，使用 YAML frontmatter + Markdown 指令格式。

Agent definitions live in `.claude/agents/` using YAML frontmatter + Markdown instructions.
