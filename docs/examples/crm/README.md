# CRM 範例 — 客戶關係管理 Domain

> **來源設定**：`docs/templates/domain/examples/crm.yaml`
> **實體名稱**：`contact`（聯絡人）
> **複雜度**：中等

---

## Domain 簡介

CRM domain 管理使用者的客戶聯絡人資料，支援多欄位搜尋和 email 格式驗證。
這是三個範例中最複雜的，展示了 5 欄位 domain 的表單佈局、跨欄位搜尋（`?q=keyword`）、
以及 notes 欄位的截斷處理模式。適合理解較複雜查詢邏輯和多欄位驗證。

---

## 資料模型

| 欄位 | 型別 | 必填 | 預設值 | 驗證規則 | 說明 |
|------|------|------|--------|---------|------|
| `id` | `GUID()` | 自動 | `uuid4()` | UUID 格式 | 主鍵（UUIDMixin） |
| `name` | `String(200)` | Yes | — | max 200 字元 | 聯絡人姓名 |
| `email` | `String(320)` | No | `null` | email 格式（可選） | 電子郵件 |
| `phone` | `String(20)` | No | `null` | max 20 字元（不做格式驗證） | 電話號碼 |
| `company` | `String(200)` | No | `null` | max 200 字元 | 公司名稱 |
| `notes` | `Text` | No | `null` | max 2,000 字元 | 備註 |
| `user_id` | `GUID()` | 自動 | — | FK → user.id | 所屬使用者 |
| `created_at` | `DateTime` | 自動 | `utcnow` | — | 建立時間（TimestampMixin） |
| `updated_at` | `DateTime` | 自動 | `utcnow` | — | 更新時間（TimestampMixin） |

---

## API 端點清單

| Method | Path | 說明 | 特殊邏輯 |
|--------|------|------|---------|
| `POST` | `/contacts/` | 建立聯絡人 | email 格式驗證（可選欄位） |
| `GET` | `/contacts/` | 列表（分頁） | 支援 `?q=keyword` 搜尋 name、email、company |
| `GET` | `/contacts/{contact_id}` | 取得聯絡人詳情 | 回傳完整 notes |
| `PATCH` | `/contacts/{contact_id}` | 更新聯絡人 | 僅限本人聯絡人 |
| `DELETE` | `/contacts/{contact_id}` | 刪除聯絡人 | 僅限本人聯絡人 |

---

## 設計決策

1. **多欄位搜尋** — list endpoint 加入 `?q=keyword` query 參數，
   使用 `ilike` 同時搜尋 name、email、company 三個欄位。
   選擇 `OR` 邏輯而非 `AND`，因為使用者通常期望模糊搜尋行為。
   展示如何在 SQLAlchemy 中組合多個 `or_` 條件。

2. **Email 格式驗證** — email 是可選欄位，但若提供則必須符合 email 格式。
   Server 端使用 Pydantic `EmailStr`，Client 端使用 `z.string().email().optional()`。
   這展示了「可選但有格式限制」的驗證模式。

3. **Phone 格式寬鬆** — 電話號碼只限長度（max 20），不做格式驗證。
   原因是國際電話號碼格式差異太大（+886、+1-555-1234、(02)1234-5678），
   嚴格驗證反而降低可用性。

4. **Notes 截斷** — list 回傳時 notes 截斷至 200 字元（`notes_preview`），
   detail 端點回傳完整 notes。這減少了列表 API 的回應大小，
   展示了「列表用精簡 schema、詳情用完整 schema」的模式。
   `ContactRead` 包含 `notes_preview` 計算欄位。

5. **多欄位表單** — 5 個使用者欄位展示了較複雜的表單佈局，
   包含必填/選填混合、不同輸入類型（text、email、textarea）。

---

## 與基礎模板的差異

相比 `docs/templates/domain/` 的預設 CRUD 模板，CRM 範例做了以下擴展：

- **`endpoints.py`**：list endpoint 增加 `q` search query + `or_`/`ilike` 搜尋
- **`schemas.py`**：`ContactRead` 增加 `notes_preview` 計算欄位（截斷至 200 字元）
- **`schemas.py`**：email 欄位使用 `EmailStr`（可選）
- **`paths.yaml`**：list 增加 `q` search parameter 定義
- **`schema.ts`**：email 欄位使用 `z.string().email().optional()`
- **`schema.ts`**：`contactReadSchema` 包含 `notes_preview` 欄位

---

## 檔案對照表

| 範例檔案 | 對應模板 | 實際路徑（部署時） |
|---------|---------|-----------------|
| `openapi/schemas.yaml` | `openapi/schemas.yaml.tmpl` | `docs/openapi/schemas/contact.yaml` |
| `openapi/paths.yaml` | `openapi/paths.yaml.tmpl` | `docs/openapi/paths/contacts.yaml` |
| `server/__init__.py` | `server/__init__.py.tmpl` | `server/app/domains/contacts/__init__.py` |
| `server/models.py` | `server/models.py.tmpl` | `server/app/domains/contacts/models.py` |
| `server/schemas.py` | `server/schemas.py.tmpl` | `server/app/domains/contacts/schemas.py` |
| `server/endpoints.py` | `server/endpoints.py.tmpl` | `server/app/domains/contacts/endpoints.py` |
| `client/schema.ts` | `client/schema.ts.tmpl` | `client/src/schemas/contact.ts` |
| `client/service.ts` | `client/service.ts.tmpl` | `client/src/api/services/contacts.ts` |
| `client/hooks.ts` | `client/hooks.ts.tmpl` | `client/src/hooks/useContacts.ts` |
| `client/ContactsPage.tsx` | `client/page.tsx.tmpl` | `client/src/pages/contacts/ContactsPage.tsx` |
| `client/Contacts.css` | `client/page.css.tmpl` | `client/src/pages/contacts/Contacts.css` |
| `tests/test_contacts.py` | `server/test_integration.py.tmpl` | `server/tests/integration/test_contacts.py` |
| `tests/ContactsPage.test.tsx` | `client/page.test.tsx.tmpl` | `client/src/pages/contacts/ContactsPage.test.tsx` |
| `tests/handlers.ts` | `client/handlers.ts.tmpl` | `client/src/tests/handlers/contacts.ts` |
