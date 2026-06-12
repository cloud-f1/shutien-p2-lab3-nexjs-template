# Agent Team & Webhook 改進計畫

> **🏁 COMPLETED** — 2026-03-28
>
> Phase 25 (E82–E86, PRs #115–#119) + Phase 26 (E87–E91, PR #120) 全部交付。
> Phase 1–3 共計 ~56 SP 完成。Phase 4（多終端協調）列為 DEFERRED。
>
> 基於現有 9 agents / 17 hooks / 17 commands / 8 skills 的完整分析，提出改進方案。

---

## 一、現狀總覽

| 類別 | 數量 | 狀態 |
|------|------|------|
| Agents | 8 | spec-writer, qa, best-practice, debugger, deployer, memory-curator, strategist, domain-expert (template) |
| Commands | 15 | athena namespace，完整 DevOps 流程 |
| Hooks | 16 | 8 事件類型，含 agent-scoped hooks |
| Skills | 8 | 覆蓋 client/server/OpenAPI/TDD/debug/migration/Stripe |

### 現有瓶頸

1. **序列執行**：`athena:loop` 一次只處理一個 Epic
2. **Hook 無外部通知**：`task-completed.sh` webhook 是空殼（已註解）
3. **無批次排程**：缺少 `athena:batch` 多 Epic 並行指令
4. **Agent 無自動重試**：失敗需人工介入
5. **缺乏觀測性**：audit.log 是純文字，無結構化指標
6. **Worktree agent 無 QA 閘門**：並行 agent 完成後缺少自動品質檢查

---

## 二、Agent Team 改進方案

### 2.1 新增 `@orchestrator` Agent（核心改進）

**職責**：並行 Epic 調度 + 依賴管理 + 合併協調

```yaml
name: orchestrator
model: opus
tools: [Agent, Read, Bash, Grep, Glob, TaskCreate, TaskUpdate]
key_document: docs/context/orchestration-log.md
```

**能力**：
- 讀取 EPIC_INDEX.md 建立依賴圖
- 將無依賴 Epic 分配到並行 worktree agent
- 監控 agent 完成狀態，觸發下一批
- 合併衝突偵測 + 自動 rebase
- 失敗自動重試（最多 2 次）

**為什麼需要**：現有 `athena:loop` 是單一狀態機，無法協調多個並行 agent。orchestrator 是並行管線的「控制塔台」。

### 2.2 新增 `@reviewer` Agent（從 @qa 分離）

**現狀問題**：@qa 同時負責 code review + test execution，兩個完全不同的任務。

```yaml
name: reviewer
model: sonnet
tools: [Read, Grep, Glob]  # 唯讀，不執行任何程式
key_document: docs/context/review-log.md
```

**分離後職責**：
- `@reviewer`：純程式碼審查 — 安全、架構、模式一致性（唯讀）
- `@qa`：純測試執行 — 跑測試、覆蓋率、回歸（可執行）

**好處**：
- Reviewer 可用 `sonnet` 快速完成（不需執行能力）
- QA 可並行跑多個測試套件
- 職責分離 = 更易追蹤問題來源

### 2.3 強化 `@debugger` 自動化

**現狀**：debugger 被動等待呼叫。

**改進**：
- 新增 hook：`PostToolUse(Bash)` 偵測 exit code != 0 時自動注入 debugger context
- 加入「已知失敗模式」快速查表（已有 9+7 模式，可程式化）
- Agent-scoped 自動重試：失敗 → 分析 → 修正 → 重試（最多 2 次）

### 2.4 Agent 能力矩陣優化

| Agent | 現狀 Model | 建議 Model | 理由 |
|-------|-----------|-----------|------|
| spec-writer | opus | opus | 需要創造力 — 維持 |
| qa | sonnet | sonnet | 執行型任務 — 維持 |
| best-practice | opus | opus | 架構判斷 — 維持 |
| debugger | sonnet | sonnet → opus（複雜時） | 簡單 bug 用 sonnet，複雜根因分析升級 opus |
| deployer | sonnet | sonnet | 固定流程 — 維持 |
| memory-curator | sonnet | haiku | 模式提取 + 檔案操作，不需高推理 |
| strategist | opus | opus | 策略分析 — 維持 |
| **orchestrator** | — | opus | 新增：需要複雜調度判斷 |
| **reviewer** | — | sonnet | 新增：模式匹配型任務 |

---

## 三、Webhook & Hook 改進方案

### 3.1 啟用 `task-completed.sh` Webhook（立即可做）

**現狀**：已有 webhook 骨架但已註解。

```bash
# 啟用後支援的通知目標：
AI_CODING_WEBHOOK_URL="https://hooks.slack.com/..."  # Slack
AI_CODING_WEBHOOK_URL="https://discord.com/api/..."   # Discord
AI_CODING_WEBHOOK_URL="http://localhost:8080/..."      # 本地 dashboard
```

**Payload 結構（建議）**：
```json
{
  "event": "task_completed",
  "epic_id": "E82",
  "step": "implement",
  "status": "success",
  "duration_seconds": 342,
  "branch": "feat/E82-xxx",
  "coverage": { "server": 92.1, "client": 81.3 },
  "timestamp": "2026-03-28T10:30:00Z"
}
```

### 3.2 新增 Hook 事件

| Hook | 事件 | 用途 |
|------|------|------|
| `epic-start.sh` | Epic 開始時 | 通知 + 計時開始 |
| `epic-complete.sh` | Epic 完成時 | 通知 + 計時結束 + 指標收集 |
| `pr-created.sh` | PR 建立後 | 自動加 label、assign reviewer |
| `coverage-report.sh` | 測試完成後 | 推送覆蓋率到外部 dashboard |
| `merge-conflict.sh` | 並行 agent 偵測到衝突 | 通知 + 建議解決策略 |

### 3.3 結構化 Audit Log

**現狀**：`.claude/audit.log` 是純文字追加。

**改進**：改為 JSONL 格式，支援查詢分析：

```jsonl
{"ts":"2026-03-28T10:30:00Z","event":"bash","cmd":"pytest","exit":0,"agent":"qa","epic":"E82","duration_ms":4200}
{"ts":"2026-03-28T10:30:05Z","event":"edit","file":"server/app/api/v1/endpoints/auth.py","agent":"spec-writer","epic":"E82"}
```

**好處**：
- `jq` 可直接查詢
- 可計算每個 agent/epic 的耗時
- 可偵測異常模式（同一檔案被多次編輯 = 可能卡住）

### 3.4 Stop Verifier 增強

**現狀 5 條規則**：localStorage ban、fireEvent ban、staleTime hardcoding、MSW handler location、folder names。

**建議新增**：

| 規則 | 檢查 | 理由 |
|------|------|------|
| OpenAPI 漂移 | `openapi.yaml` 修改但無對應 types 更新 | SDD 核心原則 |
| 未跑測試 | 有程式碼修改但本次 session 未跑任何 test | 防止遺漏 |
| 大檔案警告 | 新增檔案 > 500 行 | 鼓勵拆分 |
| Import 排序 | Python imports 未排序 | ruff 已處理，但 hook 加雙重保障 |
| Console.log 殘留 | client/ 中有 `console.log` | 正式碼不應有 debug 輸出 |

---

## 四、並行管線指令設計

### 4.1 `/athena:batch` — 並行 Epic 執行

```markdown
# 用法
/athena:batch E82,E83,E84,E85       # 指定 Epic 並行
/athena:batch --phase 25             # 整個 Phase 並行
/athena:batch --tier B               # 自動選取 Tier B epic
/athena:batch --max-concurrent 4     # 限制並行數（預設 4）
/athena:batch --dry-run              # 僅顯示執行計畫

# 流程
1. 讀取指定 Epic 的 spec + 依賴
2. 建立依賴圖，分批（無依賴者同批）
3. 每批啟動 N 個 worktree agent（Agent isolation=worktree）
4. 每個 agent 執行：implement → test → commit
5. 批次完成 → 合併到 main → 下一批
6. 全部完成 → 彙總報告 + webhook 通知
```

### 4.2 `/athena:dashboard` — 即時狀態

```markdown
# 用法
/athena:dashboard

# 輸出
╔══════════════════════════════════════════════════╗
║  Athena Pipeline Dashboard — Phase 25            ║
╠══════════════════════════════════════════════════╣
║  E82  [████████░░] 80%  implement  ⏱ 12m       ║
║  E83  [██████████] 100% ✅ merged   ⏱ 8m        ║
║  E84  [██░░░░░░░░] 20%  spec       ⏱ 3m        ║
║  E85  [░░░░░░░░░░] 0%   queued     ⏱ —         ║
╠══════════════════════════════════════════════════╣
║  Completed: 1/4  |  Coverage: 91.2%  |  ETA: 25m ║
╚══════════════════════════════════════════════════╝
```

---

## 五、建議優先順序（Advisor Recommendations）

### Phase 1 — 快速見效（1-2 Epic，立即可做） ✅ DONE

> 交付於 E82 (PR #115) + E83 (PR #116)

| 項目 | 工作量 | 影響 | 狀態 |
|------|--------|------|------|
| 啟用 webhook（task-completed.sh） | 1 SP | 外部通知能力 | ✅ E82 PR#115 |
| JSONL audit log | 2 SP | 觀測性基礎 | ✅ E82 PR#115 |
| Stop verifier 加 3 條規則 | 2 SP | 品質閘門強化 | ✅ E83 PR#116 |
| Memory-curator 降級 haiku | 1 SP | 節省 token 成本 | ✅ E83 PR#116 |

### Phase 2 — 並行管線（3-5 Epic） ✅ DONE

> 交付於 E84 (PR #117) + E85 (PR #118) + E86 (PR #119)

| 項目 | 工作量 | 影響 | 狀態 |
|------|--------|------|------|
| `/athena:batch` 指令 | 5 SP | **核心：4x 吞吐量** | ✅ E85 PR#118 |
| `@orchestrator` agent | 5 SP | 並行調度引擎 | ✅ E86 PR#119 |
| Worktree QA 閘門 | 3 SP | 並行品質保證 | ✅ E85 PR#118 |
| Epic 依賴圖解析 | 3 SP | 智慧排程 | ✅ E84 PR#117 |

### Phase 3 — 進階自動化（5-8 Epic） ✅ DONE

> 交付於 E87–E90 (PR #120)。E91（Post-Wave Integration Test Gate）仍為 pending。

| 項目 | 工作量 | 影響 | 狀態 |
|------|--------|------|------|
| `@reviewer` 從 @qa 分離 | 3 SP | 職責清晰 + 並行審查 | ✅ E87 PR#120 |
| Debugger 自動重試 | 3 SP | 減少人工介入 | ✅ E88 PR#120 |
| `/athena:dashboard` | 5 SP | 即時視覺化 | ✅ E89 PR#120 |
| PR 自動化 hook | 3 SP | label + assign | ✅ E90 PR#120 |
| 結構化指標 + 趨勢 | 5 SP | 長期效能追蹤 | ✅ E89 PR#120 (含於 dashboard) |

### Phase 4 — 多終端協調（未來） ⏸️ DEFERRED

> 尚未排入任何 Phase。Phase 1–3 已涵蓋核心需求，Phase 4 為進階優化，
> 待實際多終端使用場景出現後再評估優先級。

| 項目 | 工作量 | 影響 | 狀態 |
|------|--------|------|------|
| 跨終端 Epic 鎖（file-based） | 5 SP | 防止重複作業 | ⏸️ DEFERRED |
| 共享狀態 dashboard（本地 web） | 8 SP | 多終端視覺化 | ⏸️ DEFERRED |
| Agent 效能 profiling | 5 SP | 優化瓶頸 | ⏸️ DEFERRED |

---

## 六、架構建議（Advisor Notes）

### 不要做的事

1. **不要建中央資料庫追蹤 Epic**：檔案系統 + git 已足夠，加 DB 增加複雜度
2. **不要在 hook 中跑測試**：hook 有 timeout（最多 30s），測試應在 agent 內執行
3. **不要並行超過 4 個 agent**：受限於機器資源 + API rate limit
4. **不要跳過 human gate**：strategist 的強制審批閘門是安全機制，不應繞過

### 應該做的事

1. **先分類再並行**：60 Epic 中可能 40% 是 Tier A/B（可批次/並行），只有 20% 需要完整 loop
2. **Epic 粒度審查**：過小的 Epic（< 3 SP）應合併，減少調度開銷
3. **Worktree 清理自動化**：完成的 worktree 應自動刪除，避免磁碟堆積
4. **Agent 結果快取**：相同 spec 不應重新生成，可跳過已完成步驟
5. **漸進式採用**：先在 3-5 個 Epic 驗證 batch 流程，再推廣到 60 個

### 多終端 vs 並行 Agent 比較

| 面向 | 並行 Agent（同終端） | 多終端 |
|------|---------------------|--------|
| 設置成本 | 低（已有 worktree 支援） | 中（需手動分配） |
| 上下文共享 | 共享主 agent 狀態 | 各自獨立 |
| 衝突風險 | 低（worktree 隔離） | 中（合併時衝突） |
| 最大並行 | 4 agent | 無限（受機器限制） |
| 協調能力 | orchestrator 自動協調 | 需人工協調 |
| **建議** | **優先採用** | 作為補充手段 |

---

## 七、總結

```
現狀：serial loop → 60 Epic × 20 min = 20 hours
目標：parallel batch → 60 Epic ÷ 4 agents × 效率提升 = 3-5 hours

關鍵改進：
  1. /athena:batch      → 4x 吞吐量
  2. @orchestrator      → 智慧調度
  3. webhook 啟用       → 外部通知
  4. JSONL audit        → 觀測性
  5. Epic 分層          → 對症下藥
```

---

## 八、完成紀錄

| 欄位 | 值 |
|------|-----|
| 完成日期 | 2026-03-28 |
| 涵蓋 Phase | Phase 25 (E82–E86) + Phase 26 (E87–E90) |
| 總交付 SP | ~56 SP（Phase 1: 6 + Phase 2: 16 + Phase 3: 19 + 其他整合工作） |
| PR 列表 | #115, #116, #117, #118, #119, #120 |
| 剩餘項目 | Phase 4（18 SP）— DEFERRED，無排程 |
| 備註 | E91（Post-Wave Integration Test Gate）屬 Phase 26 但尚未完成，不在本計畫範圍內 |
