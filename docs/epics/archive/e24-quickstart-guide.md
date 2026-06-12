# E24 — Quickstart Guide + First Epic Walkthrough

> **Size**: M (1-2 sessions) | **Depends on**: E22 (references domain structure)
> **Status**: spec
> **Type**: DOCUMENTATION-ONLY — no code changes, guides in `docs/guides/`

---

## Goal

為初學者提供兩份繁體中文指南：一份 Quickstart 帶使用者從 clone 到啟動 dev server，
一份 First Epic Walkthrough 手把手示範如何用本模板完成第一個自訂 domain（從 spec 到上線）。

所有使用者文件以繁體中文撰寫。

## 問題陳述

目前專案有完整的架構（E0–E23），但缺乏結構化的入門文件：

1. **沒有統一的 Getting Started** — 新使用者必須交叉閱讀 CLAUDE.md、TECHSTACK.md、
   README.md 才能拼湊出啟動步驟，容易遺漏環境變數或前置工具。
2. **沒有端對端範例** — E22 domain registry 和 E23 `/athena:domain` 已就緒，
   但沒有文件教使用者「如何從零建立一個新 domain 並跑通全流程」。
3. **Athena 指令學習曲線** — 13 個 slash command 沒有情境導向的教學，
   初學者不知道何時用 `/athena:spec` vs `/athena:implement` vs `/athena:loop`。

## 解決方案

在 `docs/guides/` 建立兩份獨立指南，搭配一份索引頁。不修改任何程式碼。

---

## 產出檔案清單

| 檔案 | 說明 |
|------|------|
| `docs/guides/README.md` | 指南索引頁 — 列出所有指南 + 適合對象 + 閱讀順序 |
| `docs/guides/quickstart.md` | 快速入門指南 — clone → 環境設定 → dev server |
| `docs/guides/first-epic-walkthrough.md` | 第一個 Epic 實戰 — 用 /athena:domain 建 domain + 跑通 epic pipeline |

---

## 檔案一：`docs/guides/README.md` — 指南索引

### 段落大綱

1. **標題與目的** — 說明此目錄的用途
2. **閱讀順序建議**
   - 完全新手 → quickstart → first-epic-walkthrough
   - 有經驗開發者 → quickstart（速讀）→ 直接看 EPIC_INDEX
3. **指南清單**（表格：標題 / 對象 / 預估時間 / 前置條件）
4. **相關文件連結** — CLAUDE.md、TECHSTACK.md、EPIC_INDEX.md、openapi.yaml

### 驗收標準

- [ ] 索引頁包含所有指南的連結、適合對象、預估閱讀時間
- [ ] 繁體中文撰寫
- [ ] 連結路徑正確（相對路徑，從 `docs/guides/` 出發）

---

## 檔案二：`docs/guides/quickstart.md` — 快速入門指南

### 段落大綱

1. **前言** — 這份指南帶你做什麼、預估時間（~15 分鐘）
2. **前置需求**
   - 必要工具清單（Node >= 20、pnpm、Python >= 3.12、uv、PostgreSQL、git）
   - 每個工具的安裝指令（macOS / Linux 各一行）
   - 版本驗證指令
3. **Step 1：Clone 專案**
   - `git clone` + `cd` 指令
   - 說明 E21 Interactive Site Builder（`pnpm new-site`）可選替代方案
4. **Step 2：安裝依賴**
   - `pnpm install`（root workspace）
   - `cd server && uv sync`
   - 說明 pnpm workspace 結構（client + dev-docs）
5. **Step 3：資料庫設定**
   - `createdb` 指令
   - `.env` 檔案設定（DATABASE_URL、SECRET_KEY、REFRESH_SECRET_KEY）
   - `.env.example` 參考
6. **Step 4：執行 Migration**
   - `cd server && uv run alembic upgrade head`
   - 說明 seed accounts（admin@test.com / user@test.com）
7. **Step 5：產生 TypeScript Types**
   - `pnpm generate:types`
   - 說明 OpenAPI → TypeScript 的流程
8. **Step 6：啟動 Dev Server**
   - Server: `cd server && uv run uvicorn app.main:app --reload`
   - Client: `cd client && pnpm dev`
   - 驗證：開啟瀏覽器確認頁面載入
9. **Step 7：執行測試**
   - Server: `cd server && uv run pytest`
   - Client: `cd client && pnpm test`
   - 說明 80% coverage gate
10. **常見問題 (FAQ)**
    - PostgreSQL 連線失敗
    - pnpm install 權限問題
    - Python 版本不符
    - Port 衝突
11. **下一步** — 連結到 first-epic-walkthrough.md

### 驗收標準

- [ ] 所有指令可直接複製貼上執行
- [ ] 涵蓋 macOS 和 Linux 環境
- [ ] 包含 `.env` 範例（secrets 用 placeholder，不含真實值）
- [ ] 提及 E21 Site Builder 作為替代入門方式
- [ ] FAQ 至少 4 題
- [ ] 繁體中文撰寫

