# Domain 範例展示集

> **這些是參考範例，不是可執行程式碼。**
> 用途：展示從 OpenAPI 設計到前後端實作的完整 SDD 流程，
> 作為使用者自行建立 domain 時的對照參考。

---

## 範例總覽

| 範例 | Domain 名稱 | 實體 | 特殊模式 | 複雜度 |
|------|------------|------|---------|--------|
| [Blog](./blog/) | `post` | 文章 | 發布狀態（draft/published）、`published_at` 自動設定、過濾列表 | 基礎 |
| [CRM](./crm/) | `contact` | 聯絡人 | 多欄位搜尋（`?q=keyword`）、email 驗證、notes 截斷 | 中等 |
| [Todo](./todo/) | `task` | 任務 | 優先序排序、完成狀態過濾、`is_overdue` 計算欄位、批次更新 | 基礎+ |

---

## 如何使用這些範例

1. **閱讀 `README.md`** — 了解該 domain 的設計決策與架構考量
2. **從 `openapi/` 看 API 契約** — 這是 SDD 流程的第一步，所有型別的唯一真相來源
3. **對照 `server/` 和 `client/`** — 看模板展開後的完整實作程式碼
4. **參考 `tests/`** — 了解整合測試與元件測試的撰寫模式

---

## 與模板的關係

這些範例是 `docs/templates/domain/` 中 `.tmpl` 模板的**展開結果**。

| 模板檔案 | 說明 | 展開範例 |
|---------|------|---------|
| `server/__init__.py.tmpl` | DomainConfig 匯出 | `blog/server/__init__.py` |
| `server/models.py.tmpl` | SQLAlchemy model | `blog/server/models.py` |
| `server/schemas.py.tmpl` | Pydantic schemas | `blog/server/schemas.py` |
| `server/endpoints.py.tmpl` | FastAPI router | `blog/server/endpoints.py` |
| `client/schema.ts.tmpl` | Zod schemas + types | `blog/client/schema.ts` |
| `client/service.ts.tmpl` | createService 工廠 | `blog/client/service.ts` |
| `client/hooks.ts.tmpl` | React Query hooks | `blog/client/hooks.ts` |
| `client/page.tsx.tmpl` | React 頁面元件 | `blog/client/PostsPage.tsx` |
| `client/page.css.tmpl` | 頁面樣式 | `blog/client/Posts.css` |
| `client/handlers.ts.tmpl` | MSW mock handlers | `blog/tests/handlers.ts` |
| `server/test_integration.py.tmpl` | Server 整合測試 | `blog/tests/test_posts.py` |
| `client/page.test.tsx.tmpl` | Client 元件測試 | `blog/tests/PostsPage.test.tsx` |

每個範例的來源設定檔位於 `docs/templates/domain/examples/`：

- `blog.yaml` → Blog 範例
- `crm.yaml` → CRM 範例
- `todo.yaml` → Todo 範例

---

## 相關資源

- **Domain Generator**：`/athena:domain <name>` — 從 `.yaml` 設定自動產生完整 domain（E23）
- **快速入門指南**：`docs/guides/quickstart.md`（E24）
- **模板目錄**：`docs/templates/domain/` — `.tmpl` 範本和欄位型別對照
- **架構圖**：`docs/diagrams/` — Mermaid 架構圖（E27）

---

## 共通慣例

所有範例都遵循以下專案慣例：

- **GUID 主鍵**：所有 PK/FK 使用 `GUID()` TypeDecorator（E0）
- **Rate Limiting**：所有端點使用 `@limiter.limit(settings.RATE_LIMIT_GENERAL)`（E16）
- **Structured Logging**：使用 `logging.getLogger(__name__)`（E19）
- **輸入限制**：`Text` 欄位設定 `max_length`（E16）
- **Domain Registry**：透過 `DomainConfig` 自動註冊（E22）
- **createService 工廠**：Client 端使用統一的 CRUD service 工廠（E23）
- **Design System Tokens**：CSS 使用 `--font-*`、`--primary-*`、`--text-*` 等變數
