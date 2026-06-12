# OpenAPI Design Patterns Guide

> **Purpose**: Learn the OpenAPI conventions and design patterns used in this project to quickly produce spec-compliant API definitions.
> **SDD Workflow**: Always edit `docs/openapi/` first -> then server -> finally client (see `CLAUDE.md`).
> **Estimated reading time**: ~20 minutes
> **Prerequisites**: Basic OpenAPI 3.1 syntax

---

## Table of Contents

1. [Project OpenAPI Architecture Overview](#1-project-openapi-architecture-overview)
2. [Pattern 1: Basic CRUD](#2-pattern-1-basic-crud)
3. [Pattern 2: Paginated List with Filters](#3-pattern-2-paginated-list-with-filters)
4. [Pattern 3: Nested Resources](#4-pattern-3-nested-resources)
5. [Pattern 4: File Upload](#5-pattern-4-file-upload)
6. [Common Pitfalls and Best Practices](#6-common-pitfalls-and-best-practices)
7. [Further Reading](#7-further-reading)

---

## 1. Project OpenAPI Architecture Overview

### File Structure

```
docs/openapi/
├── openapi.yaml          # Entry file — defines paths + components refs
├── paths/
│   ├── auth.yaml         # Authentication paths
│   ├── places.yaml       # Places CRUD + nearby
│   ├── portfolios.yaml   # Portfolios CRUD + nested places
│   └── health.yaml       # Health check
└── schemas/
    ├── common.yaml       # Shared components: ErrorDetail, Unauthorized, ValidationError
    ├── place.yaml        # PlaceCreate / PlaceRead / PlaceUpdate / PaginatedPlaceResponse
    ├── portfolio.yaml    # Portfolio schemas + PortfolioPlace schemas
    └── auth.yaml         # UserRead / UserCreate / BearerResponse
```

### `$ref` Reference Conventions

- **Entry -> paths**: `$ref: 'paths/places.yaml#/collection'`
- **paths -> schemas**: `$ref: '../schemas/place.yaml#/PlaceRead'`
- **Internal cross-references**: `$ref: '#/PlaceRead'` (same file) or `$ref: './place.yaml#/PlaceRead'` (cross-file)
- **Shared error responses**: `$ref: '../schemas/common.yaml#/responses/Unauthorized'`

### Naming Conventions

| Level | Convention | Example |
|-------|-----------|---------|
| OpenAPI operationId | camelCase | `createPlace`, `listPlaces` |
| OpenAPI schema | PascalCase + suffix | `PlaceCreate`, `PlaceRead`, `PlaceUpdate` |
| OpenAPI path | kebab-case plural | `/places`, `/portfolios` |
| Pydantic schema | PascalCase + suffix | `PlaceCreate`, `PlaceRead` |
| SQLAlchemy model | PascalCase singular | `Place`, `Portfolio` |
| React Query key | camelCase plural | `['places']`, `['portfolios']` |
| Zod schema | camelCase + Schema | `placeCreateSchema`, `placeReadSchema` |

---

## 2. Pattern 1: Basic CRUD

### Scenario

Single resource Create, List, Get, Update, Delete.
This is the most common pattern, applicable to most domain resources.

**Reference**: This project's Places domain (`docs/openapi/paths/places.yaml` + `docs/openapi/schemas/place.yaml`)

### OpenAPI YAML

Using `bookmark` as an example domain.

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

### Four-Layer Mapping Table

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

> **Key Point**: All fields in `BookmarkUpdate` are `Optional`, with no `required` set.
> Use `model_dump(exclude_unset=True)` to only update fields that were actually sent.

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

> **Key Points**:
> - Inherits `UUIDMixin` (provides `id: Mapped[uuid.UUID]` primary key using the custom `GUID` TypeDecorator)
> - Inherits `TimestampMixin` (provides `created_at` + `updated_at`)
> - `user_id` uses `GUID()` + `ForeignKey("user.id")` with `index=True`
> - `maxLength` must be consistent across OpenAPI spec, Pydantic schema, and SQLAlchemy model

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

> **Key Points**:
> - Uses the `createService` factory to create `bookmarksService` (see Service file below)
> - `CACHE_TIERS.STANDARD` (staleTime: 30s) — always import from `cacheConfig.ts`, never inline
> - Mutations automatically invalidate the `["bookmarks"]` query cache on completion

#### Service File

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
import type { components } from "../api/types"; // auto-generated by openapi-typescript

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

> **Key Points**:
> - `satisfies z.ZodType<ApiType>` — Compile-time Drift Detection. Throws an error when the OpenAPI-generated type and Zod schema are inconsistent
> - `z.string().uuid()` corresponds to OpenAPI `format: uuid`
> - `z.string().nullable()` corresponds to OpenAPI `type: ['string', 'null']`
> - Types are always derived via `z.infer<>` — never manually write duplicate TypeScript interfaces

---

## 3. Pattern 2: Paginated List with Filters

### Scenario

When data volume is large, paginated responses with field filtering and sorting are needed.
This is an advanced version of the `GET /resources` endpoint from Pattern 1.

**Reference**: Places `listPlaces` (`page` / `page_size` parameters)

### OpenAPI YAML

Below shows a complete paginated endpoint with search, filtering, and sorting:

```yaml
# Extending the collection.get in paths/bookmarks.yaml
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
      description: Fuzzy search on title and description
      schema:
        type: string
        maxLength: 200
    - name: sort_by
      in: query
      description: Sort field
      schema:
        type: string
        enum: [created_at, updated_at, title]
        default: created_at
    - name: sort_order
      in: query
      description: Sort direction
      schema:
        type: string
        enum: [asc, desc]
        default: desc
    - name: category
      in: query
      description: Exact filter by category
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

The paginated response structure is standardised in this project (see usage in `schemas/common.yaml`):

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
      description: Total number of records matching filter criteria
    page:
      type: integer
      description: Current page number
    page_size:
      type: integer
      description: Number of items per page
    pages:
      type: integer
      description: Total number of pages
```

### Four-Layer Mapping

| OpenAPI | Pydantic | SQLAlchemy | React Query |
|---------|----------|------------|-------------|
| `page` query param | `page: int = Query(1, ge=1)` | `.offset((page - 1) * page_size)` | queryKey includes `params` |
| `page_size` query param | `page_size: int = Query(20, ge=1, le=100)` | `.limit(page_size)` | queryKey includes `params` |
| `search` query param | `search: str \| None = Query(None)` | `.where(Model.title.ilike(...))` | queryKey includes `params` |
| `sort_by` query param | `sort_by: str = Query("created_at")` | `.order_by(getattr(Model, sort_by))` | queryKey includes `params` |
| `sort_order` query param | `sort_order: str = Query("desc")` | `.desc()` / `.asc()` | queryKey includes `params` |
| `PaginatedBookmarkResponse` | `dict` with items/total/page/... | `func.count()` + `select()` | `PaginatedResponse<T>` |

### Pydantic + Endpoint Full Example

```python
"""Paginated list endpoint with filtering and sorting."""

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
    # Base query: only the user's own data
    base = select(Bookmark).where(Bookmark.user_id == user.id)

    # Filtering
    if search:
        base = base.where(
            Bookmark.title.ilike(f"%{search}%")
            | Bookmark.description.ilike(f"%{search}%")
        )
    if category:
        base = base.where(Bookmark.category == category)

    # Count total records
    total_result = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_result.scalar() or 0

    # Sorting + Pagination
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

### React Query Hook (with Filter Parameters)

```typescript
// src/hooks/useBookmarks.ts (extended version)
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
    ["bookmarks", params],   // Automatically re-queries when params change
    () => bookmarksService.list(params as Record<string, unknown>),
    CACHE_TIERS.STANDARD,
  );
}
```

> **Key Point**: The queryKey must include all filter parameters so React Query automatically triggers a re-query when parameters change.
> `CACHE_TIERS.STANDARD` (staleTime: 30s) is suitable for list data; use `REALTIME` for frequently updated data.

---

## 4. Pattern 3: Nested Resources

### Scenario

One resource belongs to another, e.g. a Portfolio contains multiple Places (many-to-many relationship).
The path structure is `/parents/{parent_id}/children`.

**Reference**: This project's `/portfolios/{portfolio_id}/places` (`docs/openapi/paths/portfolios.yaml`)

### OpenAPI YAML

```yaml
# paths/portfolios.yaml (nested resources section)

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

### Schema Design

Nested resource schema design has two key differences:

1. **Create schema includes the child resource ID** (not full child resource creation data)
2. **Read schema embeds the full child resource data** (avoids N+1 queries)

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

### Four-Layer Mapping

| OpenAPI | Pydantic | SQLAlchemy | React Query |
|---------|----------|------------|-------------|
| `PortfolioPlaceCreate` | `class PortfolioPlaceCreate(BaseModel)` | -- | `portfolioPlaceCreateSchema` |
| `PortfolioPlaceRead` | `class PortfolioPlaceRead(BaseModel)` | `class PortfolioPlace(Base)` | `portfolioPlaceReadSchema` |
| `PortfolioPlaceUpdate` | `class PortfolioPlaceUpdate(BaseModel)` | -- | `portfolioPlaceUpdateSchema` |
| `POST /portfolios/{id}/places` | `async def add_place_to_portfolio()` | `db.add(pp)` | `useAddPlaceToPortfolio()` |
| `GET /portfolios/{id}/places` | `async def list_portfolio_places()` | `select(...).where(...)` | `usePortfolioPlaces(portfolioId)` |
| `PATCH .../places/{place_id}` | `async def update_portfolio_place()` | `setattr(pp, k, v)` | `useUpdatePortfolioPlace()` |
| `DELETE .../places/{place_id}` | `async def remove_portfolio_place()` | `await db.delete(pp)` | `useRemovePortfolioPlace()` |

### Association Table (SQLAlchemy)

Many-to-many relationships use an association table, which can attach extra fields (such as `notes`, `purchase_price`):

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

    # Composite primary key
    portfolio_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("portfolios.id", ondelete="CASCADE"), primary_key=True
    )
    place_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("places.id", ondelete="CASCADE"), primary_key=True
    )

    # Extra fields (advantage of association tables)
    purchase_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    current_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    portfolio: Mapped["Portfolio"] = relationship(back_populates="portfolio_places")
    place: Mapped["Place"] = relationship(lazy="joined")  # Eager load child resource

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

> **Key Points**:
> - Composite primary key (`portfolio_id` + `place_id`) ensures uniqueness, eliminating the need for a separate `id` field
> - `lazy="joined"` on the `place` relationship avoids N+1 queries
> - `CheckConstraint` provides database-level validation (double protection with Pydantic)
> - `ondelete="CASCADE"` ensures automatic cleanup when a parent resource is deleted

### Pydantic Schema

```python
"""PortfolioPlace schemas — Pydantic definitions for nested resources."""

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Annotated

from pydantic import BaseModel, Field, PlainSerializer

from app.domains.places.schemas import PlaceRead

# Serialise Decimal as string (preserving two decimal places)
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
    place: PlaceRead   # Embed full child resource data

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
    ["portfolios", portfolioId, "places"],   // Nested queryKey
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

> **Key Points**:
> - queryKey includes `portfolioId`: `["portfolios", portfolioId, "places"]`
> - Invalidation also clears the parent resource cache `["portfolios"]` (since the parent may display `place_count`)
> - Nested paths cannot use the `createService` factory; manual `apiClient` calls are required

---

## 5. Pattern 4: File Upload

### Scenario

Users upload images or documents. This project currently does not have this feature, but provides a standard pattern for future expansion.

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
                description: Uploaded file (max 10MB)
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
      description: Publicly accessible file URL
    file_name:
      type: string
    file_size:
      type: integer
      description: File size in bytes
    mime_type:
      type: string
      description: MIME type (e.g. image/png)
    description:
      type: ['string', 'null']
    user_id:
      type: string
      format: uuid
    created_at:
      type: string
      format: date-time
```

### Four-Layer Mapping

| OpenAPI | Pydantic | SQLAlchemy | React Query |
|---------|----------|------------|-------------|
| `multipart/form-data` | `UploadFile` type hint | -- | `FormData` |
| `format: binary` | `file: UploadFile` | -- | `formData.append("file", file)` |
| `AttachmentRead` | `class AttachmentRead(BaseModel)` | `class Attachment(Base, UUIDMixin)` | `attachmentReadSchema` |
| `POST /attachments` | `async def upload_attachment()` | `db.add(attachment)` | `useUploadAttachment()` |

### Pydantic + Endpoint Example

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
    # MIME type validation
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=415, detail="UNSUPPORTED_MEDIA_TYPE")

    # File size validation
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="FILE_TOO_LARGE")

    # Save to storage backend (local filesystem example here)
    file_id = uuid.uuid4()
    file_path = f"uploads/{file_id}_{file.filename}"
    # In production, use S3 / GCS or other cloud storage
    with open(file_path, "wb") as f:
        f.write(contents)

    file_url = f"/static/{file_path}"

    # Save to database (store URL only, not binary)
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

> **Key Point**: SQLAlchemy only stores the file URL/metadata, not binary data in the database.

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

> **Notes**:
> - The frontend uses `FormData` instead of a JSON body
> - `Content-Type: multipart/form-data` must be set (Axios handles the boundary automatically)
> - File size limits should be validated on both frontend and backend
> - For production, consider using presigned URLs for direct upload to cloud storage

---

## 6. Common Pitfalls and Best Practices

### Nullable Fields

OpenAPI 3.1 uses a `type` array to express nullable:

```yaml
# Correct (OpenAPI 3.1)
description:
  type: ['string', 'null']
  maxLength: 2000

# Wrong — this is OpenAPI 3.0 syntax
description:
  type: string
  nullable: true
```

Corresponding Pydantic: `str | None`; Corresponding Zod: `z.string().nullable()`.

### UUID Format

Must be consistent across all three layers:

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

### Decimal Monetary Fields

Use `type: string` + `format: decimal` + `pattern` constraints to avoid floating-point precision issues:

```yaml
# OpenAPI
purchase_price:
  type: string
  format: decimal
  pattern: '^\d{1,10}(\.\d{1,2})?$'
```

```python
# Pydantic — use DecimalStr custom serialiser
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

### maxLength Alignment Across Three Layers

OpenAPI, Pydantic, and SQLAlchemy length limits must be consistent, otherwise:
- Frontend validation passes but backend rejects
- Backend validation passes but database truncates

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

### Update Schema — All Optional

`Update` schemas set no `required`; all fields are optional. Combined with `model_dump(exclude_unset=True)`, only fields that were actually sent are updated:

```python
class BookmarkUpdate(BaseModel):
    url: str | None = Field(default=None, max_length=2000)
    title: str | None = Field(default=None, max_length=200)
    # ... all Optional

# In the endpoint
update_data = body.model_dump(exclude_unset=True)
for key, value in update_data.items():
    setattr(bookmark, key, value)
```

### Error Responses Always Reference common.yaml

Avoid duplicating error response schemas:

```yaml
# Correct — reference shared definitions
'401':
  $ref: '../schemas/common.yaml#/responses/Unauthorized'
'422':
  $ref: '../schemas/common.yaml#/responses/ValidationError'

# Wrong — duplicate definition
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

### operationId Uniqueness

`operationId` must be unique across all path files. Recommended naming convention:

| Operation | Pattern | Example |
|-----------|---------|---------|
| Create | `create{Resource}` | `createBookmark` |
| List | `list{Resources}` | `listBookmarks` |
| Get | `get{Resource}` | `getBookmark` |
| Update | `update{Resource}` | `updateBookmark` |
| Delete | `delete{Resource}` | `deleteBookmark` |
| Nested add | `add{Child}To{Parent}` | `addPlaceToPortfolio` |
| Nested list | `list{Parent}{Children}` | `listPortfolioPlaces` |
| Nested remove | `remove{Parent}{Child}` | `removePortfolioPlace` |

---

## 7. Further Reading

- `docs/openapi/openapi.yaml` — Entry file
- `docs/openapi/paths/` — All path definitions
- `docs/openapi/schemas/` — All schema definitions
- `docs/templates/openapi/crud.yaml` — Fill-in-the-blank CRUD template (companion to this guide)
- `docs/templates/domain/` — E23 domain generator templates (machine-readable version)
- `docs/guides/en/quickstart.md` — Quickstart (E24)
- `docs/guides/en/first-epic-walkthrough.md` — First Epic Walkthrough (E24)

---

## Next Steps

- **[First Epic Walkthrough](first-epic-walkthrough.md)** — Apply these patterns hands-on by building a complete domain
- **[CI Pipeline Explained](ci-explained.md)** — Understand how CI validates your OpenAPI spec and generated types
- **[Building Domain Expert Agents](custom-agents.md)** — Create AI consultants for your specific business domain
- **[Learning Path](learning-path.md)** — See the full recommended reading order for all guides
