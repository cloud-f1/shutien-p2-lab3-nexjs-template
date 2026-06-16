# AI Agent Team 使用指南

> 本指南說明如何使用 AI agent 團隊進行開發，包含序列與並行兩種模式。

---

## 快速開始

```bash
# 載入專案上下文
/athena:load

# 查看當前狀態
/athena:loop status

# 推進一個 Epic 步驟
/athena:loop

# 並行執行整個 Phase
/athena:batch --phase 25 --dry-run    # 先預覽
/athena:batch --phase 25              # 執行
```

---

## Agent 團隊總覽

| Agent | 指令 | 職責 |
|-------|------|------|
| `@spec-writer` | `/athena:spec` | Spec-first 功能設計（共享 Zod schema + spec） |
| `@qa` | `/athena:qa` | 程式碼審查 + 測試執行 + 80% 覆蓋率閘門 |
| `@best-practice` | 自動諮詢 | 架構決策、技術選型 |
| `@debugger` | 自動委派 | 錯誤診斷、根因分析 |
| `@deployer` | `/athena:deploy` | 6 閘門部署協議 |
| `@memory-curator` | `/athena:promote` | 跨專案知識萃取 |
| `@strategist` | `/athena:plan` | 策略分析、Epic 提案（需人工批准） |

---

## 開發模式

### 模式一：序列開發（`/athena:loop`）

適合：複雜功能、需要仔細審查的 Epic。

```bash
# 手動推進（每次一步）
/athena:loop

# 自動推進（搭配 /loop 排程）
/loop 2m /athena:loop auto

# 查看狀態
/athena:loop status
```

**流程**：spec → implement → qa → commit → merge（每次呼叫執行一步）

### 模式二：並行開發（`/athena:batch`）

適合：多個無依賴的 Epic，需要快速吞吐量。

```bash
# 並行自動駕駛（推薦）— 自動偵測 Phase、每次跑一個波次
/athena:batch auto
/loop 2m /athena:batch auto      # 每 2 分鐘自動推進一波次

# 手動指定 Phase
/athena:batch --phase 25 --dry-run   # 預覽
/athena:batch --phase 25             # 執行所有波次

# 指定 Epic 列表
/athena:batch E82,E83,E84

# 進階選項
/athena:batch auto --tier B          # 只跑 Tier B
/athena:batch --phase 25 --step implement  # 只跑特定步驟
/athena:batch --retry-failed         # 重試失敗的 Epic
```

**並行原理**：
1. 呼叫 `scripts/epic-graph.sh` 解析依賴圖
2. 計算執行波次（拓撲排序）
3. 每波次派遣最多 4 個 worktree agent（互不干擾）
4. 波次間同步 main，檢查衝突
5. 最終彙總報告

---

## 依賴圖工具

```bash
# 查看 Phase 25 的執行波次
./scripts/epic-graph.sh --phase 25

# 只看待完成的 Epic
./scripts/epic-graph.sh --phase 25 --pending-only

# 加上層級分類
./scripts/epic-graph.sh --phase 25 --classify

# JSON 格式（供程式使用）
./scripts/epic-graph.sh --phase 25 --json

# 查看所有 Phase 的統計
./scripts/epic-graph.sh --status
```

**層級分類**：
| 層級 | 條件 | 適合模式 |
|------|------|----------|
| Tier A | < 3 檔案 | 腳本化或 batch |
| Tier B | 3-10 檔案 | batch 並行 |
| Tier C | 10+ 檔案 | 完整 loop |

---

## 完整 DevOps 週期

```bash
# 1. 策略規劃（@strategist 分析 → 提案）
/athena:plan auto

# 2. 人工批准
/athena:plan approve E82,E83,E84,E85,E86

# 3. 執行（選擇序列或並行）
/athena:loop                    # 序列
/athena:batch --phase 25        # 並行

# 4. 部署
/athena:deploy

# 5. 知識萃取
/athena:promote
```

或使用一鍵週期：
```bash
/athena:cycle    # 自動走完 plan → approve → execute → reflect → cooldown
```

---

## 觀測性工具

### Webhook 通知

Hook 會依 URL host 自動判斷目標，將 payload 以 Slack / Telegram / Discord / 通用 JSON 格式輸出（後者可串接 n8n / Zapier / 自架 server）：

