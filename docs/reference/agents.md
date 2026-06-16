# Agent 代理 | Agents

> 12 個 AI Agent 各司其職，組成完整的 Next.js 開發團隊。
> 每個 Agent 有獨立的記憶文件、專屬 hook、以及明確的職責邊界。
>
> 12 AI agents forming a complete Next.js development team.
> Each agent has its own memory document, dedicated hooks, and clear responsibility boundaries.

---

## Agent 一覽 | Overview

| Agent | 專注領域 / Focus | 模型 / Model | 說明 / Description |
|-------|-----------------|-------------|-------------------|
| **@spec-writer** | 功能規格設計 | Opus | 設計 feature spec：Drizzle schema + 共享 Zod + Server Action / Route Handler 簽章 + RBAC，輸出至 `docs/epics/`（**非 OpenAPI**）。觸發：`/athena:spec` |
| **@qa** | 測試執行 | Sonnet | 跑 `next-app/` 的 pnpm 閘門（Vitest unit + Playwright e2e + coverage），回寫 `qa-patterns.md`。觸發：`/athena:qa --test-only` |
| **@reviewer** | 唯讀程式碼審查 | Sonnet | 安全審計、架構審查（RSC 邊界、Server Action RBAC）、模式一致性、無障礙驗證。不可修改檔案或執行測試，輸出至 `review-findings.md`。觸發：`/athena:qa --review-only` |
| **@evaluator** | 獨立驗收評估 | Sonnet | 對照 spec 的 AC 做獨立驗收（E147），輸出至 `evaluation-log.md`。觸發：`/athena:qa --eval-only` |
| **@orchestrator** | 平行 Epic 協調 | Opus | 協調 worktree 隔離的平行 Agent，管理依賴圖、處理合併衝突、重試失敗。不寫實作程式碼，僅協調。觸發：`/athena:batch` |
| **@best-practice** | 架構決策 | Opus | 權衡分析、技術選型建議，維護 `TECHSTACK.md`。手動觸發或被其他 Agent 諮詢 |
| **@debugger** | 根因分析 | Sonnet | 假設驅動除錯，比對已知故障模式，編輯前自動備份。自動委派（偵測到錯誤時） |
| **@deployer** | 7 道部署閘門 | Sonnet | 依序檢查：git clean → tests pass → build ok → env vars → migration dry-run → health check → deploy（Zeabur）。觸發：`/athena:deploy` |
| **@memory-curator** | 跨專案智慧萃取 | Sonnet | 從 Tier 1 專案記憶萃取 `[GENERALIZABLE]` 經驗至 Tier 0 全域記憶。觸發：`/athena:promote` |
| **@strategist** | 審計 + 提案 | Opus | 4 模式分析（audit/evolve/comply/research），提案 ≤5 epics ≤80 SP，**需人工審核**。觸發：`/athena:plan` |
| **@designer** | 設計 → React 頁面 | Sonnet | 設計 tokens → TSX + CSS + smoke test，符合 Tailwind v4 + shadcn 慣例。觸發：`/athena:design` |
| **@dba** | drizzle-kit migration | Sonnet | 審查 drizzle-kit migration、schema 設計、DB forensics、lint SQL、診斷錯誤。觸發：`/athena:dba` |

---

## 協作流程圖 | Collaboration Flow

```
使用者需求
  │
  ├─→ @spec-writer ──→ feature spec（Drizzle + Zod + Server Action/Route Handler + RBAC）
  │                      │
  │                      ▼
  │               /athena:implement ──→ 寫程式碼（@dba 審 migration）
  │                      │
  │                      ▼
  │                 @reviewer ──→ 程式碼審查（唯讀）
  │                      │
  │                      ▼
  │              @qa + @evaluator ──→ 測試執行 + 獨立驗收
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
