# E28 — Example Domain Showcase（範例 Domain 展示集）

> **Size**: M (~1-2 sessions) | **Depends on**: E22（使用 domain registry 結構）
> **Status**: spec
> **Type**: DOCUMENTATION-ONLY — 不修改任何程式碼，僅建立參考範例文件於 `docs/examples/`

---

## 目標

為本模板建立三套完整的 domain 範例（Blog、CRM、Todo），
放置於 `docs/examples/`。每套範例展示從 OpenAPI 設計到前後端實作的完整 SDD 流程，
作為使用者自行建立 domain 時的**參考文件**，而非可執行程式碼。

## 問題陳述

1. **模板缺少實際範例** — `docs/templates/domain/` 有 `.tmpl` 範本和 `.yaml` 設定檔，
   但使用者看不到模板展開後的完整程式碼長什麼樣子。
2. **學習曲線陡峭** — 新使用者需要同時理解 OpenAPI → server → client 的對應關係，
   缺乏具體範例讓他們對照學習。
3. **設計決策無處記錄** — 每個 domain 都有其特殊考量（如 Blog 的發布狀態、CRM 的搜尋、
   Todo 的優先序排序），但這些決策在模板中看不到。
4. **E23 domain generator 缺少展示** — generator 從 `.yaml` 產出完整 domain，
   但沒有「展開後的成品」可供使用者預覽。

## 解決方案

在 `docs/examples/` 建立三個獨立的範例目錄，每個包含完整的 domain 展開結果 +
設計決策文件。範例基於 `docs/templates/domain/examples/` 中已有的
`blog.yaml`、`crm.yaml`、`todo.yaml` 設定檔展開。

---

## 目錄結構

```
docs/examples/
├── README.md                         ← 索引頁：三個範例的總覽 + 使用指引
├── blog/                             ← 範例一：Blog（部落格）
│   ├── README.md                     ← 設計決策 + 架構說明
│   ├── openapi/
│   │   ├── paths.yaml                ← OpenAPI path 定義
│   │   └── schemas.yaml              ← OpenAPI schema 定義
│   ├── server/
│   │   ├── __init__.py               ← DomainConfig 匯出
│   │   ├── models.py                 ← SQLAlchemy model
│   │   ├── schemas.py                ← Pydantic schemas
│   │   └── endpoints.py              ← FastAPI router
│   ├── client/
│   │   ├── schema.ts                 ← Zod schemas + TypeScript types
│   │   ├── service.ts                ← createService 工廠呼叫
│   │   ├── hooks.ts                  ← useServiceQuery / useServiceMutation
│   │   ├── PostsPage.tsx             ← React 列表 + 詳情頁面
│   │   └── Posts.css                 ← 頁面樣式
│   └── tests/
│       ├── test_posts.py             ← Server 整合測試
│       ├── PostsPage.test.tsx        ← Client 元件測試
│       └── handlers.ts               ← MSW mock handlers
├── crm/                              ← 範例二：CRM（客戶關係管理）
│   ├── README.md
│   ├── openapi/
│   │   ├── paths.yaml
│   │   └── schemas.yaml
│   ├── server/
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   └── endpoints.py
│   ├── client/
│   │   ├── schema.ts
│   │   ├── service.ts
│   │   ├── hooks.ts
│   │   ├── ContactsPage.tsx
│   │   └── Contacts.css
│   └── tests/
│       ├── test_contacts.py
│       ├── ContactsPage.test.tsx
│       └── handlers.ts
└── todo/                             ← 範例三：Todo（待辦事項）
    ├── README.md
    ├── openapi/
    │   ├── paths.yaml
    │   └── schemas.yaml
    ├── server/
    │   ├── __init__.py
    │   ├── models.py
    │   ├── schemas.py
    │   └── endpoints.py
    ├── client/
    │   ├── schema.ts
    │   ├── service.ts
    │   ├── hooks.ts
    │   ├── TasksPage.tsx
    │   └── Tasks.css
    └── tests/
        ├── test_tasks.py
        ├── TasksPage.test.tsx
        └── handlers.ts
```

---

## 檔案一：`docs/examples/README.md` — 索引頁

### 內容

- 標題 + 目的說明（這些是參考範例，不是可執行程式碼）
- 三個範例的比較表：

| 範例 | Domain 名稱 | 特殊模式 | 複雜度 |
|------|------------|---------|--------|
| Blog | `post` | 發布狀態（draft/published）、`published_at` 時間戳 | 基礎 |
| CRM | `contact` | 多欄位搜尋、email/phone 格式驗證 | 中等 |
| Todo | `task` | 優先序排序、完成狀態過濾、`due_date` | 基礎+ |

- 如何使用這些範例：
  1. 閱讀 `README.md` 了解設計決策
  2. 從 `openapi/` 看 API 契約
  3. 對照 `server/` 和 `client/` 看實作
  4. 參考 `tests/` 了解測試模式
