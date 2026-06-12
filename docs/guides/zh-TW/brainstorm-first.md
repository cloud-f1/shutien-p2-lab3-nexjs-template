# 腦力激盪優先工作流程

> 如何使用 `/athena:plan brainstorm` 在撰寫任何程式碼之前先釐清功能想法。預估時間：**20 分鐘**。

---

## 前言

完成本指南後，你將理解：

- `/athena:plan brainstorm` 的用途與適用時機
- `@strategist` 執行的 7 步驟對話協定（E187）
- 一次腦力激盪工作階段如何轉變為結構完整的 Epic 檔案
- 過去的經驗教訓如何在對話中浮現（E189 — Wave 2）
- 腦力激盪模式與其他 `/athena:plan` 模式的比較

### 前置條件

- 已安裝 Claude Code CLI 並完成專案設定（請參閱[快速上手](quickstart.md)）
- 熟悉 Epic Pipeline（請參閱[第一個 Epic 實戰](first-epic-walkthrough.md)）

---

## 什麼是腦力激盪模式？

標準規劃流程（`/athena:plan auto`）是**分析導向**的 — 它掃描程式碼庫、與產業模式對比，並根據缺失或問題提出 Epic。當你想讓系統主動發現問題時，這個方式非常適用。

`/athena:plan brainstorm` 是**想法導向**的。你從一個粗略的功能概念開始，`@strategist` 透過結構化的問答對話將它精煉成一個完整分解的 Epic，包含實作階段、驗收檢查點和測試策略。

**適合使用腦力激盪模式的情境：**

- 你已經有特定的功能想法，想要驗證並加以結構化
- 你想在規格和程式碼出現之前避免過度設計
- 功能橫跨多個子系統，你想先釐清依賴關係
- 你即將進入一個循環，希望讓 Agent 挑戰你的假設

**不適合使用腦力激盪模式的情境：**

- 你完全不知道下一步要建立什麼 → 使用 `/athena:plan audit` 或 `auto`
- 你想檢查依賴關係和安全性 → 使用 `/athena:plan evolve`
- 你想評估合規落差 → 使用 `/athena:plan comply`

---

## 規劃模式比較

| 模式 | 輸入 | 輸出 | 最適情境 |
|------|------|------|---------|
| `brainstorm "想法"` | 你的功能概念 | 包含階段與檢查點的結構化 Epic | 已知功能，需要設計釐清 |
| `audit` | 程式碼庫掃描 | 技術債與弱點 Epic | 未知問題、技術債 |
| `research` | 產業環境 | 落差與機會 Epic | 競爭定位 |
| `comply` | 標準清單 | OWASP / WCAG 修復 Epic | 合規義務 |
| `evolve` | 依賴樹 | 升級與 CVE 修復 Epic | 維護週期 |
| `auto` | 以上全部 | 統一的優先順序清單 | 希望全面了解現況 |

---

## 腦力激盪對話協定

一旦你執行 `/athena:plan brainstorm "你的想法"`，`@strategist` Agent 會遵循以下 7 步驟協定：

### 步驟 1 — 脈絡探索

在提問之前，Agent 會閱讀最多 5 個相關檔案：

- `docs/context/epic-progress.md` — 已完成或進行中的項目
- `docs/context/strategy-log.md` — 近期循環與延後想法
- 該功能可能涉及的程式碼路徑

這表示 Agent 提出的第一個問題已經參考了你的專案狀態。

### 步驟 2 — 釐清問題（最多 7 個）

Agent **每次只問一個問題**，聚焦於：

1. **目的** — 這個功能解決什麼問題、為誰解決？
2. **限制條件** — 技術、業務或時間上的邊界
3. **成功標準** — 如何判斷功能已正常運作？

硬性上限：7 個問題。你可以隨時告訴 Agent 停止：*「這樣就夠了，我們繼續。」*

### 步驟 3 — 方案提案

Agent 提出 **2 到 3 個實作方案**並附上各自的取捨分析，然後推薦其中一個。你可以接受、修改，或要求提出不同方案。

### 步驟 4 — 逐節設計審查

Agent 依序呈現設計章節，每節結束後詢問*「這樣看起來沒問題嗎？」*：

- **架構** — 功能如何融入現有系統（1-3 句話）
- **元件 / 檔案** — 將建立或修改的內容
- **資料流** — 請求 → 處理 → 回應的路徑
- **錯誤處理** — 失敗情境及其呈現方式
- **測試策略** — 測試什麼、在哪一層、使用什麼工具

在進入下一節之前，你可以對任何章節提出異議。

### 步驟 5 — 草稿記錄

在對話過程中，Agent 建立一份結構化的草稿，記錄：

- 實作階段（最少 3 個，每個包含具體任務）
- 各階段驗證檢查點
- 測試策略摘要
- 對其他 Epic 的依賴關係
- 風險清單

此時尚未寫入任何檔案。

### 步驟 6 — JSON 輸出

