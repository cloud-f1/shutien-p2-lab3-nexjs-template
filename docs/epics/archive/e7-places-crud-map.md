# E7: Places CRUD + Map — Spec

> **Epic**: E7 | **Size**: L | **Deps**: E0 (GUID), E5 (sessions/auth)
> **Author**: @spec-writer | **Date**: 2026-03-11

---

## Goal

First domain model: **Place** — a user-owned location with name, address, coordinates.
Full CRUD endpoints + spatial "nearby" query. Client-side map component and service layer.

## OpenAPI Changes

### New Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/places` | Bearer | Create a place |
| `GET` | `/places` | Bearer | List user's places (paginated) |
| `GET` | `/places/{id}` | Bearer | Get single place |
| `PATCH` | `/places/{id}` | Bearer | Update place |
| `DELETE` | `/places/{id}` | Bearer | Delete place |
| `GET` | `/places/nearby` | Bearer | Places within radius of lat/lng |

### New Schemas

```yaml
PlaceCreate:
  type: object
  required: [name, latitude, longitude]
  properties:
    name:
      type: string
      maxLength: 200
    address:
      type: string
      maxLength: 500
    description:
      type: string
      maxLength: 2000
    latitude:
      type: number
      format: double
      minimum: -90
      maximum: 90
    longitude:
      type: number
      format: double
      minimum: -180
      maximum: 180
    category:
      type: string
      maxLength: 50

PlaceRead:
  type: object
  required: [id, name, latitude, longitude, user_id, created_at, updated_at]
  properties:
    id:
      type: string
      format: uuid
    name:
      type: string
    address:
      type: string
    description:
      type: string
    latitude:
      type: number
      format: double
    longitude:
      type: number
      format: double
    category:
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

PlaceUpdate:
  type: object
  properties:
    name:
      type: string
      maxLength: 200
    address:
      type: string
      maxLength: 500
    description:
      type: string
      maxLength: 2000
    latitude:
      type: number
      format: double
    longitude:
      type: number
      format: double
    category:
      type: string
      maxLength: 50

NearbyQuery:
  # Query params for GET /places/nearby
  latitude: number (required)
  longitude: number (required)
  radius_km: number (default: 10, max: 100)
  limit: integer (default: 20, max: 100)
```

## Server Implementation

### Model: `server/app/models/place.py`

```python
class Place(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "places"

    name: Mapped[str] = mapped_column(String(200))
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("user.id", ondelete="CASCADE"), index=True
    )
```

**Note on PostGIS**: The epic description mentions PostGIS, but for the template we'll use
simple Haversine formula for nearby queries. PostGIS is overkill for the initial implementation
and adds a deployment dependency. Can upgrade later if needed.

### Schemas: `server/app/schemas/place.py`

- `PlaceCreate(BaseModel)` — name, address, description, latitude, longitude, category
- `PlaceRead(BaseModel)` — full read with id, user_id, timestamps
- `PlaceUpdate(BaseModel)` — all fields optional

### Endpoints: `server/app/api/v1/endpoints/places.py`

```python
router = APIRouter()

@router.post("/", response_model=PlaceRead, status_code=201)
@router.get("/", response_model=PaginatedResponse[PlaceRead])
@router.get("/nearby", response_model=list[PlaceRead])
@router.get("/{place_id}", response_model=PlaceRead)
@router.patch("/{place_id}", response_model=PlaceRead)
@router.delete("/{place_id}", status_code=204)
```

**Authorization rule**: Users can only CRUD their own places. The `user_id` filter is
applied server-side — no user should see or modify another user's places.

### Nearby Query: Haversine Formula

```python
from math import radians, sin, cos, sqrt, atan2

def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371  # Earth radius in km
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1-a))
```

For SQLite (tests), this runs in Python. For PostgreSQL (prod), this can be optimized
to a SQL expression using `acos(sin(lat1)*sin(lat2) + cos(lat1)*cos(lat2)*cos(dlon))`.

### Migration: `003_add_places_table.py`

Standard Alembic migration creating `places` table with:
- GUID PK, user_id FK (CASCADE), indexes on user_id
- Composite index on (latitude, longitude) for spatial queries

