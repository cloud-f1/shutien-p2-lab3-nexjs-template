# Blog 範例 — 部落格文章 Domain

> **來源設定**：`docs/templates/domain/examples/blog.yaml`
> **實體名稱**：`post`（文章）
> **複雜度**：基礎

---

## Domain 簡介

Blog domain 管理使用者的部落格文章，支援草稿與已發布兩種狀態。
這是最基本的 domain 範例，展示標準 CRUD 流程加上簡單的狀態管理邏輯。
適合作為第一個學習範例，理解模板展開後的完整程式碼結構。

---

## 資料模型

| 欄位 | 型別 | 必填 | 預設值 | 驗證規則 | 說明 |
|------|------|------|--------|---------|------|
| `id` | `GUID()` | 自動 | `uuid4()` | UUID 格式 | 主鍵（UUIDMixin） |
| `title` | `String(200)` | Yes | — | max 200 字元 | 文章標題 |
| `body` | `Text` | Yes | — | max 10,000 字元 | 文章內容 |
| `published` | `Boolean` | No | `false` | — | 發布狀態 |
| `published_at` | `DateTime` | No | `null` | ISO 8601 | 發布時間（自動設定） |
| `user_id` | `GUID()` | 自動 | — | FK → user.id | 所屬使用者 |
| `created_at` | `DateTime` | 自動 | `utcnow` | — | 建立時間（TimestampMixin） |
| `updated_at` | `DateTime` | 自動 | `utcnow` | — | 更新時間（TimestampMixin） |

---

## API 端點清單

| Method | Path | 說明 | 特殊邏輯 |
|--------|------|------|---------|
| `POST` | `/posts/` | 建立文章 | 若 `published=true`，自動設定 `published_at` |
| `GET` | `/posts/` | 列表（分頁） | 支援 `?published=true/false` 過濾 |
| `GET` | `/posts/{post_id}` | 取得單篇文章 | 僅限本人文章 |
| `PATCH` | `/posts/{post_id}` | 更新文章 | 首次設定 `published=true` 時自動設定 `published_at` |
| `DELETE` | `/posts/{post_id}` | 刪除文章 | 僅限本人文章 |

---

## 設計決策

1. **發布狀態管理** — `published` 布林欄位控制文章是否可見。設計上選擇簡單的
   布林值而非 enum（如 draft/published/archived），因為對基礎範例來說足夠，
   且展示如何在 endpoint 中處理狀態邏輯。

2. **`published_at` 自動設定** — 使用者不能直接設定 `published_at`，
   它在 `published` 首次變為 `true` 時由 server 自動設定為 `datetime.utcnow()`。
   這避免了時間一致性問題，也展示了「Schema 欄位排除」模式（`PostCreate` 不含此欄位）。

3. **草稿 vs 已發布過濾** — list endpoint 加入 `published` query parameter。
   未指定時回傳所有文章（草稿+已發布）。這展示了如何在標準 CRUD list 上擴展過濾邏輯。

4. **排序策略** — 已發布文章按 `published_at DESC` 排序（最新發布優先），
   草稿按 `created_at DESC` 排序。混合查詢時使用 `created_at DESC` 作為統一排序。

5. **Body 長度限制** — 10,000 字元上限，展示 `Text` 欄位的 `max_length` 處理。
   Pydantic schema 使用 `Field(max_length=10000)` 驗證，
   OpenAPI schema 使用 `maxLength: 10000`。

---

## 與基礎模板的差異

相比 `docs/templates/domain/` 的預設 CRUD 模板，Blog 範例做了以下擴展：

- **`endpoints.py`**：list endpoint 增加 `published: bool | None` query filter 參數
- **`endpoints.py`**：create/update 增加 `published_at` 自動設定邏輯
- **`schemas.py`**：`PostCreate` 不包含 `published_at`（server 自動設定）
- **`paths.yaml`**：list 增加 `published` query parameter 定義
- **`schema.ts`**：`postCreateSchema` 不包含 `published_at` 欄位

---

## 檔案對照表

| 範例檔案 | 對應模板 | 實際路徑（部署時） |
|---------|---------|-----------------|
| `openapi/schemas.yaml` | `openapi/schemas.yaml.tmpl` | `docs/openapi/schemas/post.yaml` |
| `openapi/paths.yaml` | `openapi/paths.yaml.tmpl` | `docs/openapi/paths/posts.yaml` |
| `server/__init__.py` | `server/__init__.py.tmpl` | `server/app/domains/posts/__init__.py` |
| `server/models.py` | `server/models.py.tmpl` | `server/app/domains/posts/models.py` |
| `server/schemas.py` | `server/schemas.py.tmpl` | `server/app/domains/posts/schemas.py` |
| `server/endpoints.py` | `server/endpoints.py.tmpl` | `server/app/domains/posts/endpoints.py` |
| `client/schema.ts` | `client/schema.ts.tmpl` | `client/src/schemas/post.ts` |
| `client/service.ts` | `client/service.ts.tmpl` | `client/src/api/services/posts.ts` |
| `client/hooks.ts` | `client/hooks.ts.tmpl` | `client/src/hooks/usePosts.ts` |
| `client/PostsPage.tsx` | `client/page.tsx.tmpl` | `client/src/pages/posts/PostsPage.tsx` |
| `client/Posts.css` | `client/page.css.tmpl` | `client/src/pages/posts/Posts.css` |
| `tests/test_posts.py` | `server/test_integration.py.tmpl` | `server/tests/integration/test_posts.py` |
| `tests/PostsPage.test.tsx` | `client/page.test.tsx.tmpl` | `client/src/pages/posts/PostsPage.test.tsx` |
| `tests/handlers.ts` | `client/handlers.ts.tmpl` | `client/src/tests/handlers/posts.ts` |
