# E23 — Starter Domain Generator

> `/athena:domain <name>` slash command — 從零開始產生完整 domain 骨架

---

## 問題陳述

使用者透過 E21 Interactive Site Builder 移除了 Places / Portfolio 等範例 domain 後，
專案變成一個「空殼」——auth + theme + layout 齊備，但沒有任何業務 domain。
初學者面對空白的 `server/app/domains/` 和 `client/src/pages/` 目錄，不知道從何下手。

即使有經驗的開發者，手動建立一個完整 domain 也需要跨越 **10+ 個檔案**：
OpenAPI spec、SQLAlchemy model、Pydantic schemas、FastAPI endpoints、
domain registry `__init__.py`、Alembic migration、Zod schemas、React service、
React hooks、React page、MSW test handlers、integration tests。
漏掉任何一個都會導致 runtime error 或 type drift。

## 解決方案

新增 `/athena:domain <name>` slash command，接受一個 domain 名稱（例如 `notes`），
讀取 `docs/templates/domain/` 下的模板檔案，透過 template variable replacement
自動產生完整且一致的 domain 骨架。

產出結果 **完全符合 E22 domain registry 架構** 和 **SDD（Spec-Driven Development）流程**。

---

## 架構設計

### 指令格式

```
/athena:domain <name> [--fields "title:string,body:text,priority:int"]
```

- `<name>` — domain 名稱（singular, lowercase, e.g. `note`, `task`, `contact`）
- `--fields` — 可選，逗號分隔的欄位定義，格式 `field_name:type`
- 若省略 `--fields`，產生含 `name` + `description` 兩個基本欄位的骨架

### 支援的欄位類型

| 短名   | Python 型別         | SQLAlchemy      | Zod                | OpenAPI              |
|--------|---------------------|-----------------|--------------------|-----------------------|
| string | `str`               | `String(200)`   | `z.string()`       | `type: string`        |
| text   | `str \| None`       | `Text`          | `z.string()`       | `type: string`        |
| int    | `int`               | `Integer`       | `z.number().int()`  | `type: integer`       |
| float  | `float`             | `Float`         | `z.number()`       | `type: number`        |
| bool   | `bool`              | `Boolean`       | `z.boolean()`      | `type: boolean`       |
| date   | `datetime`          | `DateTime`      | `z.string()`       | `type: string, format: date-time` |
| decimal| `Decimal`           | `Numeric(12,2)` | `z.number()`       | `type: number`        |

### 命名轉換規則

給定 `name = "blog_post"`:

| 用途             | 格式              | 範例              |
|------------------|-------------------|-------------------|
| Model class      | PascalCase        | `BlogPost`        |
| Table name       | snake_plural      | `blog_posts`      |
| URL prefix       | kebab-plural      | `/blog-posts`     |
| OpenAPI tag      | kebab-plural      | `blog-posts`      |
| Domain package   | snake_plural      | `blog_posts`      |
| Schema prefix    | PascalCase        | `BlogPostCreate`  |
| Client dir       | kebab-plural      | `blog-posts`      |
| Hook name        | camelCase          | `useBlogPostsList` |
| Service name     | camelCase          | `blogPostsService` |
| Query key        | kebab-plural      | `["blog-posts"]`  |

---

## 產出檔案清單

### 1. OpenAPI Spec（SDD — 最先產生）

| 檔案 | 說明 |
|------|------|
| `docs/openapi/schemas/{{snake}}.yaml` | Create / Read / Update / Paginated schemas |
| `docs/openapi/paths/{{snake_plural}}.yaml` | collection / item CRUD endpoints |
| `docs/openapi/openapi.yaml` | 追加 paths + components/schemas $ref |

### 2. Server Domain Package

| 檔案 | 說明 |
|------|------|
| `server/app/domains/{{snake_plural}}/__init__.py` | DomainConfig + domain_config export |
| `server/app/domains/{{snake_plural}}/models.py` | SQLAlchemy model (GUID PK, user_id FK, timestamps) |
| `server/app/domains/{{snake_plural}}/schemas.py` | Pydantic Create / Read / Update schemas |
| `server/app/domains/{{snake_plural}}/endpoints.py` | CRUD + list (paginated) endpoints |

### 3. Server Tests

| 檔案 | 說明 |
|------|------|
| `server/tests/integration/test_{{snake_plural}}.py` | CRUD integration tests |

### 4. Backward-Compat Shims（與 E22 一致）

| 檔案 | 說明 |
|------|------|
| `server/app/models/{{snake}}.py` | Re-export model from domain package |
| `server/app/schemas/{{snake}}.py` | Re-export schemas from domain package |

### 5. Alembic Migration

| 動作 | 說明 |
|------|------|
| `alembic revision --autogenerate -m "add {{snake_plural}} table"` | 自動偵測 model 變更 |

