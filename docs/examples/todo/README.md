# Todo 範例 — 待辦事項 Domain

> **來源設定**：`docs/templates/domain/examples/todo.yaml`
> **實體名稱**：`task`（任務）
> **複雜度**：基礎+

---

## Domain 簡介

Todo domain 管理使用者的待辦事項，支援優先序排序、完成狀態過濾和到期日追蹤。
相比 Blog 範例，Todo 展示了更多進階模式：計算欄位（`is_overdue`）、
自訂排序邏輯、以及額外的批次操作端點（`PATCH /tasks/batch`）。
適合作為第二個學習範例，理解如何在基礎 CRUD 上擴展業務邏輯。

---

## 資料模型

| 欄位 | 型別 | 必填 | 預設值 | 驗證規則 | 說明 |
|------|------|------|--------|---------|------|
| `id` | `GUID()` | 自動 | `uuid4()` | UUID 格式 | 主鍵（UUIDMixin） |
| `title` | `String(200)` | Yes | — | max 200 字元 | 任務標題 |
| `description` | `Text` | No | `null` | max 2,000 字元 | 任務描述 |
| `completed` | `Boolean` | No | `false` | — | 完成狀態 |
| `due_date` | `DateTime` | No | `null` | ISO 8601 | 到期日 |
| `priority` | `Integer` | No | `0` | 0-2（0=低, 1=中, 2=高） | 優先序 |
| `user_id` | `GUID()` | 自動 | — | FK → user.id | 所屬使用者 |
| `created_at` | `DateTime` | 自動 | `utcnow` | — | 建立時間（TimestampMixin） |
| `updated_at` | `DateTime` | 自動 | `utcnow` | — | 更新時間（TimestampMixin） |

---

## API 端點清單

| Method | Path | 說明 | 特殊邏輯 |
|--------|------|------|---------|
| `POST` | `/tasks/` | 建立任務 | priority 預設為 0 |
| `GET` | `/tasks/` | 列表（分頁） | 支援 `?completed=true/false` 過濾；預設按 `priority DESC, due_date ASC` 排序 |
| `GET` | `/tasks/{task_id}` | 取得單一任務 | 回傳包含 `is_overdue` 計算欄位 |
| `PATCH` | `/tasks/{task_id}` | 更新任務 | 僅限本人任務 |
| `DELETE` | `/tasks/{task_id}` | 刪除任務 | 僅限本人任務 |
| `PATCH` | `/tasks/batch` | 批次更新完成狀態 | 接受 `task_ids` + `completed` |

---

## 設計決策

1. **完成狀態過濾** — list endpoint 加入 `completed` query parameter。
   未指定時回傳所有任務。這與 Blog 的 `published` 過濾模式一致，
   展示不同 domain 如何複用相同的過濾模式。

2. **優先序排序** — list endpoint 預設按 `priority DESC, due_date ASC` 排序。
   高優先序任務先顯示，同優先序中到期日較早的排前面。
   選擇 integer 而非 string enum（如 low/medium/high），因為 integer 可直接用於
   SQL `ORDER BY`，不需要額外的排序映射。

3. **Priority 值域** — 使用 0-2 三個等級（0=低, 1=中, 2=高）。
   Pydantic 使用 `Field(ge=0, le=2)` 驗證，Zod 使用 `z.number().int().min(0).max(2)`。
   簡單的整數值域讓前端可以直接做排序和比較。

4. **`is_overdue` 計算欄位** — `TaskRead` schema 增加 `is_overdue` 布林欄位，
   定義為 `due_date < now and not completed`。這展示了 Pydantic 的
   `@computed_field` 或 `model_validator` 模式，資料庫不存儲此欄位。

5. **批次完成** — 額外端點 `PATCH /tasks/batch` 接受 `task_ids` 陣列和
   `completed` 布林值，一次更新多筆任務的完成狀態。
   這展示了如何在標準 CRUD 之外新增自訂端點。

---

## 與基礎模板的差異

相比 `docs/templates/domain/` 的預設 CRUD 模板，Todo 範例做了以下擴展：

- **`endpoints.py`**：list 增加 `completed` filter + `priority DESC, due_date ASC` 排序
- **`endpoints.py`**：新增 `batch_update_tasks` 端點（`PATCH /tasks/batch`）
- **`schemas.py`**：`TaskRead` 增加 `is_overdue` 計算欄位
- **`schemas.py`**：新增 `TaskBatchUpdate` schema
- **`paths.yaml`**：list 增加 `completed` query parameter；新增 `/tasks/batch` path
- **`schema.ts`**：priority 使用 `z.number().int().min(0).max(2)`
- **`schema.ts`**：新增 `taskBatchUpdateSchema`

---

## 檔案對照表

| 範例檔案 | 對應模板 | 實際路徑（部署時） |
|---------|---------|-----------------|
| `openapi/schemas.yaml` | `openapi/schemas.yaml.tmpl` | `docs/openapi/schemas/task.yaml` |
| `openapi/paths.yaml` | `openapi/paths.yaml.tmpl` | `docs/openapi/paths/tasks.yaml` |
| `server/__init__.py` | `server/__init__.py.tmpl` | `server/app/domains/tasks/__init__.py` |
| `server/models.py` | `server/models.py.tmpl` | `server/app/domains/tasks/models.py` |
| `server/schemas.py` | `server/schemas.py.tmpl` | `server/app/domains/tasks/schemas.py` |
| `server/endpoints.py` | `server/endpoints.py.tmpl` | `server/app/domains/tasks/endpoints.py` |
| `client/schema.ts` | `client/schema.ts.tmpl` | `client/src/schemas/task.ts` |
| `client/service.ts` | `client/service.ts.tmpl` | `client/src/api/services/tasks.ts` |
| `client/hooks.ts` | `client/hooks.ts.tmpl` | `client/src/hooks/useTasks.ts` |
| `client/TasksPage.tsx` | `client/page.tsx.tmpl` | `client/src/pages/tasks/TasksPage.tsx` |
| `client/Tasks.css` | `client/page.css.tmpl` | `client/src/pages/tasks/Tasks.css` |
| `tests/test_tasks.py` | `server/test_integration.py.tmpl` | `server/tests/integration/test_tasks.py` |
| `tests/TasksPage.test.tsx` | `client/page.test.tsx.tmpl` | `client/src/pages/tasks/TasksPage.test.tsx` |
| `tests/handlers.ts` | `client/handlers.ts.tmpl` | `client/src/tests/handlers/tasks.ts` |