## Client Implementation

### Zod Schema: `client/src/schemas/place.ts`

```typescript
export const placeCreateSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  category: z.string().max(50).optional(),
});

export const placeReadSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  address: z.string().nullable(),
  description: z.string().nullable(),
  latitude: z.number(),
  longitude: z.number(),
  category: z.string().nullable(),
  user_id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});
```

### Service: `client/src/api/services/places.ts`

```typescript
import { createService } from "./createService";
import { placeReadSchema } from "../../schemas/place";

export const placesService = createService("/places", placeReadSchema);
```

### Hooks: Use `useServiceQuery` / `useServiceMutation` from existing factory

### Map Component: `client/src/components/PlaceMap.tsx`

Leaflet (react-leaflet) for the map — lighter than Mapbox, no API key needed.

- Show user's places as markers
- Click marker → show place details popup
- Click map → add new place at coordinates
- Nearby radius circle overlay

### Dashboard Integration

Add "Places" view to existing DashboardPage (alongside Overview, Projects, etc.):
- Places list (table/cards)
- Map view toggle
- Add Place form (modal or inline)

## Test Plan

### Server Tests (target: 10+ tests)

| # | Test | Type |
|---|------|------|
| 1 | Create place returns 201 + PlaceRead | integration |
| 2 | Create place with missing name returns 422 | integration |
| 3 | List places returns only user's places | integration |
| 4 | List places pagination works | integration |
| 5 | Get place by ID | integration |
| 6 | Get other user's place returns 404 | integration |
| 7 | Update place (PATCH) | integration |
| 8 | Update other user's place returns 404 | integration |
| 9 | Delete place returns 204 | integration |
| 10 | Delete other user's place returns 404 | integration |
| 11 | Nearby query returns places within radius | integration |
| 12 | Nearby query excludes distant places | integration |
| 13 | Place model field validation | unit |
| 14 | Haversine formula correctness | unit |

### Client Tests (target: 8+ tests)

| # | Test | Type |
|---|------|------|
| 1 | placesService.list() returns parsed places | unit (MSW) |
| 2 | placesService.create() sends and parses | unit (MSW) |
| 3 | placesService.getById() returns single place | unit (MSW) |
| 4 | placesService.update() sends patch | unit (MSW) |
| 5 | placesService.remove() calls DELETE | unit (MSW) |
| 6 | PlaceMap renders without crashing | unit |
| 7 | Place list renders items | unit |
| 8 | Add place form validates inputs | unit |

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `docs/openapi.yaml` | MODIFY | Add Place endpoints + schemas |
| `server/app/models/place.py` | CREATE | Place model |
| `server/app/models/__init__.py` | MODIFY | Export Place |
| `server/app/schemas/place.py` | CREATE | PlaceCreate, PlaceRead, PlaceUpdate |
| `server/app/api/v1/endpoints/places.py` | CREATE | CRUD + nearby endpoints |
| `server/app/main.py` | MODIFY | Include places router |
| `server/alembic/versions/003_add_places_table.py` | CREATE | Migration |
| `client/src/schemas/place.ts` | CREATE | Zod schemas |
| `client/src/api/services/places.ts` | CREATE | Service via factory |
| `client/src/api/types.ts` | REGENERATE | After openapi.yaml change |
| `client/src/components/PlaceMap.tsx` | CREATE | Leaflet map component |
| `client/src/pages/dashboard/DashboardPage.tsx` | MODIFY | Add Places view |
| Server tests (~14) | CREATE | Full CRUD + nearby |
| Client tests (~8) | CREATE | Service + component tests |

## Acceptance Criteria

- [ ] All Place CRUD endpoints work with auth
- [ ] Users can only access their own places
- [ ] Nearby query returns correct results
- [ ] Pagination works on list endpoint
- [ ] Map component renders and shows markers
- [ ] Coverage ≥ 80% both suites
- [ ] Alembic migration applies cleanly

## Out of Scope

- PostGIS (use Haversine for now)
- Geocoding API integration (user enters lat/lng manually or clicks map)
- Place images/photos
- Place sharing between users
- Full-text search on place names