### 6. Client Schemas

| 檔案 | 說明 |
|------|------|
| `client/src/schemas/{{snake}}.ts` | Zod schemas + inferred types |

### 7. Client Service

| 檔案 | 說明 |
|------|------|
| `client/src/api/services/{{snake_plural}}.ts` | `createService()` factory instance |

### 8. Client Hooks

| 檔案 | 說明 |
|------|------|
| `client/src/hooks/use{{PascalPlural}}.ts` | list / detail / create / update / delete hooks |

### 9. Client Page

| 檔案 | 說明 |
|------|------|
| `client/src/pages/{{kebab_plural}}/{{PascalPlural}}Page.tsx` | List + basic CRUD UI |
| `client/src/pages/{{kebab_plural}}/{{PascalPlural}}Page.test.tsx` | Page smoke tests |
| `client/src/pages/{{kebab_plural}}/{{PascalPlural}}.css` | Page-specific styles |

### 10. Client MSW Handlers

| 檔案 | 說明 |
|------|------|
| `client/src/tests/handlers/{{snake_plural}}.ts` | MSW request handlers + fixtures |

### 11. E21 Domain Removal Map 更新

| 檔案 | 動作 |
|------|------|
| `scripts/new-site/scaffold.ts` | 在 `DOMAIN_REMOVAL_MAP` 增加新 domain entry |

---

## 模板檔案（`docs/templates/domain/`）

```
docs/templates/domain/
  domain.config.yaml          # 模板元資料 + 變數定義
  server/
    __init__.py.tmpl          # DomainConfig
    models.py.tmpl            # SQLAlchemy model
    schemas.py.tmpl           # Pydantic schemas
    endpoints.py.tmpl         # FastAPI CRUD endpoints
    test_integration.py.tmpl  # Integration tests
    model_shim.py.tmpl        # Backward-compat model re-export
    schema_shim.py.tmpl       # Backward-compat schema re-export
  client/
    schema.ts.tmpl            # Zod schemas
    service.ts.tmpl           # createService instance
    hooks.ts.tmpl             # React Query hooks
    page.tsx.tmpl             # Page component
    page.test.tsx.tmpl        # Page tests
    page.css.tmpl             # Page styles
    handlers.ts.tmpl          # MSW handlers
  openapi/
    schemas.yaml.tmpl         # OpenAPI schema definitions
    paths.yaml.tmpl           # OpenAPI path definitions
```

### 模板變數

| 變數 | 說明 | 範例 (input: `blog_post`) |
|------|------|---------------------------|
| `{{NAME}}` | 原始輸入 | `blog_post` |
| `{{SNAKE}}` | snake_case singular | `blog_post` |
| `{{SNAKE_PLURAL}}` | snake_case plural | `blog_posts` |
| `{{PASCAL}}` | PascalCase singular | `BlogPost` |
| `{{PASCAL_PLURAL}}` | PascalCase plural | `BlogPosts` |
| `{{CAMEL}}` | camelCase singular | `blogPost` |
| `{{CAMEL_PLURAL}}` | camelCase plural | `blogPosts` |
| `{{KEBAB_PLURAL}}` | kebab-case plural | `blog-posts` |
| `{{UPPER_SNAKE}}` | UPPER_SNAKE | `BLOG_POST` |
| `{{FIELDS_BLOCK}}` | 依欄位定義展開的程式碼區塊 | 見下方 |

### 欄位展開

模板使用 `{{#FIELDS}}...{{/FIELDS}}` 區塊語法，每個欄位展開為：

```python
# models.py.tmpl — {{#FIELDS}} block
{{field_name}}: Mapped[{{python_type}}] = mapped_column({{sa_column}})
```

```typescript
// schema.ts.tmpl — {{#FIELDS}} block
{{field_name}}: {{zod_type}},
```

```yaml
# schemas.yaml.tmpl — {{#FIELDS}} block
{{field_name}}:
  type: {{openapi_type}}
```

---

## 範例組態（`docs/templates/domain/examples/`）

### blog.yaml

```yaml
name: post
fields:
  - name: title
    type: string
    required: true
    max_length: 200
  - name: body
    type: text
    required: true
    max_length: 10000
  - name: published
    type: bool
    required: false
    default: false
  - name: published_at
    type: date
    required: false
```

### todo.yaml

```yaml
name: task
fields:
  - name: title
    type: string
    required: true
    max_length: 200
  - name: description
    type: text
    required: false
    max_length: 2000
  - name: completed
    type: bool
    required: false
    default: false
  - name: due_date
    type: date
    required: false
  - name: priority
    type: int
    required: false
    default: 0
```

### crm.yaml