- 與 `docs/templates/domain/` 的關係說明（範例 = 模板展開結果）
- 連結到 E23 domain generator（`/athena:domain`）和 E24 quickstart

### 驗收標準

- [ ] 三個範例的連結和簡介完整
- [ ] 說明範例與模板的關係
- [ ] 繁體中文撰寫

---

## 範例內容規範

### 每個範例的 `README.md` 必須包含

1. **Domain 簡介**（1-2 段）— 這個 domain 解決什麼問題
2. **資料模型**（表格）— 欄位名稱、型別、說明、驗證規則
3. **API 端點清單**（表格）— method、path、說明、特殊邏輯
4. **設計決策**（條列）— 為什麼這樣設計，有哪些取捨
5. **與基礎模板的差異**（條列）— 相比 `createService` 預設行為，額外做了什麼
6. **檔案對照表**（表格）— 範例檔案 → 對應模板 `.tmpl` → 對應實際路徑

### OpenAPI 檔案規範

- 基於 `docs/templates/domain/openapi/*.yaml.tmpl` 展開
- 使用 E28 範例 `.yaml` 中的欄位定義
- 遵循現有 `docs/openapi/` 的格式慣例
- 每個 domain 產出 `paths.yaml`（CRUD endpoints）和 `schemas.yaml`（Create/Read/Update/Paginated）

### Server 檔案規範

- 基於 `docs/templates/domain/server/*.tmpl` 展開
- 使用 `GUID()` 作為所有 PK/FK（遵循 E0 規範）
- `__init__.py` 匯出 `DomainConfig`（遵循 E22 registry pattern）
- 所有端點有 `@limiter.limit()` 裝飾器（遵循 E16）
- 使用 structured logging（遵循 E19）
- `Text` 欄位有 `max_length` 限制（遵循 E16 輸入限制）

### Client 檔案規範

- 基於 `docs/templates/domain/client/*.tmpl` 展開
- Zod schema 使用 `satisfies z.ZodType<ApiType>` 進行編譯期漂移檢測
- `createService()` factory 呼叫
- `useServiceQuery` / `useServiceMutation` hooks
- 頁面元件使用 `DashboardLayout` 結構
- CSS 使用 design system tokens（`--font-*`, `--primary-*` 等）

### 測試檔案規範

- Server：`pytest` 整合測試，覆蓋 CRUD + 權限 + 驗證
- Client：`vitest` + `@testing-library/react`，使用 `userEvent`
- MSW handlers 使用 `createCrudHandlers()` factory

---

## 範例二細節：Blog（部落格）

### 來源設定

`docs/templates/domain/examples/blog.yaml` — `post` entity

### 欄位

| 欄位 | 型別 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| `title` | `String(200)` | Yes | — | 文章標題 |
| `body` | `Text` | Yes | — | 文章內容，max 10,000 字元 |
| `published` | `Boolean` | No | `false` | 發布狀態 |
| `published_at` | `DateTime` | No | — | 發布時間 |

### 特殊設計決策（需在 README 說明）

1. **發布狀態管理** — `published` 欄位控制是否可見；`published_at` 在首次發布時自動設定
2. **草稿 vs 已發布過濾** — list endpoint 加入 `?published=true/false` query 參數
3. **Body 長度限制** — 10,000 字元上限，展示 `Text` 欄位的 `max_length` 處理
4. **時間排序** — 已發布文章按 `published_at DESC` 排序，草稿按 `created_at DESC`

### 與基礎模板差異

- `endpoints.py`：list endpoint 增加 `published` query filter
- `schemas.py`：`PostCreate` 不包含 `published_at`（server 自動設定）
- `paths.yaml`：list 增加 `published` query parameter

---

## 範例三細節：CRM（客戶關係管理）

### 來源設定

`docs/templates/domain/examples/crm.yaml` — `contact` entity

### 欄位

| 欄位 | 型別 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| `name` | `String(200)` | Yes | — | 聯絡人姓名 |
| `email` | `String(320)` | No | — | 電子郵件 |
| `phone` | `String(20)` | No | — | 電話號碼 |
| `company` | `String(200)` | No | — | 公司名稱 |
| `notes` | `Text` | No | — | 備註，max 2,000 字元 |

### 特殊設計決策（需在 README 說明）

1. **多欄位搜尋** — list endpoint 加入 `?q=keyword` query 參數，搜尋 name、email、company
2. **Email 格式驗證** — Pydantic `EmailStr` + Zod `z.string().email()`（可選欄位）
3. **Phone 格式寬鬆** — 只限長度，不做格式驗證（國際號碼格式差異大）
4. **多欄位域** — 展示 5 欄位 domain 的表單佈局和驗證模式
5. **Notes 截斷** — list 回傳時 notes 截斷至 200 字元，detail 回傳完整內容

