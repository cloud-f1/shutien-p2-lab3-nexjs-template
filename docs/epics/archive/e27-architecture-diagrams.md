# E27 — Architecture Diagrams（架構圖）

> **Size**: S (~1 session) | **Depends on**: 無（獨立 Mermaid 文件）
> **Status**: spec
> **Type**: DOCUMENTATION-ONLY — 不修改任何程式碼，僅建立 Mermaid 架構圖

---

## 目標

為本模板建立五張 Mermaid 架構圖，放置於 `docs/diagrams/`。
圖表在 GitHub 原生渲染（Mermaid fenced code blocks），不需額外工具。
所有使用者文件以繁體中文撰寫（圖內節點標籤使用繁中，技術名詞保留英文）。

## 問題陳述

1. **缺乏視覺化概覽** — 目前的 `TECHSTACK.md`、`CLAUDE.md` 以文字描述架構，
   新使用者需要閱讀大量文件才能理解系統全貌。
2. **Agent 協作模式不透明** — 7 個 agent 各有觸發時機和文件寫入目標，
   但沒有一張圖能清楚呈現互動關係。
3. **Auth 流程分散** — JWT access / refresh token 的生命週期跨越
   多個檔案（`auth.py`、`tokenCache.ts`、`apiClient.ts`），缺乏統一流程圖。
4. **Domain 插件機制缺乏圖解** — E22 domain registry 是核心架構創新，
   但 `discover_domains()` 的運作方式只有程式碼，沒有視覺化說明。

## 解決方案

在 `docs/diagrams/` 建立五份 Markdown 檔案，每份包含一張 Mermaid 圖 + 簡短說明文字。

---

## 產出檔案清單

| 檔案 | 說明 |
|------|------|
| `docs/diagrams/README.md` | 索引頁 — 圖表清單 + 用途 + 連結 |
| `docs/diagrams/system-architecture.md` | 系統架構圖 — client / server / db / agent 四層 |
| `docs/diagrams/epic-pipeline.md` | Epic 流程圖 — spec → implement → qa → commit → merge |
| `docs/diagrams/agent-collaboration.md` | Agent 協作圖 — 7 個 agent 的觸發與互動 |
| `docs/diagrams/auth-flow.md` | 認證流程圖 — JWT 生命週期 + refresh 輪替 |
| `docs/diagrams/domain-structure.md` | Domain 結構圖 — E22 registry 插件機制 |

---

## 檔案一：`docs/diagrams/README.md` — 索引頁

### 內容

- 標題 + 目的說明
- 圖表清單（表格：檔案 / 標題 / 適合對象）
- 說明：所有圖表使用 Mermaid 語法，GitHub 會自動渲染
- 連結回 `TECHSTACK.md` 和 `CLAUDE.md`

### 驗收標準

- [ ] 包含所有五張圖的連結
- [ ] 繁體中文撰寫
- [ ] 連結路徑正確（相對路徑）

---

## 檔案二：`docs/diagrams/system-architecture.md` — 系統架構圖

### 圖表類型

Mermaid `graph TD`（上到下流程圖）

### 涵蓋內容

四層架構 + 外部服務：

1. **使用者層（User Tier）**
   - 瀏覽器（Browser）
   - Playwright E2E 測試

2. **客戶端層（Client Tier）**
   - React 18 + Vite + TypeScript
   - Zustand（狀態管理）
   - React Query（快取層，標示 4 個 cache tier）
   - Axios `apiClient`（HTTP 通訊）
   - `tokenCache.ts`（in-memory token 儲存）

3. **伺服器層（Server Tier）**
   - FastAPI + Uvicorn
   - Auth（JWT + OAuth）
   - Domain endpoints（Places, Portfolios, 可擴展）
   - Domain registry（`discover_domains()`）
   - Alembic（migration）
   - Structured logging（correlation ID）

4. **資料層（Data Tier）**
   - PostgreSQL（核心資料）
   - SQLAlchemy async（ORM）

5. **外部服務**
   - Zeabur（部署平台）
   - Google / GitHub OAuth
   - Resend / Mailgun（email）

### 說明文字

- 各層職責的一句話描述
- 關鍵連線說明（如 Client → Server 用 REST + JWT、Server → DB 用 async SQLAlchemy）

### 驗收標準

- [ ] 四層清楚分隔（使用 `subgraph`）
- [ ] 包含所有主要元件
- [ ] 標示通訊方式（REST API、SQL、OAuth redirect）
- [ ] 外部服務獨立標示
- [ ] 節點標籤使用繁中 + 英文技術名詞

---

## 檔案三：`docs/diagrams/epic-pipeline.md` — Epic 流程圖

### 圖表類型

Mermaid `graph LR`（左到右流程圖）

### 涵蓋內容