```yaml
name: contact
fields:
  - name: name
    type: string
    required: true
    max_length: 200
  - name: email
    type: string
    required: false
    max_length: 320
  - name: phone
    type: string
    required: false
    max_length: 20
  - name: company
    type: string
    required: false
    max_length: 200
  - name: notes
    type: text
    required: false
    max_length: 2000
```

---

## 工作流程：使用者執行 `/athena:domain notes`

### Step 1 — 解析輸入

```
Input:  /athena:domain note --fields "title:string,body:text,pinned:bool"
Parse:  name=note, fields=[{title, string}, {body, text}, {pinned, bool}]
Derive: SNAKE=note, SNAKE_PLURAL=notes, PASCAL=Note, PASCAL_PLURAL=Notes,
        CAMEL=note, CAMEL_PLURAL=notes, KEBAB_PLURAL=notes
```

### Step 2 — OpenAPI Spec（SDD — 最先）

1. 讀取 `docs/templates/domain/openapi/schemas.yaml.tmpl`
2. 替換變數 + 展開 `{{#FIELDS}}`
3. 寫入 `docs/openapi/schemas/note.yaml`
4. 同理產生 `docs/openapi/paths/notes.yaml`
5. 修改 `docs/openapi/openapi.yaml`：
   - `paths` 區塊追加 `/notes` 和 `/notes/{note_id}` 的 `$ref`
   - `tags` 區塊追加 `notes` tag
   - `components/schemas` 區塊追加 `NoteCreate`, `NoteRead`, `NoteUpdate`, `PaginatedNoteResponse` 的 `$ref`
6. 執行 `pnpm generate:types` 重新產生 `client/src/api/types.ts`

### Step 3 — Server Domain Package

1. 建立 `server/app/domains/notes/` 目錄
2. 從模板產生 `__init__.py`, `models.py`, `schemas.py`, `endpoints.py`
3. 產生 backward-compat shims：`server/app/models/note.py`, `server/app/schemas/note.py`
4. Domain registry 自動發現（無需修改 `main.py`）

### Step 4 — Alembic Migration

1. 執行 `alembic revision --autogenerate -m "add notes table"`
2. 執行 `alembic upgrade head`

### Step 5 — Server Tests

1. 產生 `server/tests/integration/test_notes.py`
2. 包含 CRUD 五個測試 + 權限測試 + 分頁測試

### Step 6 — Client Schemas + Service + Hooks

1. 產生 `client/src/schemas/note.ts`（Zod schemas + `satisfies z.ZodType<ApiType>` drift detection）
2. 產生 `client/src/api/services/notes.ts`（`createService` factory）
3. 產生 `client/src/hooks/useNotes.ts`（5 個 hooks）

### Step 7 — Client Page

1. 產生 `client/src/pages/notes/NotesPage.tsx`（list + create form）
2. 產生 `client/src/pages/notes/NotesPage.test.tsx`（smoke tests）
3. 產生 `client/src/pages/notes/Notes.css`

### Step 8 — Client MSW Handlers

1. 產生 `client/src/tests/handlers/notes.ts`

### Step 9 — 更新入口

1. 在 `scripts/new-site/scaffold.ts` 的 `DOMAIN_REMOVAL_MAP` 新增 `note` entry
2. 提示使用者手動加入 route 到 `App.tsx`（或在 Dashboard sidebar 中加入連結）

### Step 10 — 驗證

1. `cd server && uv run pytest tests/integration/test_notes.py -v`
2. `cd client && pnpm test -- --run src/pages/notes/`
3. 輸出所有產生的檔案清單

---

## SDD 合規性

本指令嚴格遵守 Spec-Driven Development 原則：

1. **OpenAPI FIRST** — 所有其他檔案都衍生自 OpenAPI spec
2. **型別一致性** — Pydantic schema、Zod schema、OpenAPI schema 三者從同一來源展開
3. **`satisfies` bridge** — Client Zod schemas 使用 `satisfies z.ZodType<ApiType>` 與 `types.ts` 做 compile-time drift detection
4. **`pnpm generate:types`** — 修改 openapi.yaml 後自動重新產生 TypeScript types

---

## 與 E22 Domain Registry 整合

### 自動發現

E22 的 `discover_domains()` 會自動掃描 `server/app/domains/` 下的所有子 package。
只要 `__init__.py` export `domain_config: DomainConfig`，domain 就會被自動註冊。

**不需要修改 `main.py`。**

### DomainConfig 結構

```python
# server/app/domains/notes/__init__.py
from app.domains import DomainConfig
from app.domains.notes.endpoints import router
from app.domains.notes.models import Note

domain_config = DomainConfig(
    router=router,
    prefix="/notes",
    tags=["notes"],
    models=[Note],
)
```

### Model 自動發現

E22 的 `server/app/models/__init__.py` 會透過 `discover_domains()` 收集所有 domain models，
確保 Alembic autogenerate 能偵測到新 model。

