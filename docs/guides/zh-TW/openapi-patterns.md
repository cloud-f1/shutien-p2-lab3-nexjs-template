# OpenAPI 設計模式指南

> **用途**：學習本專案 OpenAPI 的慣例與設計模式，快速產出符合規範的 API spec。
> **SDD 流程**：永遠先編輯 `docs/openapi/` → 再寫 server → 最後寫 client（見 `CLAUDE.md`）。
> **預估閱讀時間**：~20 分鐘
> **前置知識**：基本 OpenAPI 3.1 語法

---

## 目錄

1. [專案 OpenAPI 架構總覽](#1-專案-openapi-架構總覽)
2. [模式一：基本 CRUD（Basic CRUD）](#2-模式一基本-crudbasic-crud)
3. [模式二：分頁列表 + 篩選（Paginated List with Filters）](#3-模式二分頁列表--篩選paginated-list-with-filters)
4. [模式三：巢狀資源（Nested Resources）](#4-模式三巢狀資源nested-resources)
5. [模式四：檔案上傳（File Upload）](#5-模式四檔案上傳file-upload)
6. [常見陷阱與最佳實踐](#6-常見陷阱與最佳實踐)
7. [延伸閱讀](#7-延伸閱讀)

---

## 1. 專案 OpenAPI 架構總覽

### 檔案結構

```
docs/openapi/
├── openapi.yaml          # 入口檔案 — 定義 paths + components refs
├── paths/
│   ├── auth.yaml         # 認證相關 path
│   ├── places.yaml       # Places CRUD + nearby
│   ├── portfolios.yaml   # Portfolios CRUD + 巢狀 places
│   └── health.yaml       # 健康檢查
└── schemas/
    ├── common.yaml       # 共用元件：ErrorDetail、Unauthorized、ValidationError
    ├── place.yaml        # PlaceCreate / PlaceRead / PlaceUpdate / PaginatedPlaceResponse
    ├── portfolio.yaml    # Portfolio schemas + PortfolioPlace schemas
    └── auth.yaml         # UserRead / UserCreate / BearerResponse
```

### `$ref` 引用慣例

- **入口 → paths**：`$ref: 'paths/places.yaml#/collection'`
- **paths → schemas**：`$ref: '../schemas/place.yaml#/PlaceRead'`
- **schema 內部交叉引用**：`$ref: '#/PlaceRead'`（同檔案）或 `$ref: './place.yaml#/PlaceRead'`（跨檔案）
- **共用錯誤回應**：`$ref: '../schemas/common.yaml#/responses/Unauthorized'`

### 命名慣例

| 層級 | 慣例 | 範例 |
|------|------|------|
| OpenAPI operationId | camelCase | `createPlace`、`listPlaces` |
| OpenAPI schema | PascalCase + 後綴 | `PlaceCreate`、`PlaceRead`、`PlaceUpdate` |
| OpenAPI path | kebab-case 複數 | `/places`、`/portfolios` |
| Pydantic schema | PascalCase + 後綴 | `PlaceCreate`、`PlaceRead` |
| SQLAlchemy model | PascalCase 單數 | `Place`、`Portfolio` |
| React Query key | camelCase 複數 | `['places']`、`['portfolios']` |
| Zod schema | camelCase + Schema | `placeCreateSchema`、`placeReadSchema` |

---

## 2. 模式一：基本 CRUD（Basic CRUD）

### 情境說明

單一資源的建立（Create）、讀取列表（List）、讀取單筆（Get）、更新（Update）、刪除（Delete）。
這是最常見的模式，適用於大多數 domain 資源。

**參考來源**：本專案 Places domain（`docs/openapi/paths/places.yaml` + `docs/openapi/schemas/place.yaml`）

### OpenAPI YAML

以下使用 `bookmark` 作為範例 domain。

#### paths/bookmarks.yaml

```yaml
collection:
  post:
    tags: [bookmarks]
    summary: Create a bookmark
    operationId: createBookmark
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '../schemas/bookmark.yaml#/BookmarkCreate'
    responses:
      '201':
        description: Bookmark created
        content:
          application/json:
            schema:
              $ref: '../schemas/bookmark.yaml#/BookmarkRead'
      '401':
        $ref: '../schemas/common.yaml#/responses/Unauthorized'
      '422':
        $ref: '../schemas/common.yaml#/responses/ValidationError'
  get:
    tags: [bookmarks]
    summary: List current user's bookmarks (paginated)
    operationId: listBookmarks
    parameters:
      - name: page
        in: query
        schema:
          type: integer
          default: 1
          minimum: 1
      - name: page_size
        in: query
        schema:
          type: integer
          default: 20
          minimum: 1
          maximum: 100
    responses:
      '200':
        description: Paginated list of bookmarks
        content:
          application/json:
            schema:
              $ref: '../schemas/bookmark.yaml#/PaginatedBookmarkResponse'
      '401':
        $ref: '../schemas/common.yaml#/responses/Unauthorized'

item:
  get:
    tags: [bookmarks]
    summary: Get a bookmark by ID
    operationId: getBookmark
    parameters:
      - name: bookmark_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    responses:
      '200':
        description: Bookmark details
        content:
          application/json:
            schema:
              $ref: '../schemas/bookmark.yaml#/BookmarkRead'
      '401':
        $ref: '../schemas/common.yaml#/responses/Unauthorized'
      '404':
        description: Bookmark not found
  patch:
    tags: [bookmarks]
    summary: Update a bookmark
    operationId: updateBookmark
    parameters:
      - name: bookmark_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '../schemas/bookmark.yaml#/BookmarkUpdate'
    responses:
      '200':
        description: Bookmark updated
        content:
          application/json:
            schema:
              $ref: '../schemas/bookmark.yaml#/BookmarkRead'
      '401':
        $ref: '../schemas/common.yaml#/responses/Unauthorized'
      '404':
        description: Bookmark not found
      '422':
        $ref: '../schemas/common.yaml#/responses/ValidationError'
  delete:
    tags: [bookmarks]
    summary: Delete a bookmark
    operationId: deleteBookmark
    parameters:
      - name: bookmark_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    responses:
      '204':
        description: Bookmark deleted
      '401':
        $ref: '../schemas/common.yaml#/responses/Unauthorized'
      '404':
        description: Bookmark not found
```

#### schemas/bookmark.yaml

```yaml
BookmarkCreate:
  type: object
  required: [url, title]
  properties:
    url:
      type: string
      format: uri
      maxLength: 2000
    title:
      type: string
      maxLength: 200
    description:
      type: string
      maxLength: 2000
    tags:
      type: array
      items:
        type: string
        maxLength: 50
      maxItems: 10

BookmarkRead:
  type: object
  required: [id, url, title, user_id, created_at, updated_at]
  properties:
    id:
      type: string
      format: uuid
    url:
      type: string
      format: uri
    title:
      type: string
    description:
      type: ['string', 'null']
    tags:
      type: array
      items:
        type: string
    user_id:
      type: string
      format: uuid
    created_at:
      type: string
      format: date-time
    updated_at:
      type: string
      format: date-time

BookmarkUpdate:
  type: object
  properties:
    url:
      type: string
      format: uri
      maxLength: 2000
    title:
      type: string
      maxLength: 200
    description:
      type: ['string', 'null']
      maxLength: 2000
    tags:
      type: array
      items:
        type: string
        maxLength: 50
      maxItems: 10

PaginatedBookmarkResponse:
  type: object
  required: [items, total, page, page_size, pages]
  properties:
    items:
      type: array
      items:
        $ref: '#/BookmarkRead'
    total:
      type: integer
    page:
      type: integer
    page_size:
      type: integer
    pages:
      type: integer
```

### 四層對照表

| OpenAPI | Pydantic | SQLAlchemy | React Query / Zod |
|---------|----------|------------|-------------------|
| `BookmarkCreate` | `class BookmarkCreate(BaseModel)` | -- | `bookmarkCreateSchema` |
| `BookmarkRead` | `class BookmarkRead(BaseModel)` | `class Bookmark(Base, UUIDMixin, TimestampMixin)` | `bookmarkReadSchema` |
| `BookmarkUpdate` | `class BookmarkUpdate(BaseModel)` | -- | `bookmarkUpdateSchema` |
| `POST /bookmarks` | `async def create_bookmark()` | `db.add(bookmark)` | `useBookmarkCreate()` |
| `GET /bookmarks` | `async def list_bookmarks()` | `select(Bookmark).where(...)` | `useBookmarksList()` |
| `GET /bookmarks/{id}` | `async def get_bookmark()` | `db.execute(select(...).where(...))` | `useBookmarkDetail(id)` |
| `PATCH /bookmarks/{id}` | `async def update_bookmark()` | `setattr(bookmark, key, value)` | `useBookmarkUpdate()` |
| `DELETE /bookmarks/{id}` | `async def delete_bookmark()` | `await db.delete(bookmark)` | `useBookmarkDelete()` |

### Pydantic Schema

```python
"""Bookmark schemas for API request/response validation."""

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class BookmarkCreate(BaseModel):
    url: str = Field(max_length=2000)
    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    tags: list[str] = Field(default_factory=list, max_length=10)


class BookmarkRead(BaseModel):
    id: uuid.UUID
    url: str
    title: str
    description: str | None
    tags: list[str]
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BookmarkUpdate(BaseModel):
    url: str | None = Field(default=None, max_length=2000)
    title: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    tags: list[str] | None = Field(default=None, max_length=10)
```

> **重點**：`BookmarkUpdate` 的所有欄位都是 `Optional`，不設 `required`。
> 使用 `model_dump(exclude_unset=True)` 只更新有傳入的欄位。

### SQLAlchemy Model

```python
"""Bookmark model — user-owned URL bookmark."""

import uuid

from sqlalchemy import CheckConstraint, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import GUID, Base, TimestampMixin, UUIDMixin


class Bookmark(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "bookmarks"

    url: Mapped[str] = mapped_column(String(2000))
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(String(50)), nullable=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("user.id", ondelete="CASCADE"), index=True
    )

    __table_args__ = (
        CheckConstraint("length(description) <= 2000", name="ck_bookmarks_description_len"),
    )
```

> **重點**：
> - 繼承 `UUIDMixin`（提供 `id: Mapped[uuid.UUID]` 主鍵，使用自訂 `GUID` TypeDecorator）
> - 繼承 `TimestampMixin`（提供 `created_at` + `updated_at`）
> - `user_id` 使用 `GUID()` + `ForeignKey("user.id")`，加 `index=True`
> - `maxLength` 必須與 OpenAPI spec 和 Pydantic schema 三處一致

### React Query Hook

```typescript
// src/hooks/useBookmarks.ts
import { useServiceQuery, useServiceMutation } from "./useService";
import { CACHE_TIERS } from "../cacheConfig";
import { bookmarksService } from "../api/services/bookmarks";
import type { PaginationParams } from "../schemas/common";
import type { BookmarkCreate, BookmarkUpdate } from "../schemas/bookmark";

export function useBookmarksList(params?: PaginationParams) {
  return useServiceQuery(
    ["bookmarks", params],
    () => bookmarksService.list(params),
    CACHE_TIERS.STANDARD,
  );
}

export function useBookmarkDetail(id: string) {
  return useServiceQuery(
    ["bookmarks", id],
    () => bookmarksService.getById(id),
    CACHE_TIERS.STANDARD,
    { enabled: !!id },
  );
}

export function useBookmarkCreate() {
  return useServiceMutation(
    (data: BookmarkCreate) => bookmarksService.create(data as Record<string, unknown>),
    { invalidateKeys: [["bookmarks"]] },
  );
}

export function useBookmarkUpdate() {
  return useServiceMutation(
    ({ id, data }: { id: string; data: BookmarkUpdate }) =>
      bookmarksService.update(id, data as Record<string, unknown>),
    { invalidateKeys: [["bookmarks"]] },
  );
}

export function useBookmarkDelete() {
  return useServiceMutation(
    (id: string) => bookmarksService.remove(id),
    { invalidateKeys: [["bookmarks"]] },
  );
}
```

> **重點**：
> - 使用 `createService` 工廠建立 `bookmarksService`（見下方 Service 檔案）
> - `CACHE_TIERS.STANDARD`（staleTime: 30s）— 永遠從 `cacheConfig.ts` 匯入，不內聯
> - mutation 完成後自動失效 `["bookmarks"]` 查詢快取

#### Service 檔案

```typescript
// src/api/services/bookmarks.ts
import { createService } from "./createService";
import { bookmarkReadSchema } from "../../schemas/bookmark";

export const bookmarksService = createService("/bookmarks", bookmarkReadSchema);
```

### Zod Schema

```typescript
// src/schemas/bookmark.ts
import { z } from "zod";
import type { components } from "../api/types"; // openapi-typescript 自動產生

type ApiBookmarkCreate = components["schemas"]["BookmarkCreate"];
type ApiBookmarkRead = components["schemas"]["BookmarkRead"];
type ApiBookmarkUpdate = components["schemas"]["BookmarkUpdate"];

export const bookmarkCreateSchema = z.object({
  url: z.string().url().max(2000),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
}) satisfies z.ZodType<ApiBookmarkCreate>;

export const bookmarkReadSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  tags: z.array(z.string()),
  user_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
}) satisfies z.ZodType<ApiBookmarkRead>;

export const bookmarkUpdateSchema = z.object({
  url: z.string().url().max(2000).optional(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
}) satisfies z.ZodType<ApiBookmarkUpdate>;

export type BookmarkCreate = z.infer<typeof bookmarkCreateSchema>;
export type BookmarkRead = z.infer<typeof bookmarkReadSchema>;
export type BookmarkUpdate = z.infer<typeof bookmarkUpdateSchema>;
```

> **重點**：
> - `satisfies z.ZodType<ApiType>` — 編譯期漂移偵測（Compile-time Drift Detection），當 OpenAPI 產生的型別與 Zod schema 不一致時會報錯
> - `z.string().uuid()` 對應 OpenAPI 的 `format: uuid`
> - `z.string().nullable()` 對應 OpenAPI 的 `type: ['string', 'null']`
> - 型別一律透過 `z.infer<>` 衍生，不手寫重複的 TypeScript interface

---

## 3. 模式二：分頁列表 + 篩選（Paginated List with Filters）

### 情境說明

當資料量大時，需要分頁回傳並支援欄位篩選與排序。
這是模式一中 `GET /resources` 的進階版本。

**參考來源**：Places `listPlaces`（`page` / `page_size` 參數）

### OpenAPI YAML

以下展示帶有搜尋、篩選、排序的完整分頁端點：

```yaml
# 在 paths/bookmarks.yaml 的 collection.get 中擴展
get:
  tags: [bookmarks]
  summary: List bookmarks with filtering and sorting
  operationId: listBookmarks
  parameters:
    - name: page
      in: query
      schema:
        type: integer
        default: 1
        minimum: 1
    - name: page_size
      in: query
      schema:
        type: integer
        default: 20
        minimum: 1
        maximum: 100
    - name: search
      in: query
      description: 模糊搜尋 title 和 description
      schema:
        type: string
        maxLength: 200
    - name: sort_by
      in: query
      description: 排序欄位
      schema:
        type: string
        enum: [created_at, updated_at, title]
        default: created_at
    - name: sort_order
      in: query
      description: 排序方向
      schema:
        type: string
        enum: [asc, desc]
        default: desc
    - name: category
      in: query
      description: 依分類精確篩選
      schema:
        type: string
  responses:
    '200':
      description: Paginated list of bookmarks
      content:
        application/json:
          schema:
            $ref: '../schemas/bookmark.yaml#/PaginatedBookmarkResponse'
    '401':
      $ref: '../schemas/common.yaml#/responses/Unauthorized'
```

### PaginatedResponse Schema

分頁回應結構在本專案中已標準化（見 `schemas/common.yaml` 的用法）：

```yaml
PaginatedBookmarkResponse:
  type: object
  required: [items, total, page, page_size, pages]
  properties:
    items:
      type: array
      items:
        $ref: '#/BookmarkRead'
    total:
      type: integer
      description: 符合篩選條件的資料總筆數
    page:
      type: integer
      description: 目前頁碼
    page_size:
      type: integer
      description: 每頁筆數
    pages:
      type: integer
      description: 總頁數
```

### 四層對照

| OpenAPI | Pydantic | SQLAlchemy | React Query |
|---------|----------|------------|-------------|
| `page` query param | `page: int = Query(1, ge=1)` | `.offset((page - 1) * page_size)` | queryKey 包含 `params` |
| `page_size` query param | `page_size: int = Query(20, ge=1, le=100)` | `.limit(page_size)` | queryKey 包含 `params` |
| `search` query param | `search: str \| None = Query(None)` | `.where(Model.title.ilike(...))` | queryKey 包含 `params` |
| `sort_by` query param | `sort_by: str = Query("created_at")` | `.order_by(getattr(Model, sort_by))` | queryKey 包含 `params` |
| `sort_order` query param | `sort_order: str = Query("desc")` | `.desc()` / `.asc()` | queryKey 包含 `params` |
| `PaginatedBookmarkResponse` | `dict` with items/total/page/... | `func.count()` + `select()` | `PaginatedResponse<T>` |

### Pydantic + Endpoint 完整範例

```python
"""帶篩選與排序的分頁列表端點。"""

import logging
from enum import Enum

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_active_user
from app.core.config import settings
from app.core.limiter import limiter
from app.db.session import get_db
from app.domains.bookmarks.models import Bookmark
from app.domains.bookmarks.schemas import BookmarkRead
from app.models.user import User

logger = logging.getLogger(__name__)
router = APIRouter()


class BookmarkSortBy(str, Enum):
    created_at = "created_at"
    updated_at = "updated_at"
    title = "title"


class SortOrder(str, Enum):
    asc = "asc"
    desc = "desc"


@router.get("/")
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def list_bookmarks(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, max_length=200),
    sort_by: BookmarkSortBy = Query(BookmarkSortBy.created_at),
    sort_order: SortOrder = Query(SortOrder.desc),
    category: str | None = Query(None),
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    # 基礎查詢：只看自己的資料
    base = select(Bookmark).where(Bookmark.user_id == user.id)

    # 篩選
    if search:
        base = base.where(
            Bookmark.title.ilike(f"%{search}%")
            | Bookmark.description.ilike(f"%{search}%")
        )
    if category:
        base = base.where(Bookmark.category == category)

    # 計算總筆數
    total_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_result.scalar() or 0

    # 排序 + 分頁
    sort_col = getattr(Bookmark, sort_by.value)
    order = sort_col.desc() if sort_order == SortOrder.desc else sort_col.asc()
    result = await db.execute(
        base.order_by(order).offset((page - 1) * page_size).limit(page_size)
    )
    items = [BookmarkRead.model_validate(b) for b in result.scalars().all()]

    pages = (total + page_size - 1) // page_size if total > 0 else 0
    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": pages,
    }
```

### React Query Hook（帶篩選參數）

```typescript
// src/hooks/useBookmarks.ts（擴展版）
import { useServiceQuery } from "./useService";
import { CACHE_TIERS } from "../cacheConfig";
import { bookmarksService } from "../api/services/bookmarks";

interface BookmarkListParams {
  page?: number;
  page_size?: number;
  search?: string;
  sort_by?: "created_at" | "updated_at" | "title";
  sort_order?: "asc" | "desc";
  category?: string;
}

export function useBookmarksList(params?: BookmarkListParams) {
  return useServiceQuery(
    ["bookmarks", params],   // params 變化時自動重新查詢
    () => bookmarksService.list(params as Record<string, unknown>),
    CACHE_TIERS.STANDARD,
  );
}
```

> **重點**：queryKey 必須包含所有篩選參數，這樣參數變化時 React Query 會自動觸發重新查詢。
> `CACHE_TIERS.STANDARD`（staleTime: 30s）適合列表資料；若資料更新頻繁可改用 `REALTIME`。

---

## 4. 模式三：巢狀資源（Nested Resources）

### 情境說明

一個資源屬於另一個資源，例如 Portfolio 包含多個 Places（多對多關係）。
路徑結構為 `/parents/{parent_id}/children`。

**參考來源**：本專案 `/portfolios/{portfolio_id}/places`（`docs/openapi/paths/portfolios.yaml`）

### OpenAPI YAML

```yaml
# paths/portfolios.yaml（巢狀資源部分）

places:
  post:
    tags: [portfolios]
    summary: Add a place to a portfolio
    operationId: addPlaceToPortfolio
    parameters:
      - name: portfolio_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '../schemas/portfolio.yaml#/PortfolioPlaceCreate'
    responses:
      '201':
        description: Place added to portfolio
        content:
          application/json:
            schema:
              $ref: '../schemas/portfolio.yaml#/PortfolioPlaceRead'
      '401':
        $ref: '../schemas/common.yaml#/responses/Unauthorized'
      '404':
        description: Portfolio or place not found
      '409':
        description: Place already in portfolio
        content:
          application/json:
            schema:
              $ref: '../schemas/common.yaml#/ErrorDetail'
            example:
              detail: PLACE_ALREADY_IN_PORTFOLIO
      '422':
        $ref: '../schemas/common.yaml#/responses/ValidationError'
  get:
    tags: [portfolios]
    summary: List places in a portfolio
    operationId: listPortfolioPlaces
    parameters:
      - name: portfolio_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    responses:
      '200':
        description: Places in portfolio with investment data
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: '../schemas/portfolio.yaml#/PortfolioPlaceRead'
      '401':
        $ref: '../schemas/common.yaml#/responses/Unauthorized'
      '404':
        description: Portfolio not found

place-item:
  patch:
    tags: [portfolios]
    summary: Update place investment data in portfolio
    operationId: updatePortfolioPlace
    parameters:
      - name: portfolio_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
      - name: place_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    requestBody:
      required: true
      content:
        application/json:
          schema:
            $ref: '../schemas/portfolio.yaml#/PortfolioPlaceUpdate'
    responses:
      '200':
        description: Portfolio place updated
        content:
          application/json:
            schema:
              $ref: '../schemas/portfolio.yaml#/PortfolioPlaceRead'
      '401':
        $ref: '../schemas/common.yaml#/responses/Unauthorized'
      '404':
        description: Portfolio or place membership not found
      '422':
        $ref: '../schemas/common.yaml#/responses/ValidationError'
  delete:
    tags: [portfolios]
    summary: Remove a place from a portfolio
    operationId: removePortfolioPlace
    parameters:
      - name: portfolio_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
      - name: place_id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    responses:
      '204':
        description: Place removed from portfolio
      '401':
        $ref: '../schemas/common.yaml#/responses/Unauthorized'
      '404':
        description: Portfolio or place membership not found
```

### Schema 設計

巢狀資源的 schema 設計有兩個關鍵差異：

1. **Create schema 包含子資源 ID**（而非完整的子資源建立資料）
2. **Read schema 嵌入子資源的完整資料**（避免 N+1 查詢）

```yaml
PortfolioPlaceCreate:
  type: object
  required: [place_id]
  properties:
    place_id:
      type: string
      format: uuid
    purchase_price:
      type: string
      format: decimal
      pattern: '^\d{1,10}(\.\d{1,2})?$'
      default: '0.00'
    current_value:
      type: string
      format: decimal
      pattern: '^\d{1,10}(\.\d{1,2})?$'
      default: '0.00'
    notes:
      type: string
      maxLength: 1000

PortfolioPlaceRead:
  type: object
  required: [portfolio_id, place_id, purchase_price, current_value, added_at, place]
  properties:
    portfolio_id:
      type: string
      format: uuid
    place_id:
      type: string
      format: uuid
    purchase_price:
      type: string
      format: decimal
    current_value:
      type: string
      format: decimal
    gain_loss:
      type: string
      format: decimal
      description: current_value - purchase_price
    notes:
      type: ['string', 'null']
    added_at:
      type: string
      format: date-time
    place:
      $ref: './place.yaml#/PlaceRead'
      description: Embedded place data

PortfolioPlaceUpdate:
  type: object
  properties:
    purchase_price:
      type: string
      format: decimal
      pattern: '^\d{1,10}(\.\d{1,2})?$'
    current_value:
      type: string
      format: decimal
      pattern: '^\d{1,10}(\.\d{1,2})?$'
    notes:
      type: ['string', 'null']
      maxLength: 1000
```

### 四層對照

| OpenAPI | Pydantic | SQLAlchemy | React Query |
|---------|----------|------------|-------------|
| `PortfolioPlaceCreate` | `class PortfolioPlaceCreate(BaseModel)` | -- | `portfolioPlaceCreateSchema` |
| `PortfolioPlaceRead` | `class PortfolioPlaceRead(BaseModel)` | `class PortfolioPlace(Base)` | `portfolioPlaceReadSchema` |
| `PortfolioPlaceUpdate` | `class PortfolioPlaceUpdate(BaseModel)` | -- | `portfolioPlaceUpdateSchema` |
| `POST /portfolios/{id}/places` | `async def add_place_to_portfolio()` | `db.add(pp)` | `useAddPlaceToPortfolio()` |
| `GET /portfolios/{id}/places` | `async def list_portfolio_places()` | `select(...).where(...)` | `usePortfolioPlaces(portfolioId)` |
| `PATCH .../places/{place_id}` | `async def update_portfolio_place()` | `setattr(pp, k, v)` | `useUpdatePortfolioPlace()` |
| `DELETE .../places/{place_id}` | `async def remove_portfolio_place()` | `await db.delete(pp)` | `useRemovePortfolioPlace()` |

### Association Table（SQLAlchemy）

多對多關係使用 association table，可在關聯上附加額外欄位（如 `notes`、`purchase_price`）：

```python
"""PortfolioPlace — association table with extra columns."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Numeric, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import GUID, Base


class PortfolioPlace(Base):
    __tablename__ = "portfolio_places"

    # 複合主鍵
    portfolio_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("portfolios.id", ondelete="CASCADE"), primary_key=True
    )
    place_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("places.id", ondelete="CASCADE"), primary_key=True
    )

    # 額外欄位（association table 的優勢）
    purchase_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    current_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # 關聯
    portfolio: Mapped["Portfolio"] = relationship(back_populates="portfolio_places")
    place: Mapped["Place"] = relationship(lazy="joined")  # eager load 子資源

    __table_args__ = (
        Index("ix_portfolio_places_place_id", "place_id"),
        CheckConstraint("length(notes) <= 1000", name="ck_portfolio_places_notes_len"),
        CheckConstraint("purchase_price >= 0", name="ck_portfolio_places_purchase_price_min"),
        CheckConstraint(
            "purchase_price <= 9999999999.99", name="ck_portfolio_places_purchase_price_max"
        ),
        CheckConstraint("current_value >= 0", name="ck_portfolio_places_current_value_min"),
        CheckConstraint(
            "current_value <= 9999999999.99", name="ck_portfolio_places_current_value_max"
        ),
    )
```

> **重點**：
> - 複合主鍵（`portfolio_id` + `place_id`）確保唯一性，省去額外的 `id` 欄位
> - `lazy="joined"` 在 `place` 關聯上，避免 N+1 查詢
> - `CheckConstraint` 用於資料庫層級的驗證（與 Pydantic 雙重保護）
> - `ondelete="CASCADE"` 確保父資源刪除時自動清理

### Pydantic Schema

```python
"""PortfolioPlace schemas — 巢狀資源的 Pydantic 定義。"""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field, PlainSerializer

from app.domains.places.schemas import PlaceRead

# Decimal 序列化為字串（保留兩位小數）
DecimalStr = Annotated[
    Decimal,
    PlainSerializer(lambda v: str(v.quantize(Decimal("0.01"))), return_type=str),
]

_MAX_MONETARY = Decimal("9999999999.99")


class PortfolioPlaceCreate(BaseModel):
    place_id: uuid.UUID
    purchase_price: Decimal = Field(
        default=Decimal("0.00"), ge=0, le=_MAX_MONETARY, decimal_places=2
    )
    current_value: Decimal = Field(
        default=Decimal("0.00"), ge=0, le=_MAX_MONETARY, decimal_places=2
    )
    notes: str | None = Field(default=None, max_length=1000)


class PortfolioPlaceRead(BaseModel):
    portfolio_id: uuid.UUID
    place_id: uuid.UUID
    purchase_price: DecimalStr
    current_value: DecimalStr
    gain_loss: DecimalStr
    notes: str | None
    added_at: datetime
    place: PlaceRead   # 嵌入完整的子資源資料

    model_config = {"from_attributes": True}


class PortfolioPlaceUpdate(BaseModel):
    purchase_price: Decimal | None = Field(default=None, ge=0, le=_MAX_MONETARY, decimal_places=2)
    current_value: Decimal | None = Field(default=None, ge=0, le=_MAX_MONETARY, decimal_places=2)
    notes: str | None = Field(default=None, max_length=1000)
```

### React Query Hook

```typescript
// src/hooks/usePortfolioPlaces.ts
import { useServiceQuery, useServiceMutation } from "./useService";
import { CACHE_TIERS } from "../cacheConfig";
import { apiClient } from "../api/client";
import { portfolioPlaceReadSchema } from "../schemas/portfolio";

export function usePortfolioPlaces(portfolioId: string) {
  return useServiceQuery(
    ["portfolios", portfolioId, "places"],   // 巢狀 queryKey
    async () => {
      const res = await apiClient.get(`/portfolios/${portfolioId}/places`);
      return portfolioPlaceReadSchema.array().parse(res.data);
    },
    CACHE_TIERS.STANDARD,
    { enabled: !!portfolioId },
  );
}

export function useAddPlaceToPortfolio(portfolioId: string) {
  return useServiceMutation(
    async (data: { place_id: string; purchase_price?: string; notes?: string }) => {
      const res = await apiClient.post(`/portfolios/${portfolioId}/places`, data);
      return portfolioPlaceReadSchema.parse(res.data);
    },
    { invalidateKeys: [["portfolios", portfolioId, "places"], ["portfolios"]] },
  );
}

export function useRemovePortfolioPlace(portfolioId: string) {
  return useServiceMutation(
    async (placeId: string) => {
      await apiClient.delete(`/portfolios/${portfolioId}/places/${placeId}`);
    },
    { invalidateKeys: [["portfolios", portfolioId, "places"], ["portfolios"]] },
  );
}
```

> **重點**：
> - queryKey 包含 `portfolioId`：`["portfolios", portfolioId, "places"]`
> - 失效時同時清除父資源快取 `["portfolios"]`（因為父資源可能顯示 `place_count`）
> - 巢狀路徑無法用 `createService` 工廠，需手動寫 `apiClient` 呼叫

---

## 5. 模式四：檔案上傳（File Upload）

### 情境說明

使用者上傳圖片或文件。本專案目前無此功能，但提供標準模式供未來擴展。

### OpenAPI YAML

```yaml
# paths/attachments.yaml

upload:
  post:
    tags: [attachments]
    summary: Upload a file
    operationId: uploadAttachment
    requestBody:
      required: true
      content:
        multipart/form-data:
          schema:
            type: object
            required: [file]
            properties:
              file:
                type: string
                format: binary
                description: 上傳的檔案（最大 10MB）
              description:
                type: string
                maxLength: 500
          encoding:
            file:
              contentType: image/png, image/jpeg, application/pdf
    responses:
      '201':
        description: File uploaded
        content:
          application/json:
            schema:
              $ref: '../schemas/attachment.yaml#/AttachmentRead'
      '401':
        $ref: '../schemas/common.yaml#/responses/Unauthorized'
      '413':
        description: File too large
      '415':
        description: Unsupported media type
      '422':
        $ref: '../schemas/common.yaml#/responses/ValidationError'
```

#### schemas/attachment.yaml

```yaml
AttachmentRead:
  type: object
  required: [id, file_url, file_name, file_size, mime_type, user_id, created_at]
  properties:
    id:
      type: string
      format: uuid
    file_url:
      type: string
      format: uri
      description: 可公開存取的檔案 URL
    file_name:
      type: string
    file_size:
      type: integer
      description: 檔案大小（bytes）
    mime_type:
      type: string
      description: MIME 類型（如 image/png）
    description:
      type: ['string', 'null']
    user_id:
      type: string
      format: uuid
    created_at:
      type: string
      format: date-time
```

### 四層對照

| OpenAPI | Pydantic | SQLAlchemy | React Query |
|---------|----------|------------|-------------|
| `multipart/form-data` | `UploadFile` type hint | -- | `FormData` |
| `format: binary` | `file: UploadFile` | -- | `formData.append("file", file)` |
| `AttachmentRead` | `class AttachmentRead(BaseModel)` | `class Attachment(Base, UUIDMixin)` | `attachmentReadSchema` |
| `POST /attachments` | `async def upload_attachment()` | `db.add(attachment)` | `useUploadAttachment()` |

### Pydantic + Endpoint 範例

```python
"""Attachment upload endpoint."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_active_user
from app.core.config import settings
from app.core.limiter import limiter
from app.db.session import get_db
from app.models.user import User

router = APIRouter()

ALLOWED_MIME_TYPES = {"image/png", "image/jpeg", "application/pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


class AttachmentRead(BaseModel):
    id: uuid.UUID
    file_url: str
    file_name: str
    file_size: int
    mime_type: str
    description: str | None
    user_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}


@router.post("/", response_model=AttachmentRead, status_code=201)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def upload_attachment(
    request: Request,
    file: UploadFile,
    description: str | None = None,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
):
    # MIME type 驗證
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=415, detail="UNSUPPORTED_MEDIA_TYPE")

    # 檔案大小驗證
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="FILE_TOO_LARGE")

    # 儲存到 storage backend（此處以本地檔案系統為範例）
    file_id = uuid.uuid4()
    file_path = f"uploads/{file_id}_{file.filename}"
    # 實際專案中應使用 S3 / GCS 等雲端儲存
    with open(file_path, "wb") as f:
        f.write(contents)

    file_url = f"/static/{file_path}"

    # 存入資料庫（僅儲存 URL，不存 binary）
    attachment = Attachment(
        id=file_id,
        file_url=file_url,
        file_name=file.filename or "unnamed",
        file_size=len(contents),
        mime_type=file.content_type or "application/octet-stream",
        description=description,
        user_id=user.id,
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)
    return attachment
```

### SQLAlchemy Model

```python
"""Attachment model — file metadata (URL stored, not binary)."""

import uuid

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import GUID, Base, TimestampMixin, UUIDMixin


class Attachment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "attachments"

    file_url: Mapped[str] = mapped_column(String(2000))
    file_name: Mapped[str] = mapped_column(String(500))
    file_size: Mapped[int] = mapped_column(Integer)
    mime_type: Mapped[str] = mapped_column(String(100))
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("user.id", ondelete="CASCADE"), index=True
    )
```

> **重點**：SQLAlchemy 只儲存檔案的 URL / metadata，不在資料庫中存 binary 資料。

### React Query Hook

```typescript
// src/hooks/useAttachments.ts
import { useServiceMutation } from "./useService";
import { apiClient } from "../api/client";
import { attachmentReadSchema } from "../schemas/attachment";

export function useUploadAttachment() {
  return useServiceMutation(
    async ({ file, description }: { file: File; description?: string }) => {
      const formData = new FormData();
      formData.append("file", file);
      if (description) formData.append("description", description);

      const res = await apiClient.post("/attachments", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return attachmentReadSchema.parse(res.data);
    },
    { invalidateKeys: [["attachments"]] },
  );
}
```

> **注意事項**：
> - 前端使用 `FormData` 而非 JSON body
> - 需設定 `Content-Type: multipart/form-data`（Axios 會自動處理 boundary）
> - 檔案大小限制應同時在前後端驗證
> - 生產環境建議使用 presigned URL 直傳雲端儲存

---

## 6. 常見陷阱與最佳實踐

### nullable 欄位

OpenAPI 3.1 使用 `type` 陣列表達 nullable：

```yaml
# 正確 (OpenAPI 3.1)
description:
  type: ['string', 'null']
  maxLength: 2000

# 錯誤 — 這是 OpenAPI 3.0 語法
description:
  type: string
  nullable: true
```

對應 Pydantic：`str | None`；對應 Zod：`z.string().nullable()`。

### UUID 格式

三層必須一致：

```yaml
# OpenAPI
id:
  type: string
  format: uuid
```

```python
# Pydantic
id: uuid.UUID
```

```typescript
// Zod
id: z.string().uuid()
```

### Decimal 金額欄位

使用 `type: string` + `format: decimal` + `pattern` 約束，避免浮點數精度問題：

```yaml
# OpenAPI
purchase_price:
  type: string
  format: decimal
  pattern: '^\d{1,10}(\.\d{1,2})?$'
```

```python
# Pydantic — 使用 DecimalStr 自訂序列化
from decimal import Decimal
from typing import Annotated
from pydantic import PlainSerializer

DecimalStr = Annotated[
    Decimal,
    PlainSerializer(lambda v: str(v.quantize(Decimal("0.01"))), return_type=str),
]
```

```python
# SQLAlchemy
from sqlalchemy import Numeric
purchase_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
```

### maxLength 三處對齊

OpenAPI、Pydantic、SQLAlchemy 的長度限制必須一致，否則會出現：
- 前端驗證通過但後端拒絕
- 後端驗證通過但資料庫截斷

```yaml
# OpenAPI
name:
  type: string
  maxLength: 200
```

```python
# Pydantic
name: str = Field(max_length=200)
```

```python
# SQLAlchemy
name: Mapped[str] = mapped_column(String(200))
```

### Update Schema 全 optional

`Update` schema 不設 `required`，所有欄位都是 optional。搭配 `model_dump(exclude_unset=True)` 只更新有傳入的欄位：

```python
class BookmarkUpdate(BaseModel):
    url: str | None = Field(default=None, max_length=2000)
    title: str | None = Field(default=None, max_length=200)
    # ... 全部都是 Optional

# 在 endpoint 中
update_data = body.model_dump(exclude_unset=True)
for key, value in update_data.items():
    setattr(bookmark, key, value)
```

### 錯誤回應一律引用 common.yaml

避免重複定義錯誤回應 schema：

```yaml
# 正確 — 引用共用定義
'401':
  $ref: '../schemas/common.yaml#/responses/Unauthorized'
'422':
  $ref: '../schemas/common.yaml#/responses/ValidationError'

# 錯誤 — 重複定義
'401':
  description: Unauthorized
  content:
    application/json:
      schema:
        type: object
        properties:
          detail:
            type: string
```

### operationId 唯一性

`operationId` 在所有 path files 中不可重複。建議的命名規則：

| 操作 | 命名模式 | 範例 |
|------|---------|------|
| 建立 | `create{Resource}` | `createBookmark` |
| 列表 | `list{Resources}` | `listBookmarks` |
| 取得 | `get{Resource}` | `getBookmark` |
| 更新 | `update{Resource}` | `updateBookmark` |
| 刪除 | `delete{Resource}` | `deleteBookmark` |
| 巢狀新增 | `add{Child}To{Parent}` | `addPlaceToPortfolio` |
| 巢狀列表 | `list{Parent}{Children}` | `listPortfolioPlaces` |
| 巢狀移除 | `remove{Parent}{Child}` | `removePortfolioPlace` |

---

## 7. 延伸閱讀

- `docs/openapi/openapi.yaml` — 入口檔案
- `docs/openapi/paths/` — 所有 path 定義
- `docs/openapi/schemas/` — 所有 schema 定義
- `docs/templates/openapi/crud.yaml` — 填空 CRUD 模板（本指南的姊妹檔）
- `docs/templates/domain/` — E23 domain generator 模板（機器可讀版本）
- `docs/guides/quickstart.md` — 快速入門（E24）
- `docs/guides/first-epic-walkthrough.md` — 第一個 Epic 實戰（E24）

---

## 下一步

- **[第一個 Epic 實戰](first-epic-walkthrough.md)** — 動手實踐這些模式，建立完整的 Domain
- **[CI 流程說明](ci-explained.md)** — 了解 CI 如何驗證你的 OpenAPI 規格與產生的型別
- **[建立領域專家 Agent](custom-agents.md)** — 為你的業務領域建立 AI 顧問
- **[學習路徑](learning-path.md)** — 查看所有指南的推薦閱讀順序
