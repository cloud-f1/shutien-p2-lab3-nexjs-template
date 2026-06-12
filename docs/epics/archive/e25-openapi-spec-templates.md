# E25 — OpenAPI Spec Templates + Patterns

> **Size**: S (~1 session) | **Depends on**: 無（獨立文件）
> **Status**: spec
> **Type**: DOCUMENTATION-ONLY — 不修改任何程式碼，僅建立指南與模板檔案

---

## 目標

為本模板的 SDD（Spec-Driven Development）流程提供可直接複製貼上的 OpenAPI 設計模式與填空模板。
每個模式都涵蓋完整的四層對照：OpenAPI YAML → Pydantic schema → SQLAlchemy model → React Query hook，
讓開發者不需從零撰寫，只需替換佔位符即可產出符合專案慣例的 spec。

所有使用者文件以繁體中文撰寫。

## 問題陳述

1. **缺乏模式參考** — 目前的 `docs/openapi/` 有完整的 Places 和 Portfolios spec，
   但沒有抽象化的「設計模式」文件。新開發者必須逆向工程現有 spec 才能理解慣例。
2. **E23 domain generator 的模板偏向機器處理** — `docs/templates/domain/` 使用
   Mustache 變數（`{{PASCAL}}`），適合自動化但不適合人工閱讀與學習。
3. **四層對照分散** — OpenAPI spec、Pydantic、SQLAlchemy、React Query 分佈在不同檔案，
   新手不知道 spec 中的一個定義對應到哪些程式碼。

## 解決方案

建立兩份文件：一份設計模式指南（教學向）、一份填空模板（工具向）。

---

## 產出檔案清單

| 檔案 | 說明 |
|------|------|
| `docs/guides/openapi-patterns.md` | OpenAPI 設計模式指南 — 四種常用模式 + 四層對照 |
| `docs/templates/openapi/crud.yaml` | 填空 CRUD 模板 — 替換佔位符即可使用 |

---

## 檔案一：`docs/guides/openapi-patterns.md` — 設計模式指南

### 段落大綱

1. **前言**
   - 本指南的用途：學習本專案 OpenAPI 的慣例與設計模式
   - SDD 流程提醒：OpenAPI → Server → Client（連結 CLAUDE.md）
   - 預估閱讀時間：~20 分鐘
   - 前置知識：基本 OpenAPI 3.1 語法

2. **專案 OpenAPI 架構總覽**
   - 檔案結構說明：`docs/openapi/openapi.yaml`（入口）→ `paths/` + `schemas/`
   - `$ref` 引用慣例：paths 用 `'paths/xxx.yaml#/key'`、schemas 用 `'../schemas/xxx.yaml#/SchemaName'`
   - 共用元件：`schemas/common.yaml`（ErrorDetail、Unauthorized、ValidationError）
   - 命名慣例表格：

     | 層級 | 慣例 | 範例 |
     |------|------|------|
     | OpenAPI operationId | camelCase | `createPlace`, `listPlaces` |
     | OpenAPI schema | PascalCase + 後綴 | `PlaceCreate`, `PlaceRead`, `PlaceUpdate` |
     | OpenAPI path | kebab-case 複數 | `/places`, `/portfolios` |
     | Pydantic schema | PascalCase + 後綴 | `PlaceCreate`, `PlaceRead` |
     | SQLAlchemy model | PascalCase 單數 | `Place`, `Portfolio` |
     | React Query key | camelCase 複數 | `['places']`, `['portfolios']` |
     | Zod schema | camelCase + Schema | `placeCreateSchema`, `placeReadSchema` |