### Backward-Compat Shims

與 Places / Portfolios 一致，產生 re-export shim 檔案：

```python
# server/app/models/note.py
from app.domains.notes.models import Note  # noqa: F401
```

```python
# server/app/schemas/note.py
from app.domains.notes.schemas import NoteCreate, NoteRead, NoteUpdate  # noqa: F401
```

---

## Slash Command 定義

### `.claude/commands/athena/domain.md`

```markdown
---
description: "Generate a complete domain from template (E23)"
---

Read the domain generator spec at `docs/epics/e23-starter-domain-generator.md`.

Read the template files in `docs/templates/domain/`.

Parse the user's input: $ARGUMENTS

The first argument is the domain name (singular, lowercase, e.g. "note").
Optional --fields flag provides comma-separated field definitions (e.g. "title:string,body:text").

If --fields is omitted, use default fields: name (string, required) + description (text, optional).

Follow the 10-step workflow described in the spec:
1. Parse input → derive all naming variants
2. Generate OpenAPI spec FIRST (schemas + paths + update openapi.yaml)
3. Run pnpm generate:types
4. Generate server domain package (models, schemas, endpoints, __init__)
5. Generate Alembic migration
6. Generate server integration tests
7. Generate client schemas + service + hooks
8. Generate client page + tests + CSS
9. Generate client MSW handlers
10. Update scaffold.ts DOMAIN_REMOVAL_MAP + verify

Report all generated files at the end.
```

---

## 驗收標準

### 功能需求

- [ ] `/athena:domain note` 產生完整的 CRUD domain（10+ 個檔案）
- [ ] `/athena:domain note --fields "title:string,body:text"` 接受自訂欄位
- [ ] 產生的 OpenAPI spec 通過 `redocly lint` 驗證
- [ ] 產生的 server 程式碼通過 `ruff check` + `ruff format`
- [ ] 產生的 client 程式碼通過 `tsc --noEmit`
- [ ] 產生的 server tests 全部 pass
- [ ] 產生的 client tests 全部 pass
- [ ] Domain 被 `discover_domains()` 自動發現並註冊
- [ ] 刪除 domain 目錄後，`main.py` 無任何 import error

### 模板品質

- [ ] `docs/templates/domain/` 目錄包含所有模板檔案（17 個 `.tmpl` 檔）
- [ ] 三個範例組態（blog.yaml, todo.yaml, crm.yaml）驗證欄位展開正確
- [ ] 模板變數替換無遺漏（搜尋 `{{` 確認）

### SDD 合規

- [ ] OpenAPI spec 在所有其他檔案之前產生
- [ ] `pnpm generate:types` 成功執行
- [ ] Zod schemas 使用 `satisfies z.ZodType<ApiType>` bridge

### 整合

- [ ] `DOMAIN_REMOVAL_MAP` 自動更新
- [ ] Backward-compat shims 產生於正確位置
- [ ] Alembic migration 成功建立並執行

### 文件

- [ ] Slash command 定義檔 `.claude/commands/athena/domain.md` 存在
- [ ] 使用說明包含在 command description 中

---

## 實作注意事項

### Pluralization 策略

使用簡單規則（非完整英文文法）：
- 以 `s`, `x`, `z`, `sh`, `ch` 結尾 → 加 `es`
- 以 `y` 結尾且前一字元為子音 → 去 `y` 加 `ies`
- 其他 → 加 `s`

不處理不規則複數（person→people）。若需要，使用者可傳入 `--plural` 覆蓋。

### 模板引擎

不引入外部模板引擎。使用與 E21 `scaffold.ts` 相同的 `applyReplacements()` 字串替換模式，
加上 `{{#FIELDS}}...{{/FIELDS}}` 區塊展開邏輯。

模板檔案為純文字 + 佔位符，由 slash command（Claude agent）讀取並填入。
**不是** 程式化執行的 CLI 工具，而是 agent 手動讀模板 → 替換 → 寫檔。

### 端點安全

所有產生的端點預設包含：
- `@limiter.limit(settings.RATE_LIMIT_GENERAL)` — rate limiting
- `current_active_user` dependency — 認證
- `user_id` 過濾 — 資料隔離（每個使用者只看到自己的資料）

### 欄位預設值

- `id` (GUID PK) — 自動加入，不在 fields 中定義
- `user_id` (FK to User) — 自動加入
- `created_at` / `updated_at` — 自動加入（透過 `TimestampMixin`）
- 自訂欄位的 `nullable` 根據 `required` 決定

---

## 大小估算

| 項目 | 估算 |
|------|------|
| Slash command 定義 | 0.5h |
| 模板檔案（17 個） | 3h |
| 範例組態（3 個） | 0.5h |
| 整合測試 | 1h |
| 文件更新 | 0.5h |
| **合計** | **~5.5h (M)** |
