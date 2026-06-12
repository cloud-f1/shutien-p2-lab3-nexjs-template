# E8 — Portfolio System

> **Size**: L (2-3 sessions) | **Depends on**: E7 (Places CRUD)
> **Status**: spec

---

## Overview

Portfolios group Places into investment collections with financial tracking. Each place-in-portfolio carries `purchase_price` and `current_value` for gain/loss calculation. An analytics endpoint provides aggregated metrics by category and performance ranking.

## Data Model

### Portfolio table
| Column | Type | Constraints |
|--------|------|-------------|
| id | GUID (PK) | UUIDMixin |
| name | String(200) | NOT NULL |
| description | Text | nullable |
| user_id | GUID (FK → user.id) | CASCADE delete, indexed |
| created_at | DateTime(tz) | TimestampMixin |
| updated_at | DateTime(tz) | TimestampMixin |

### PortfolioPlace table (association with extra columns)
| Column | Type | Constraints |
|--------|------|-------------|
| portfolio_id | GUID (FK → portfolios.id) | PK part 1, CASCADE delete |
| place_id | GUID (FK → places.id) | PK part 2, CASCADE delete |
| purchase_price | Float | default 0, >= 0 |
| current_value | Float | default 0, >= 0 |
| notes | Text | nullable |
| added_at | DateTime(tz) | server_default=now() |

**Composite PK**: `(portfolio_id, place_id)` — enforces uniqueness, no duplicate place entries.

## API Endpoints (10 new paths)

### Portfolio CRUD
| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | /portfolios | 201 | Create portfolio |
| GET | /portfolios | 200 | List portfolios (paginated) |
| GET | /portfolios/{id} | 200 | Get portfolio detail (with places + stats) |
| PATCH | /portfolios/{id} | 200 | Update portfolio name/description |
| DELETE | /portfolios/{id} | 204 | Delete portfolio (cascade removes memberships) |

### Portfolio ↔ Place membership
| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | /portfolios/{id}/places | 201 | Add place (with purchase_price, current_value) |
| GET | /portfolios/{id}/places | 200 | List places in portfolio |
| PATCH | /portfolios/{id}/places/{place_id} | 200 | Update investment data |
| DELETE | /portfolios/{id}/places/{place_id} | 204 | Remove place from portfolio |

### Analytics
| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | /portfolios/{id}/analytics | 200 | Aggregated metrics |

## Security

- **IDOR prevention**: All endpoints filter by `user_id == current_user.id`. Returns 404 (not 403).
- **Cross-user place validation**: When adding a place, verify `Place.user_id == current_user.id`.
- **No negative values**: `purchase_price >= 0`, `current_value >= 0` (Pydantic + DB constraint).
- **Cascade delete**: Deleting a Portfolio cascades to PortfolioPlace rows. Deleting a Place also cascades.

## Analytics Response Shape

```json
{
  "portfolio_id": "uuid",
  "total_value": 1500000.0,
  "total_purchase": 1200000.0,
  "gain_loss": 300000.0,
  "gain_loss_pct": 25.0,
  "place_count": 5,
  "category_allocation": [
    { "category": "residential", "count": 3, "value": 900000, "percentage": 60.0 },
    { "category": "commercial", "count": 2, "value": 600000, "percentage": 40.0 }
  ],
  "top_performers": [
    {
      "place_id": "uuid", "place_name": "...",
      "purchase_price": 200000, "current_value": 350000,
      "gain_loss": 150000, "gain_loss_pct": 75.0
    }
  ]
}
```

## Client Service Layer

```typescript
// Uses createService factory — same pattern as Places
export const portfoliosService = createService("/portfolios", portfolioReadSchema);

// Custom methods for sub-resources
export const portfolioPlacesApi = {
  list: (portfolioId: string) => apiClient.get(`/portfolios/${portfolioId}/places`),
  add: (portfolioId: string, data: PortfolioPlaceCreate) => apiClient.post(`/portfolios/${portfolioId}/places`, data),
  update: (portfolioId: string, placeId: string, data: PortfolioPlaceUpdate) => apiClient.patch(`/portfolios/${portfolioId}/places/${placeId}`, data),
  remove: (portfolioId: string, placeId: string) => apiClient.delete(`/portfolios/${portfolioId}/places/${placeId}`),
};
```

## Test Stories

### Server (integration)
1. Create portfolio → 201, returns PortfolioRead
2. List portfolios (pagination) → correct page/total
3. Get portfolio detail → includes places + computed stats
4. Update portfolio name → 200
5. Delete portfolio → 204, cascade removes memberships
6. Add place to portfolio → 201, with investment data
7. Add duplicate place → 409 PLACE_ALREADY_IN_PORTFOLIO
8. Add another user's place → 404
9. Update portfolio place values → 200
10. Remove place from portfolio → 204
11. Cross-user isolation → user B can't see user A's portfolios
12. Analytics → correct totals, category allocation, top performers
13. Analytics empty portfolio → zero values, empty arrays
14. Delete place cascades → removes from portfolio

### Client (unit)
1. portfoliosService CRUD operations
2. portfolioPlacesApi sub-resource operations
3. Zod schema validation

## Migration

- Alembic `004_add_portfolio_tables.py`
- Two tables: `portfolios` + `portfolio_places`
- Composite PK on portfolio_places
- Indexes: `portfolio_places.portfolio_id`, `portfolio_places.place_id`, `portfolios.user_id`

## Charts (client UI — deferred)

Dashboard integration with Recharts is deferred to a follow-up or the UI pass. The analytics API is designed to feed directly into:
- **PieChart**: `category_allocation` → slices by category
- **BarChart**: `top_performers` → bars by gain/loss
- **Summary cards**: `total_value`, `gain_loss`, `gain_loss_pct`