```bash
# Slack incoming webhook
export AI_CODING_WEBHOOK_URL="https://hooks.slack.com/services/..."

# Telegram bot（需另設 TELEGRAM_CHAT_ID）
export AI_CODING_WEBHOOK_URL="https://api.telegram.org/bot<TOKEN>/sendMessage"
export TELEGRAM_CHAT_ID="<chat-id>"

# Discord webhook
export AI_CODING_WEBHOOK_URL="https://discord.com/api/webhooks/..."

# 通用 JSON 接收端（其他 URL 一律走這條 — 扁平 JSON）
export AI_CODING_WEBHOOK_URL="https://your.server/hook"
```

以 `NOTIFY_LEVEL` 控制噪音量，預設 `boundaries` 只在 epic 邊界觸發（merge, deploy, start, failed, blocked, needs_human, merged）：

```bash
export NOTIFY_LEVEL="silent"      # 完全不發
export NOTIFY_LEVEL="boundaries"  # 預設 — 只在「需要看一下」的時刻
export NOTIFY_LEVEL="verbose"     # 每個 TaskCompleted 都發
```

通用 JSON payload（其他 URL）：
```json
{
  "event": "task_completed",
  "epic_id": "E82",
  "step": "merge",
  "status": "completed",
  "duration_seconds": 42,
  "branch": "feat/E82-...",
  "timestamp": "2026-03-29T10:30:00Z"
}
```

### JSONL 審計日誌

所有 Bash 命令自動記錄到 `.claude/audit.jsonl`：
```bash
# 查看失敗的命令
jq 'select(.exit != 0)' .claude/audit.jsonl

# 按 agent 分組計數
jq -s 'group_by(.agent) | map({agent: .[0].agent, count: length})' .claude/audit.jsonl

# 查看特定 Epic 的活動
jq 'select(.epic == "E84")' .claude/audit.jsonl

# 查看耗時超過 10 秒的命令
jq 'select(.duration_ms > 10000)' .claude/audit.jsonl
```

### Stop Verifier（規則）

每次 Claude 完成時自動檢查：

| # | 規則 | 類型 |
|---|------|------|
| 1 | 禁止 components/ui/ 內手刻檔案（改用 `npx shadcn@latest add`） | 阻擋 |
| 2 | 禁止內聯 `style=` 顏色覆寫（改用 Tailwind + `dark:` variants） | 阻擋 |
| 3 | console.log 殘留檢查 | 阻擋 |
| 4 | 驗證紀律（commit 前需有 `verification_check` 稽核事件） | 阻擋 |
| 5 | 大檔案警告（>500 行） | 警告 |

---

## 指令速查表

| 指令 | 用途 |
|------|------|
| `/athena:load` | 載入專案上下文 |
| `/athena:loop` | 推進一個 Epic 步驟 |
| `/athena:batch` | 並行執行多個 Epic |
| `/athena:spec` | 設計功能規格 |
| `/athena:implement` | TDD 實作 |
| `/athena:qa` | 程式碼審查 + 測試 |
| `/athena:ship` | 快速發布（review → fix → commit → PR） |
| `/athena:pr` | 完整 PR 管線 |
| `/athena:deploy` | 6 閘門部署 |
| `/athena:plan` | 策略規劃 |
| `/athena:cycle` | 完整 DevOps 週期 |
| `/athena:save` | 儲存所有 agent 狀態 |
| `/athena:learn` | 記憶系統更新 |
| `/athena:promote` | 萃取跨專案知識 |
| `/athena:domain` | 新增 domain 模組 |
| `/athena:dba` | 資料庫管理 |

---

## 常見情境

### 「我有 20 個小 Epic 要快速完成」
```bash
/athena:batch --phase N --tier A    # 只跑 Tier A（最簡單的）
/athena:batch --phase N --tier B    # 再跑 Tier B
```

### 「某個 Epic 失敗了」
```bash
/athena:loop status                 # 查看哪個失敗
/athena:batch --retry-failed        # 重試失敗的
```

### 「我想知道現在的進度」
```bash
./scripts/epic-graph.sh --status    # 全局統計
/athena:loop status                 # 當前 Phase 詳情
```

### 「我想開始新的開發週期」
```bash
/athena:plan auto                   # 分析 + 提案
/athena:plan approve E87,E88,...    # 批准
/athena:batch --phase 26            # 並行執行
```

---

## 下一步

- **[建立領域專家 Agent](custom-agents.md)** — 為你的業務領域建立自訂 AI Agent
- **[第一個 Epic 實戰](first-epic-walkthrough.md)** — 手把手教你從零建立完整 Domain
- **[學習路徑](learning-path.md)** — 查看所有指南的推薦閱讀順序
