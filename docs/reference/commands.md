# Athena 指令系統 | Commands

> 23 個指令涵蓋完整開發生命週期：**設計 → 實作 → 品質 → 發佈 → 部署 → 學習**。
>
> 23 commands covering the full lifecycle: **Design → Implement → Quality → Publish → Deploy → Learn**.

---

## 開發流程指令 | Development

| 指令 / Command | 說明 / Description |
|---------------|-------------------|
| `/athena:spec <feature>` | 設計功能規格（Drizzle schema + Zod + Server Action / Route Handler 簽章 + RBAC，寫入 `docs/epics/`）— Design a feature spec |
| `/athena:implement` | TDD 循環：spec → 程式碼 → 測試 — TDD cycle: spec → code → tests |
| `/athena:qa` | 程式碼審查 + 測試執行（`next-app/` pnpm 閘門）— Code review + tests (`--review-only` / `--test-only` / `--eval-only`) |
| `/athena:design <slug> "<desc>"` | 設計 tokens → React 頁面（TSX + CSS + smoke test）— Design tokens → React page |
| `/athena:audit` | 漂移稽核：Drizzle schema ↔ Zod ↔ Server Action / Route Handler / UI — Schema/Zod/UI drift check |
| `/athena:dba [subcommand]` | 資料庫管理：檢視、lint、診斷、修復 drizzle-kit migration — DBA: inspect, lint, diagnose, fix migrations |

## 發佈與部署指令 | Ship & Deploy

| 指令 / Command | 說明 / Description |
|---------------|-------------------|
| `/athena:ship [--draft]` | 快速發佈：審查 → 修復 → commit → PR |
| `/athena:pr [--draft]` | 完整 PR 管線：merge main → build → test → PR |
| `/athena:deploy [env]` | 7 道閘門部署至 Zeabur — 7-gate deploy |

## 自動化管線指令 | Automation

| 指令 / Command | 說明 / Description |
|---------------|-------------------|
| `/athena:loop [status]` | Epic 推進器 — 自動逐步推進。`status` 查看狀態、`auto` 全自動 |
| `/athena:plan [mode]` | 策略規劃 → 分析 → Epic 提案。Modes: `audit`, `research`, `comply`, `evolve`, `auto` |
| `/athena:cycle` | 完整 DevOps 循環（plan → approve → execute → reflect） |
| `/athena:batch [epics]` | 平行批次執行 Epic（worktree 隔離）— Parallel batch execution via worktree agents (`--phase N`, `--dry-run`, `auto`) |
| `/athena:dashboard [--phase N]` | 唯讀管線儀表板 — Read-only pipeline progress view from audit log + orchestration data (`--json` for machine output) |

## 記憶管理指令 | Memory

| 指令 / Command | 說明 / Description |
|---------------|-------------------|
| `/athena:load` | 載入所有上下文文件至當前 session — Load all context docs |
| `/athena:save` | 所有 Agent 同步存檔 — Checkpoint all agents simultaneously |
| `/athena:learn` | 重新整理 MEMORY.md + 垃圾回收過時記憶 — Refresh memory accuracy |
| `/athena:promote` | 萃取通用經驗至 Tier 0 全域記憶 — Extract lessons → global memory |

---

## Epic 開發管線 | Epic Pipeline

Athena Loop 是自動化開發引擎。每次 `/athena:loop` 只推進一個 epic 的一個步驟。

```
/athena:plan          → 產生 Epic 提案（≤5 個，需人工審核）
/athena:plan approve  → 批准 Epic → 寫入 EPIC_INDEX.md
/athena:loop          → 自動逐步推進（每次 1 步）
  ├─ spec       → @spec-writer 設計 feature spec（Drizzle + Zod + Server Action/Route Handler + RBAC）
  ├─ implement  → TDD 循環（worktree 隔離，@dba 審 migration）
  ├─ qa         → @reviewer + @qa + @evaluator 審查 + 測試 + 覆蓋率門檻
  ├─ commit     → 建立分支、提交程式碼
  └─ merge      → 推送 + PR + 自動合併
/athena:batch         → 平行模式：多個 Epic 同時推進（@orchestrator 協調）
/athena:dashboard     → 查看整體進度（唯讀）
```

搭配 `/loop 2m /athena:loop auto` 可達到全自動開發。

Use `/loop 2m /athena:loop auto` for fully autonomous development.

搭配 `/athena:batch auto` 可平行推進多個 Epic。

Use `/athena:batch auto` for parallel multi-epic execution.

---

## 指令定義檔位置

所有指令定義位於 `.claude/commands/athena/` 目錄。

Command definitions live in `.claude/commands/athena/`.