3. **模式一：基本 CRUD（Basic CRUD）**
   - 情境說明：單一資源的建立 / 讀取 / 更新 / 刪除
   - 參考來源：本專案 Places domain（`docs/openapi/paths/places.yaml`）
   - **OpenAPI YAML**：展示 `collection`（POST + GET）和 `item`（GET + PATCH + DELETE）
     - POST `/resources` → 201 + ResourceRead
     - GET `/resources` → 200 + PaginatedResponse（含 page / page_size 參數）
     - GET `/resources/{id}` → 200 + ResourceRead
     - PATCH `/resources/{id}` → 200 + ResourceRead
     - DELETE `/resources/{id}` → 204
     - 共用錯誤回應：401 Unauthorized、404 Not found、422 Validation error
   - **Schema 三件組**：ResourceCreate（required 欄位）、ResourceRead（含 id/user_id/timestamps）、ResourceUpdate（全 optional）
   - **四層對照表**（以 `bookmark` 為範例）：

     | OpenAPI | Pydantic | SQLAlchemy | React Query |
     |---------|----------|------------|-------------|
     | `BookmarkCreate` | `class BookmarkCreate(BaseModel)` | — | `bookmarkCreateSchema` |
     | `BookmarkRead` | `class BookmarkRead(BaseModel)` | `class Bookmark(Base, UUIDMixin, TimestampMixin)` | `bookmarkReadSchema` |
     | `BookmarkUpdate` | `class BookmarkUpdate(BaseModel)` | — | `bookmarkUpdateSchema` |
     | `POST /bookmarks` | `async def create_bookmark()` | `db.add(bookmark)` | `useCreateBookmark()` |
     | `GET /bookmarks` | `async def list_bookmarks()` | `select(Bookmark).where(...)` | `useBookmarks()` |
     | `GET /bookmarks/{id}` | `async def get_bookmark()` | `db.get(Bookmark, id)` | `useBookmark(id)` |
     | `PATCH /bookmarks/{id}` | `async def update_bookmark()` | `db.merge(bookmark)` | `useUpdateBookmark()` |
     | `DELETE /bookmarks/{id}` | `async def delete_bookmark()` | `db.delete(bookmark)` | `useDeleteBookmark()` |

   - **Pydantic 程式碼範例**（完整 Create / Read / Update 三個 class）
   - **SQLAlchemy model 範例**（含 GUID PK、UUIDMixin、TimestampMixin、user FK）
   - **React Query hook 範例**（使用 `createService` + `useServiceQuery` / `useServiceMutation`）
   - **Zod schema 範例**（含 `satisfies z.ZodType<ApiType>` 型別檢查）

4. **模式二：分頁列表 + 篩選（Paginated List with Filters）**
   - 情境說明：大量資料需分頁，且支援欄位篩選與排序
   - 參考來源：Places `listPlaces`（page / page_size）
   - **OpenAPI YAML**：展示 query parameters
     - `page`（integer, default: 1, minimum: 1）
     - `page_size`（integer, default: 20, minimum: 1, maximum: 100）
     - `search`（string, optional — 模糊搜尋）
     - `sort_by`（enum — 可排序欄位）
     - `sort_order`（enum: asc / desc, default: desc）
     - `category`（string, optional — 精確篩選）
   - **PaginatedResponse schema**：`items` + `total` + `page` + `page_size` + `pages`
   - **四層對照**：
     - Pydantic：`PaginationParams` dataclass / dependency
     - SQLAlchemy：`.offset()` + `.limit()` + `.order_by()` + `.filter()`
     - React Query：queryKey 包含所有 filter 參數，staleTime 使用 `CACHE_TIERS.DYNAMIC`
   - **完整 Pydantic + SQLAlchemy 分頁工具程式碼**（可複製）

5. **模式三：巢狀資源（Nested Resources）**
   - 情境說明：資源屬於另一個資源（如 Portfolio → Places）
   - 參考來源：`/portfolios/{portfolio_id}/places`
   - **OpenAPI YAML**：
     - POST `/parents/{parent_id}/children` → 201
     - GET `/parents/{parent_id}/children` → 200
     - PATCH `/parents/{parent_id}/children/{child_id}` → 200
     - DELETE `/parents/{parent_id}/children/{child_id}` → 204
     - 額外回應碼：409 Conflict（重複關聯）
   - **Schema 設計**：
     - ChildCreate 中包含 `child_id` FK（非完整 child 建立）
     - ChildRead 中嵌入父資源的 summary 或子資源的完整資料
   - **四層對照**：
     - Pydantic：endpoint 接收 parent_id path param + child body
     - SQLAlchemy：association table（many-to-many）或 FK（one-to-many）
     - React Query：queryKey 包含 parent_id（如 `['portfolios', id, 'places']`）
   - **Association table 範例**（SQLAlchemy，含額外欄位如 notes、purchase_price）