---

## 檔案三：`docs/guides/first-epic-walkthrough.md` — 第一個 Epic 實戰

### 段落大綱

1. **前言** — 你將學到什麼、預估時間（~30 分鐘）、前置條件（quickstart 完成）
2. **核心概念速覽**
   - Epic-Driven Development 簡介（連結 EPIC_INDEX.md）
   - SDD（Spec-Driven Development）流程：openapi.yaml → server → client
   - Athena 指令概覽（表格：指令 / 用途 / 何時用）
3. **情境設定** — 我們要建一個 `bookmark` domain（書籤管理）
   - 為什麼選 bookmark：簡單、2-3 個欄位、CRUD 完整
   - 預期欄位：`url` (string), `title` (string), `notes` (text, optional)
4. **Step 1：建立 Epic Entry**
   - 在 EPIC_INDEX.md 新增一行
   - 說明 Epic 命名慣例（E-number、branch naming）
5. **Step 2：用 `/athena:domain` 產生骨架**（連結 E23）
   - 指令範例：`/athena:domain bookmark --fields "url:string,title:string,notes:text"`
   - 說明產生的檔案清單（對照 E23 spec 的 10 個步驟）
   - 確認 OpenAPI spec 先產生（SDD 合規）
6. **Step 3：檢視 Domain Registry**（連結 E22）
   - `server/app/domains/bookmarks/` 結構說明
   - `discover_domains()` 自動發現機制
   - 確認 `DomainConfig` 正確 export
7. **Step 4：執行 Migration**
   - `alembic revision --autogenerate`
   - `alembic upgrade head`
   - 確認資料表建立
8. **Step 5：跑測試（RED → GREEN）**
   - Server: `uv run pytest tests/integration/test_bookmarks.py -v`
   - Client: `pnpm test -- --run src/pages/bookmarks/`
   - 說明 TDD 精神
9. **Step 6：客製化（選讀）**
   - 如何新增欄位到已產生的 domain
   - 如何調整頁面樣式
   - 如何新增路由到 App.tsx
10. **Step 7：用 `/athena:ship` 提交**
    - 說明 ship 指令的流程（review → fix → commit → PR）
    - 或手動 git 流程
11. **完成回顧**
    - 你學到了什麼（SDD 流程、domain registry、athena 指令）
    - 接下來可以做什麼（更多 domain、閱讀 TECHSTACK.md、看 Phase 計劃）
12. **延伸閱讀** — 連結到 CLAUDE.md、TECHSTACK.md、E22 spec、E23 spec

### 驗收標準

- [ ] 使用 `bookmark` 作為示範 domain（不與現有 places/portfolios 衝突）
- [ ] 完整走過 epic pipeline：spec → implement → qa → commit
- [ ] 引用 E22 domain registry 和 E23 `/athena:domain` 功能
- [ ] 每個步驟都有預期輸出或截圖描述（不需實際截圖，描述預期即可）
- [ ] 說明 SDD 順序（OpenAPI → Server → Client）
- [ ] 涵蓋 Athena 指令的使用時機
- [ ] 繁體中文撰寫

---

## 全域驗收標準

### 內容品質

- [ ] 所有使用者文件以繁體中文撰寫
- [ ] 程式碼區塊中的指令可直接複製執行
- [ ] 術語首次出現時附英文原文（如：「快速入門（Quickstart）」）
- [ ] 使用一致的指令格式（`code block` 包裹所有 CLI 指令）
- [ ] 沒有斷裂連結（所有相對路徑指向存在的檔案）

### 文件結構

- [ ] `docs/guides/` 目錄建立
- [ ] 三個檔案都存在且非空
- [ ] README.md 索引頁連結到另外兩份指南
- [ ] Markdown 格式正確（可通過 markdownlint）

### 與現有文件一致

- [ ] 不重複 CLAUDE.md 的內容（引用而非複製）
- [ ] 不重複 TECHSTACK.md 的架構說明（引用而非複製）
- [ ] 工具版本需求與 E21 prerequisite checks 一致
- [ ] Domain 結構描述與 E22 spec 一致
- [ ] `/athena:domain` 用法與 E23 spec 一致

### 不在此 Epic 範圍內

- [ ] 不修改任何程式碼
- [ ] 不建立新的 CLI 工具（那是 E26）
- [ ] 不建立架構圖（那是 E27）
- [ ] 不建立 OpenAPI 模板（那是 E25）

---

## 大小估算

| 項目 | 估算 |
|------|------|
| `docs/guides/README.md` 索引頁 | 0.5h |
| `docs/guides/quickstart.md` 快速入門 | 2h |
| `docs/guides/first-epic-walkthrough.md` Epic 實戰 | 3h |
| 交叉連結檢查 + 校對 | 0.5h |
| **合計** | **~6h (M)** |