### 與基礎模板差異

- `endpoints.py`：list endpoint 增加 `q` search query + `ilike` 搜尋
- `schemas.py`：`ContactRead` 增加 `notes_preview` 計算欄位
- `paths.yaml`：list 增加 `q` search parameter
- `schema.ts`：email 欄位使用 `z.string().email().optional()`

---

## 範例四細節：Todo（待辦事項）

### 來源設定

`docs/templates/domain/examples/todo.yaml` — `task` entity

### 欄位

| 欄位 | 型別 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| `title` | `String(200)` | Yes | — | 任務標題 |
| `description` | `Text` | No | — | 任務描述，max 2,000 字元 |
| `completed` | `Boolean` | No | `false` | 完成狀態 |
| `due_date` | `DateTime` | No | — | 到期日 |
| `priority` | `Integer` | No | `0` | 優先序（0=低, 1=中, 2=高） |

### 特殊設計決策（需在 README 說明）

1. **完成狀態過濾** — list endpoint 加入 `?completed=true/false` query 參數
2. **優先序排序** — list endpoint 預設按 `priority DESC, due_date ASC` 排序
3. **Priority 枚舉** — 使用 integer 而非 string enum，方便排序和比較
4. **Due date 過期標示** — `TaskRead` 增加 `is_overdue` 計算欄位（`due_date < now and not completed`）
5. **批次完成** — 額外端點 `PATCH /tasks/batch` 接受 `task_ids` + `completed` 欄位

### 與基礎模板差異

- `endpoints.py`：list 增加 `completed` filter + `priority` 排序；新增 batch update endpoint
- `schemas.py`：`TaskRead` 增加 `is_overdue` 計算欄位
- `paths.yaml`：list 增加 `completed` query；新增 `/tasks/batch` path
- `schema.ts`：priority 使用 `z.number().int().min(0).max(2)`

---

## 全域驗收標準

### 結構完整性

- [ ] `docs/examples/README.md` 索引頁存在且連結正確
- [ ] 三個範例目錄各自包含完整的 `openapi/`、`server/`、`client/`、`tests/` 子目錄
- [ ] 每個範例有獨立的 `README.md` 設計決策文件
- [ ] 所有檔案使用正確的模板展開結果（非 `.tmpl` 佔位符）

### 內容正確性

- [ ] OpenAPI schemas 與 server Pydantic schemas 欄位完全對齊
- [ ] OpenAPI paths 與 server endpoints 路徑完全對齊
- [ ] Client Zod schemas 與 OpenAPI schemas 型別對齊
- [ ] Server models 遵循 GUID PK + `UUIDMixin` + `TimestampMixin` 模式
- [ ] Server endpoints 遵循 E16 rate limiting + E19 structured logging
- [ ] Client 元件使用 `DashboardLayout` + design system tokens

### 設計決策文件

- [ ] 每個 README 包含全部 6 個必要區塊（簡介、模型、端點、決策、差異、對照表）
- [ ] 特殊設計決策有合理的技術理由
- [ ] 與基礎模板的差異清楚標示

### 測試範例

- [ ] Server 測試覆蓋 CRUD 五個端點 + 權限檢查 + 驗證錯誤
- [ ] Client 測試使用 `userEvent` + MSW handlers
- [ ] MSW handlers 使用 `createCrudHandlers()` factory

### 範例品質

- [ ] 程式碼可直接複製到對應目錄使用（路徑和 import 正確）
- [ ] 遵循 `docs/context/` 中記錄的所有 coding conventions
- [ ] 繁體中文用於所有 README 和說明文字
- [ ] 英文用於所有程式碼和技術術語

### 不在此 Epic 範圍內

- [ ] 不修改任何現有程式碼
- [ ] 不修改 `docs/templates/domain/` 模板檔案
- [ ] 不建立可執行的測試（範例測試是參考文件，不實際跑 CI）
- [ ] 不新增 npm/pip 依賴
- [ ] 不修改 `docs/openapi/` 正式 API 規格

---

## 實作順序

1. 建立 `docs/examples/README.md` 索引頁
2. Blog 範例（最簡單，作為基準）
3. Todo 範例（新增 batch endpoint，展示模板擴展）
4. CRM 範例（多欄位搜尋，展示較複雜的查詢模式）
5. 交叉檢查：三個範例的一致性 + 與 `docs/templates/domain/` 的對照

## 大小估算

| 項目 | 估算 |
|------|------|
| `docs/examples/README.md` 索引頁 | 0.5h |
| Blog 範例（完整 domain + README） | 2h |
| Todo 範例（含 batch endpoint 擴展） | 2h |
| CRM 範例（含搜尋 + 多欄位） | 2.5h |
| 交叉檢查 + 一致性驗證 | 1h |
| **合計** | **~8h (M)** |