6. **模式四：檔案上傳（File Upload）**
   - 情境說明：使用者上傳圖片或文件
   - 本專案目前無此功能，但提供標準模式供未來擴展
   - **OpenAPI YAML**：
     - `multipart/form-data` requestBody
     - `type: string, format: binary` 欄位
     - 回應包含 `file_url` 欄位
   - **四層對照**：
     - Pydantic：`UploadFile` type hint
     - SQLAlchemy：儲存 file path / URL，不存 binary
     - React Query：`useMutation` + `FormData`
   - **注意事項**：檔案大小限制、MIME type 驗證、storage backend 選擇

7. **常見陷阱與最佳實踐**
   - nullable 欄位：使用 `type: ['string', 'null']`（OpenAPI 3.1 語法）
   - `format: uuid` 必須配合 Pydantic `uuid.UUID` + Zod `z.string().uuid()`
   - `format: decimal`：用 `type: string` + `format: decimal` + `pattern` 約束
   - `maxLength` 對齊：OpenAPI、Pydantic、SQLAlchemy 三處必須一致
   - Update schema 全 optional：不設 `required`，Pydantic 用 `Optional[T] = None`
   - 錯誤回應一律引用 `common.yaml`：避免重複定義
   - operationId 唯一性：跨所有 path files 不可重複

8. **延伸閱讀**
   - `docs/openapi/openapi.yaml` — 入口檔案
   - `docs/openapi/paths/` — 所有 path 定義
   - `docs/openapi/schemas/` — 所有 schema 定義
   - `docs/templates/domain/` — E23 domain generator 模板
   - `docs/guides/quickstart.md` — 快速入門（E24）
   - `docs/guides/first-epic-walkthrough.md` — 第一個 Epic 實戰（E24）

### 驗收標準

- [ ] 四種模式各有完整的 OpenAPI YAML 範例（可直接複製）
- [ ] 每種模式都有四層對照表（OpenAPI → Pydantic → SQLAlchemy → React Query）
- [ ] Pydantic / SQLAlchemy / React Query 程式碼範例可直接使用（非虛擬碼）
- [ ] 使用 `bookmark` 作為範例 domain（與 E24 一致）
- [ ] 所有 YAML 範例符合 OpenAPI 3.1 語法
- [ ] 命名慣例與 `docs/openapi/` 現有 spec 一致
- [ ] 繁體中文撰寫

---

## 檔案二：`docs/templates/openapi/crud.yaml` — 填空 CRUD 模板

### 設計原則

- 使用人類可讀的佔位符（`__RESOURCE__`），而非 Mustache 變數
- 每個需要替換的地方都用 `__UPPER_CASE__` 標記
- 包含行內註解說明每個區塊的用途
- 一個檔案包含 paths + schemas，適合快速開始

### 佔位符清單

| 佔位符 | 說明 | 範例 |
|--------|------|------|
| `__RESOURCE__` | 資源名稱（PascalCase 單數） | `Bookmark` |
| `__RESOURCE_LOWER__` | 資源名稱（snake_case 單數） | `bookmark` |
| `__RESOURCES_KEBAB__` | 資源路徑（kebab-case 複數） | `bookmarks` |
| `__RESOURCES_LOWER__` | 資源名稱（snake_case 複數） | `bookmarks` |
| `__TAG__` | OpenAPI tag 名稱 | `bookmarks` |
| `__FIELD_1__` ~ `__FIELD_N__` | 自訂欄位名稱 | `url`, `title` |
| `__FIELD_1_TYPE__` ~ | 欄位型別 | `string`, `integer` |