1. **五步驟流程**：`spec → implement → qa → commit → merge`
2. **每步驟對應的 Athena 指令**：
   - spec: `/athena:spec`
   - implement: `/athena:implement`
   - qa: `/athena:qa`
   - commit + merge: `/athena:ship` 或 `/athena:pr`
3. **每步驟對應的 agent**：
   - spec → @spec-writer
   - implement → 主 agent
   - qa → @qa
   - commit/merge → 主 agent
4. **SDD 子流程**（在 spec 步驟內展開）：
   - `openapi.yaml` → server code → client code
5. **TDD 子流程**（在 implement 步驟內展開）：
   - RED → GREEN → REFACTOR
6. **QA 閘門**：
   - coverage >= 80% → pass → commit
   - coverage < 80% → fail → loop back to implement
7. **Phase 邊界暫停**：一個 Phase 的所有 epic 完成時暫停回報

### 說明文字

- 流程的大原則：一次推進一步（`/athena:loop`）
- QA 閘門的重要性
- 失敗時如何回退

### 驗收標準

- [ ] 五步驟完整呈現，順序正確
- [ ] 標示對應的 Athena 指令和 agent
- [ ] SDD 和 TDD 子流程可見
- [ ] QA 閘門有成功/失敗分支
- [ ] Phase 邊界暫停有標示

---

## 檔案四：`docs/diagrams/agent-collaboration.md` — Agent 協作圖

### 圖表類型

Mermaid `graph TD`（上到下）或 `flowchart`

### 涵蓋內容

1. **7 個 Agent 節點**：
   - @spec-writer — 設計規格
   - @qa — 安全審查 + 測試 + 80% 閘門
   - @best-practice — 架構問題、取捨決策
   - @debugger — 錯誤排查（自動委派）
   - @deployer — 六閘門部署
   - @memory-curator — 萃取通用經驗至 Tier 0
   - @strategist — 審計、研究、提案 epic

2. **觸發方式**（邊線標籤）：
   - 使用者直接觸發：`/athena:spec` → @spec-writer
   - 使用者直接觸發：`/athena:qa` → @qa
   - 使用者直接觸發：`/athena:deploy` → @deployer
   - 使用者直接觸發：`/athena:plan` → @strategist
   - 使用者直接觸發：`/athena:promote` → @memory-curator
   - 自動委派：測試失敗 → @debugger
   - 交叉呼叫：@spec-writer → @best-practice（架構決策）

3. **寫入目標**（每個 agent 對應的 docs/context/ 檔案）：
   - @spec-writer → `docs/epics/e{n}-*.md`
   - @qa → 測試報告
   - @memory-curator → `~/.claude/template-memory/`（Tier 0）
   - @strategist → `docs/context/strategy-log.md`

4. **Memory 系統連線**：
   - Tier 0（跨專案）← @memory-curator
   - Tier 1（專案內）← 各 agent 寫入

### 說明文字

- Agent 團隊的設計哲學（專責分工、人工閘門）
- 如何新增自訂 agent

### 驗收標準

- [ ] 7 個 agent 全部呈現
- [ ] 觸發方式清楚標示（指令 vs 自動）
- [ ] 寫入目標（文件路徑）可見
- [ ] Memory 雙層系統有圖示
- [ ] 使用者（human）在圖中作為觸發來源

---

## 檔案五：`docs/diagrams/auth-flow.md` — 認證流程圖

### 圖表類型

Mermaid `sequenceDiagram`（時序圖）

### 涵蓋內容

呈現三個主要流程：

#### 流程 A：登入 + Token 發行

1. 使用者 → Client：輸入 email / password
2. Client → Server：`POST /auth/jwt/login`（form-data, `username` = email）
3. Server：驗證 → 發行 access token（15 min）+ refresh token（30 days）
4. Server → Client：回傳 tokens
5. Client：access token → `tokenCache.ts`（in-memory）
6. Client：refresh token → httpOnly cookie（prod）/ localStorage（dev）

#### 流程 B：Token 刷新（Proactive Refresh）

1. Client `apiClient`：偵測 access token 即將過期（< 60s）
2. Client → Server：`POST /auth/refresh`（帶 refresh token）
3. Server：驗證 → 輪替 refresh token → 發行新 access + refresh
4. Server：舊 refresh token 作廢
5. Server → Client：回傳新 tokens
6. Client：更新 `tokenCache.ts` + cookie

#### 流程 C：OAuth 登入

1. 使用者 → Client：點擊 Google/GitHub 按鈕
2. Client → Provider：redirect 到 OAuth authorize URL
3. Provider → Client：callback 帶 authorization code
4. Client → Server：`POST /auth/social/{provider}/callback`
5. Server：交換 code → 取得 provider user info → 建立/關聯帳號
6. Server → Client：發行 access + refresh tokens

### 說明文字