一旦你批准設計，Agent 將 JSON 檔案寫入 `/tmp/brainstorm-E{n}.json`：

```json
{
  "epic": "E{n}",
  "slug": "weekly-digest-emails",
  "name": "每週摘要郵件",
  "priority": "P1",
  "size": "M",
  "sp": 5,
  "rationale": "在不推播通知的情況下促進用戶再次參與",
  "phases": [
    {"id": 1, "name": "資料彙總查詢", "tasks": ["新增 digest_stats view", "測試分頁"]},
    {"id": 2, "name": "郵件範本與發送", "tasks": ["Jinja2 範本", "SendGrid 整合", "測試發送"]},
    {"id": 3, "name": "排程器與取消訂閱", "tasks": ["celery beat 排程", "取消訂閱端點", "端到端測試"]}
  ],
  "checkpoints": [
    {"phase": 1, "verify": "digest_stats 查詢在測試中回傳正確的行數"},
    {"phase": 2, "verify": "郵件在兩種主題下都能正確呈現"},
    {"phase": 3, "verify": "取消訂閱連結停止後續發送；celery 排程在 CI 中通過"}
  ],
  "test_strategy": "使用 factory-boy fixtures 進行彙總查詢的單元測試；使用模擬 SendGrid 客戶端進行整合測試；Playwright 端到端測試涵蓋取消訂閱連結",
  "dependencies": [],
  "risks": ["SendGrid 在大量發送情境下的速率限制", "若查詢速度慢導致摘要資料過時"]
}
```

### 步驟 7 — 移交給工作流程

`/athena:plan` 指令讀取 JSON 後執行 `brainstorm-emit.sh strategy-log`，將提案列新增至 `docs/context/strategy-log.md`。你將看到：

```
腦力激盪完成。Epic E{n} 已提案至 docs/context/strategy-log.md。
執行 /athena:plan approve E{n} 以生成豐富的 Epic 檔案。
```

工作階段到此停止。**在建立 Epic 檔案之前，一律需要人工審核批准。**

---

## 記憶感知檢索（E189 — Wave 2）

> **狀態**：即將在 Wave 2 推出。本節說明計劃中的行為。

當 E189 推出後，腦力激盪對話將在問答過程中自動浮現相關的 Tier 0 和 Tier 1 經驗教訓，作為**設計考量**。例如，若你的 Tier 0 記憶中有一條關於「大量發送時 SendGrid 速率限制」的教訓，在 Agent 審查摘要郵件功能的錯誤處理章節時，該教訓將自動出現。

你不需要做任何額外操作 — 注入是自動的。教訓以來源標記內嵌顯示（Tier 0 = 跨專案，Tier 1 = 本專案歷史）。若某條教訓與當前情境不相關，你可以選擇忽略。

---

## 豐富化 Epic 檔案

當你在腦力激盪工作階段後執行 `/athena:plan approve E{n}` 時，工作流程會執行 `brainstorm-emit.sh render-epic` 來生成豐富的 Epic 檔案。與標準範本不同，豐富化檔案包含以下額外章節：

### 實作階段

每個階段是一個獨立的工作單元，可以分別進行審查和測試：

```markdown
## 實作階段

### 階段 1 — 資料彙總查詢
- 新增 `digest_stats` 資料庫 view
- 撰寫分頁包裝器
- 使用 factory-boy fixtures 進行單元測試

### 階段 2 — 郵件範本與發送
- Jinja2 範本（兩種主題變體）
- SendGrid 整合（含重試邏輯）
- 使用模擬郵件提供者進行整合測試

### 階段 3 — 排程器與取消訂閱
- Celery beat 排程（可設定發送週期）
- `POST /users/me/digest-opt-out` 端點
- 取消訂閱流程的端到端 Playwright 測試
```

### 各階段檢查點

每個階段都有明確、可驗證的退出條件，在進入下一階段前必須完成：

```markdown
## 各階段檢查點

| 階段 | 檢查點 |
|------|--------|
| 1 | `digest_stats` 查詢在測試中回傳正確的行數 |
| 2 | 郵件在深色與靛藍兩種主題下都能正確呈現 |
| 3 | 取消訂閱連結停止後續發送；Celery 排程在 CI 中通過 |
```

### 測試策略

一段描述測試內容、測試層級和使用工具的說明 — 在對話過程中撰寫，以反映實際的設計決策：

```markdown
## 測試策略

使用 factory-boy fixtures（server/tests/unit/）對彙總查詢進行單元測試。
使用模擬 SendGrid 客戶端（server/tests/integration/）進行發送路徑的整合測試。
Playwright 端到端測試涵蓋取消訂閱連結，並驗證後續不再發送摘要郵件。
```

---

## 端到端範例

### 功能：每週摘要郵件

**情境**：你想新增一封每週摘要郵件，向每位用戶展示過去 7 天的活動紀錄。

#### 1. 開始腦力激盪工作階段