### 模板內容結構

```yaml
# ============================================
# __RESOURCE__ Domain — OpenAPI CRUD Template
# ============================================
# 使用方式：
#   1. 全文搜尋替換所有 __佔位符__
#   2. 移除不需要的欄位
#   3. 拆分到 docs/openapi/paths/ 和 docs/openapi/schemas/
#   4. 在 openapi.yaml 入口加入 $ref

# --- Paths ---
# (collection: POST + GET, item: GET + PATCH + DELETE)

# --- Schemas ---
# (__RESOURCE__Create, __RESOURCE__Read, __RESOURCE__Update, Paginated__RESOURCE__Response)
```

### 完整性要求

- 包含所有五個 CRUD endpoints（POST / GET list / GET by ID / PATCH / DELETE）
- 包含三個 schema（Create / Read / Update）+ PaginatedResponse
- 包含分頁參數（page / page_size）
- 包含共用錯誤回應引用（401 / 404 / 422）
- 包含 `format: uuid` 的 id 和 user_id
- 包含 `created_at` / `updated_at` timestamps
- 頂部有使用說明註解（繁中）
- 底部有「下一步」提示：如何拆分到 split 結構、如何註冊到入口

### 驗收標準

- [ ] 所有佔位符使用 `__UPPER_CASE__` 格式
- [ ] 替換佔位符後為合法的 OpenAPI 3.1 YAML
- [ ] 包含行內註解說明每個區塊
- [ ] 頂部使用說明以繁體中文撰寫
- [ ] 結構與 `docs/openapi/paths/places.yaml` + `docs/openapi/schemas/place.yaml` 一致

---

## 全域驗收標準

### 內容品質

- [ ] 所有使用者文件以繁體中文撰寫
- [ ] 程式碼區塊可直接複製使用（非虛擬碼）
- [ ] 術語首次出現時附英文原文（如：「巢狀資源（Nested Resources）」）
- [ ] 設計模式基於本專案真實的 Places / Portfolios spec，非憑空杜撰
- [ ] 四層對照完整且準確（OpenAPI ↔ Pydantic ↔ SQLAlchemy ↔ React Query）

### 與現有文件一致

- [ ] 命名慣例與 `docs/openapi/` 一致（operationId = camelCase，schema = PascalCase + 後綴）
- [ ] 分頁結構與 `PaginatedPlaceResponse` / `PaginatedPortfolioResponse` 一致
- [ ] 錯誤回應引用 `schemas/common.yaml` 的共用定義
- [ ] nullable 語法使用 OpenAPI 3.1 的 `type: ['string', 'null']`
- [ ] UUID 欄位使用 `type: string, format: uuid`
- [ ] 填空模板的結構可拆分為 `docs/openapi/paths/` + `docs/openapi/schemas/`

### 與其他 Epic 的關係

- [ ] 範例 domain 使用 `bookmark`（與 E24 first-epic-walkthrough 一致）
- [ ] 填空模板與 E23 domain generator 的 `.tmpl` 檔案結構對齊（人可讀 vs 機器處理的互補關係）
- [ ] 不與 E23 `docs/templates/domain/openapi/*.tmpl` 重複（模板用途不同：E23 = 自動化、E25 = 人工參考）

### 不在此 Epic 範圍內

- [ ] 不修改任何程式碼
- [ ] 不修改現有 `docs/openapi/` 的 spec 檔案
- [ ] 不建立 CLI 工具（那是 E26）
- [ ] 不建立架構圖（那是 E27）

---

## 大小估算

| 項目 | 估算 |
|------|------|
| `docs/guides/openapi-patterns.md` 設計模式指南 | 3h |
| `docs/templates/openapi/crud.yaml` 填空模板 | 1h |
| 交叉檢查：與現有 spec 一致性驗證 | 0.5h |
| 校對 + 連結檢查 | 0.5h |
| **合計** | **~5h (S)** |