- 為什麼 access token 不存 localStorage（XSS 防護）
- Refresh token 輪替的意義（單次使用、洩漏偵測）
- OAuth 帳號合併邏輯（同 email → 關聯）

### 驗收標準

- [ ] 三個流程都有獨立的時序圖
- [ ] 參與者標示正確（Browser、Client App、Server、DB、OAuth Provider）
- [ ] Token 儲存位置清楚標示
- [ ] Refresh token 輪替機制可見
- [ ] 失敗情境至少涵蓋 401（token 過期/無效）

---

## 檔案六：`docs/diagrams/domain-structure.md` — Domain 結構圖

### 圖表類型

Mermaid `graph TD` + `classDiagram`（混合使用或分兩張圖）

### 涵蓋內容

#### 圖 A：Domain Registry 運作流程

1. `main.py` 啟動 → 呼叫 `discover_domains()`
2. `discover_domains()` 掃描 `server/app/domains/` 子目錄
3. 每個子目錄匯出 `DomainConfig`（router, models, prefix, tags）
4. `main.py` 動態註冊 `app.include_router(config.router, prefix=..., tags=[...])`
5. `models/__init__.py` 發現 domain models → Alembic 自動偵測

#### 圖 B：Domain 套件結構

```
server/app/domains/
├── places/
│   ├── __init__.py      → exports DomainConfig
│   ├── models.py        → SQLAlchemy models
│   ├── schemas.py       → Pydantic schemas
│   ├── endpoints.py     → APIRouter
│   └── service.py       → business logic (optional)
├── portfolios/
│   └── ... (same structure)
└── {new-domain}/
    └── ... (same structure)
```

- 用 class diagram 呈現 `DomainConfig` 的 interface
- 標示「刪除一個 domain 目錄 = 零斷裂 import」的設計目標

#### 圖 C：Client 對應結構

```
client/src/
├── api/services/{domain}Service.ts
├── hooks/use{Domain}.ts
├── pages/{domain}/
└── tests/handlers/{domain}.ts
```

- 標示 `createService()` factory 如何連接 OpenAPI 型別

### 說明文字

- Domain 插件機制的設計理念（zero-import deletion）
- 如何新增 domain（連結 E23 `/athena:domain`）
- Server 與 Client 的對稱結構

### 驗收標準

- [ ] Domain registry 啟動流程完整
- [ ] `DomainConfig` 的 interface 清楚
- [ ] Server + Client 的 domain 對稱結構可見
- [ ] 「刪除 = 零斷裂」的設計目標有標示
- [ ] 與 E22 spec 的描述一致

---

## 全域驗收標準

### 圖表品質

- [ ] 所有圖表使用 Mermaid 語法，GitHub 可直接渲染
- [ ] 每張圖包含簡短說明文字（圖的用途、如何閱讀）
- [ ] 節點標籤使用繁中描述 + 英文技術名詞（如：「快取層（React Query）」）
- [ ] 圖表複雜度適中 — 每張圖不超過 25 個節點
- [ ] 配色／形狀用於區分不同類型的節點（如：外部服務用虛線框）

### 內容正確性

- [ ] 系統架構圖與 `TECHSTACK.md` 描述一致
- [ ] Agent 協作圖與 `CLAUDE.md` Agent Team 區塊一致
- [ ] Auth 流程圖與 `docs/techstack/client.md` + `server.md` 描述一致
- [ ] Domain 結構圖與 E22 實作一致（`discover_domains()`、`DomainConfig`）
- [ ] Epic 流程圖與 `docs/epics/CLAUDE.md` 的 pipeline 描述一致

### 與其他文件整合

- [ ] `docs/diagrams/README.md` 索引頁連結正確
- [ ] 考慮在 `docs/guides/quickstart.md`（E24）新增一行連結到架構圖（不在此 epic 修改，記錄為後續建議）
- [ ] 考慮在 `TECHSTACK.md` 新增圖表連結（不在此 epic 修改，記錄為後續建議）

### 不在此 Epic 範圍內

- [ ] 不修改任何程式碼
- [ ] 不修改現有文件（僅建立新檔案在 `docs/diagrams/`）
- [ ] 不使用外部圖表工具（純 Mermaid）
- [ ] 不建立互動式元件（靜態 Markdown）

---

## 大小估算

| 項目 | 估算 |
|------|------|
| `docs/diagrams/README.md` 索引頁 | 0.5h |
| `system-architecture.md` 系統架構圖 | 1h |
| `epic-pipeline.md` Epic 流程圖 | 0.5h |
| `agent-collaboration.md` Agent 協作圖 | 1h |
| `auth-flow.md` 認證流程圖（3 個 sequence diagram） | 1.5h |
| `domain-structure.md` Domain 結構圖 | 1h |
| 交叉檢查 + 與現有文件一致性驗證 | 0.5h |
| **合計** | **~6h (S)** |