```
/athena:plan brainstorm "每週摘要郵件 — 向用戶展示過去 7 天的活動紀錄"
```

#### 2. 回答對話問題

Agent 可能會問：

- *「主要收件者是所有用戶，還是僅限已訂閱者？」* → 已訂閱者，預設為全體開啟。
- *「摘要中應包含哪些活動資料？」* → 專案數量、已完成任務、最後登入時間。
- *「你使用的郵件服務提供商是什麼？」* → SendGrid，已整合用於交易郵件。
- *「'摘要發送成功'的定義是什麼？」* → 48 小時內確認送達並追蹤到開啟。

回答 4 個問題後，你說：*「這樣已經很清楚了，我們來設計吧。」*

#### 3. 審查方案提案

Agent 提出：

- **方案 A** — 在 cron 端點上同步發送（簡單，高負載時脆弱）
- **方案 B** — 具有重試邏輯的 Celery beat 排程（推薦 — 穩健且可測試）
- **方案 C** — 基於 SQS 的佇列扇出（以目前規模而言過度設計）

你選擇**方案 B**。

#### 4. 逐節審查設計

你批准架構、元件、資料流章節。在錯誤處理章節，你補充：*「為失敗的發送新增一個死信佇列。」* Agent 更新草稿記錄。

#### 5. 批准並輸出

```
腦力激盪已記錄至 /tmp/brainstorm-E201.json。
下一步：/athena:plan 指令將執行 brainstorm-emit.sh strategy-log。
然後執行 /athena:plan approve E201 以生成豐富的 Epic 檔案。
```

#### 6. 批准 Epic

```
/athena:plan approve E201
```

工作流程生成 `docs/epics/e201-weekly-digest-emails.md`（含豐富格式）並將 Epic 新增至 `docs/context/epic-progress.md`。

#### 7. 執行 Epic

```
/athena:loop    # 自動推進：spec → implement → qa → commit → merge
```

---

## 腦力激盪優先 vs. 傳統流程

| | 傳統流程（`/athena:plan auto → implement`） | 腦力激盪優先 |
|---|---|---|
| **起始點** | 系統根據分析提案 | 你帶著想法來 |
| **設計驗證** | 規格前無驗證 | 在碰任何檔案之前先進行問答對話 |
| **Epic 結構** | 標準範本（問題 / 解決方案 / 驗收標準） | 包含階段、檢查點和測試策略的豐富格式 |
| **人工審核** | 一次批准 | 相同 — 仍需批准 |
| **記憶整合** | 規劃期間無 | E189：過去教訓在對話中浮現（Wave 2） |
| **最適情境** | 「告訴我要建立什麼」 | 「我知道要建立什麼，請幫我架構它」 |

腦力激盪流程並不取代 `/athena:plan auto` — 它是一個額外的入口，適用於你帶著具體功能概念而非開放性問題來規劃的情況。

---

## 常見問題

**Q：我可以跳過問答，直接一次描述完整功能嗎？**

可以。如果你的初始描述已經很詳細（目的、限制條件、成功標準都已說明），Agent 會跳過多餘的問題，直接進入方案提案。7 個問題的上限是天花板，不是目標。

**Q：如果我批准後想更改設計怎麼辦？**

使用修訂後的描述重新執行腦力激盪工作階段。strategy-log 的條目將會更新，並輸出新的 JSON 檔案。先前的條目會保留以供稽核使用。

**Q：JSON 檔案是持久的嗎？**

`/tmp/brainstorm-E{n}.json` 檔案是暫存的。持久記錄是 strategy-log.md 的條目，以及批准後生成的 Epic 檔案。工作階段重新啟動後不要依賴 JSON 檔案的存在。

**Q：如果我批准時 JSON 不存在怎麼辦？**

工作流程將使用標準範本從 strategy-log 條目重建 Epic（階段、檢查點和測試策略將會省略）。重新執行腦力激盪工作階段以取得豐富格式。

---

## 下一步

- **[AI Agent 團隊指南](ai-agent-team-guide.md)** — 了解如何在 Epic 批准後並行執行多個 Epic
- **[Memory 系統指南](memory-system.md)** — 理解過去的教訓如何被儲存和檢索
- **[第一個 Epic 實戰](first-epic-walkthrough.md)** — 查看從 Epic 檔案到合併 PR 的完整流程

---

## 參考資料

| 資源 | 說明 |
|------|------|
| `.claude/commands/athena/plan.md` | `/athena:plan` 指令完整規格 |
| `.claude/agents/strategist.md` | `@strategist` Agent 定義，包含腦力激盪模式協定 |
| `scripts/plan/brainstorm-emit.sh` | 工作流程腳本 — `strategy-log` 和 `render-epic` 子指令 |
| `docs/context/strategy-log.md` | 所有規劃循環的歷史記錄 |
| [Epic 索引](../../epics/EPIC_INDEX.md) | 所有已批准 Epic 及其流程狀態 |
