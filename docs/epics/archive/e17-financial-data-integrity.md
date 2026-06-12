# E17 — Financial Data Integrity

> **Size**: S (~1 session) | **Depends on**: none
> **Status**: spec

---

## Goal

Eliminate floating-point rounding errors in financial calculations by migrating `purchase_price` and `current_value` from `Float` to `Numeric(12,2)`, adding validation bounds, and updating all type layers (Pydantic, OpenAPI, Zod) to use fixed-precision decimal types.

## Problem Statement

The `portfolio_places` table stores monetary values using SQLAlchemy `Float`, which maps to IEEE 754 double-precision floating point. This causes:

1. **Rounding errors in arithmetic**: `0.1 + 0.2 = 0.30000000000000004` — aggregated sums (total_value, total_purchase, gain_loss) accumulate errors across many portfolio entries.
2. **Non-deterministic comparisons**: `gain_loss_pct` calculations like `(gl / total_purchase * 100)` produce subtly different results depending on operation order.
3. **Display artifacts**: Users may see values like `$1,234.560000000001` in the UI.
4. **No upper bound**: Current schema allows arbitrarily large values — no guard against data entry errors (e.g., entering `999999999999.99` by accident).

### Affected Fields (source of truth: `server/app/models/portfolio.py`)

| Model | Column | Current Type | Issue |
|-------|--------|-------------|-------|
| `PortfolioPlace` | `purchase_price` | `Float` | Rounding errors |
| `PortfolioPlace` | `current_value` | `Float` | Rounding errors |

### Affected Computed Values (endpoint layer)

All computed monetary values in `server/app/api/v1/endpoints/portfolios.py`:
- `total_value` — `sum(pp.current_value for pp in pp_list)`
- `total_purchase` — `sum(pp.purchase_price for pp in pp_list)`
- `gain_loss` — `total_value - total_purchase`
- `gain_loss_pct` — `(gain_loss / total_purchase * 100)`
- `CategoryAllocation.value` / `percentage`
- `TopPerformer.gain_loss` / `gain_loss_pct`

---

## OpenAPI Changes

Update `docs/openapi/schemas/portfolio.yaml` — change all monetary `number` fields from `format: double` to `format: decimal` with explicit bounds.

### Fields to Update

All fields listed below change from `type: number, format: double` to `type: string, format: decimal`.

**Why `type: string`?** JSON has no native decimal type. Using `type: string` with `format: decimal` ensures lossless transport — the value `"1234.56"` arrives exactly, whereas JSON `number` 1234.56 may lose precision in some parsers. This is the standard pattern used by Stripe, Shopify, and other financial APIs.

#### PortfolioPlaceCreate
- `purchase_price`: `type: string, format: decimal, pattern: "^\d{1,10}(\.\d{1,2})?$", default: "0.00"`
- `current_value`: `type: string, format: decimal, pattern: "^\d{1,10}(\.\d{1,2})?$", default: "0.00"`
- Add `maximum` description: max 9999999999.99

#### PortfolioPlaceUpdate
- `purchase_price`: same as above (optional)
- `current_value`: same as above (optional)

#### PortfolioPlaceRead
- `purchase_price`: `type: string, format: decimal`
- `current_value`: `type: string, format: decimal`
- `gain_loss`: `type: string, format: decimal`

#### PortfolioRead
- `total_value`: `type: string, format: decimal`

#### PortfolioDetail
- `total_value`: `type: string, format: decimal`
- `total_purchase`: `type: string, format: decimal`
- `gain_loss`: `type: string, format: decimal`
- `gain_loss_pct`: `type: ['string', 'null'], format: decimal` (percentage, still decimal for precision)

#### PortfolioAnalytics
- `total_value`, `total_purchase`, `gain_loss`: `type: string, format: decimal`
- `gain_loss_pct`: `type: ['string', 'null'], format: decimal`
- `category_allocation[].value`: `type: string, format: decimal`
- `category_allocation[].percentage`: `type: string, format: decimal`
- `top_performers[].purchase_price`, `current_value`, `gain_loss`: `type: string, format: decimal`
- `top_performers[].gain_loss_pct`: `type: ['string', 'null'], format: decimal`

After OpenAPI changes, run `pnpm generate:types` to regenerate `client/src/api/types.ts`.

---

## Server Implementation

### 1. Model Changes (`server/app/models/portfolio.py`)

```python
from sqlalchemy import Numeric

class PortfolioPlace(Base):
    # ...
    purchase_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0.00")
    )
    current_value: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0.00")
    )
```

- Import `Decimal` from `decimal` stdlib
- Import `Numeric` from `sqlalchemy` (replace `Float` import)
- `Numeric(12, 2)` = up to 10 integer digits + 2 decimal places = max `9999999999.99`
- `Mapped[Decimal]` ensures SQLAlchemy returns `decimal.Decimal` objects, not `float`

Add check constraints for bounds:

```python
__table_args__ = (
    # ... existing constraints ...
    CheckConstraint("purchase_price >= 0", name="ck_portfolio_places_purchase_price_min"),
    CheckConstraint("purchase_price <= 9999999999.99", name="ck_portfolio_places_purchase_price_max"),
    CheckConstraint("current_value >= 0", name="ck_portfolio_places_current_value_min"),
    CheckConstraint("current_value <= 9999999999.99", name="ck_portfolio_places_current_value_max"),
)
```

### 2. Schema Changes (`server/app/schemas/portfolio.py`)

```python
from decimal import Decimal
from pydantic import condecimal

# Use Decimal with constraints throughout
```

#### PortfolioPlaceCreate
```python
purchase_price: Decimal = Field(default=Decimal("0.00"), ge=0, le=Decimal("9999999999.99"), decimal_places=2)
current_value: Decimal = Field(default=Decimal("0.00"), ge=0, le=Decimal("9999999999.99"), decimal_places=2)
```

#### PortfolioPlaceUpdate
```python
purchase_price: Decimal | None = Field(default=None, ge=0, le=Decimal("9999999999.99"), decimal_places=2)
current_value: Decimal | None = Field(default=None, ge=0, le=Decimal("9999999999.99"), decimal_places=2)
```

#### PortfolioPlaceRead
```python
purchase_price: Decimal
current_value: Decimal
gain_loss: Decimal
```

#### PortfolioRead
```python
total_value: Decimal
```

#### PortfolioDetail
```python
total_value: Decimal
total_purchase: Decimal
gain_loss: Decimal
gain_loss_pct: Decimal | None
```

#### CategoryAllocation
```python
value: Decimal
percentage: Decimal
```

#### TopPerformer
```python
purchase_price: Decimal
current_value: Decimal
gain_loss: Decimal
gain_loss_pct: Decimal | None
```

#### PortfolioAnalytics
```python
total_value: Decimal
total_purchase: Decimal
gain_loss: Decimal
gain_loss_pct: Decimal | None
```

Add Pydantic model config to serialize Decimal as string:

```python
model_config = {"from_attributes": True, "json_encoders": {Decimal: str}}
```

**Note**: Pydantic v2 uses `model_config` with `ConfigDict`. For decimal serialization, use a custom serializer or `PlainSerializer`:

```python
from pydantic import field_serializer

class PortfolioPlaceRead(BaseModel):
    # ...
    @field_serializer("purchase_price", "current_value", "gain_loss")
    def serialize_decimal(self, v: Decimal) -> str:
        return str(v.quantize(Decimal("0.01")))
```

Alternatively, create a reusable `DecimalStr` annotated type:

```python
from typing import Annotated
from pydantic import PlainSerializer

DecimalStr = Annotated[
    Decimal,
    PlainSerializer(lambda v: str(v.quantize(Decimal("0.01"))), return_type=str),
]
```

Then use `DecimalStr` wherever a monetary value appears. This is the recommended approach — define once, use everywhere.

### 3. Endpoint Changes (`server/app/api/v1/endpoints/portfolios.py`)

Update computed value arithmetic to use `Decimal`:

```python
from decimal import Decimal

def _portfolio_summary(portfolio: Portfolio) -> dict:
    places = portfolio.portfolio_places or []
    return {
        "place_count": len(places),
        "total_value": sum((pp.current_value for pp in places), Decimal("0.00")),
    }

def _pp_gain_loss(pp: PortfolioPlace) -> Decimal:
    return pp.current_value - pp.purchase_price
```

Update analytics aggregations:
- `sum()` calls need `Decimal("0.00")` as start value
- Percentage calculations: `Decimal("100")` multiplier
- `cat_data` default factory: `{"count": 0, "value": Decimal("0.00")}`

### 4. Alembic Migration (`server/alembic/versions/006_float_to_numeric.py`)

```python
"""Migrate purchase_price and current_value from Float to Numeric(12,2)

Revision ID: 006
Revises: 005
Create Date: 2026-03-13
"""

from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: Alter column types from Float to Numeric(12,2)
    with op.batch_alter_table("portfolio_places") as batch_op:
        batch_op.alter_column(
            "purchase_price",
            existing_type=sa.Float(),
            type_=sa.Numeric(12, 2),
            existing_nullable=False,
            existing_server_default="0",
        )
        batch_op.alter_column(
            "current_value",
            existing_type=sa.Float(),
            type_=sa.Numeric(12, 2),
            existing_nullable=False,
            existing_server_default="0",
        )

    # Step 2: Add check constraints for bounds
    op.create_check_constraint(
        "ck_portfolio_places_purchase_price_min",
        "portfolio_places",
        "purchase_price >= 0",
    )
    op.create_check_constraint(
        "ck_portfolio_places_purchase_price_max",
        "portfolio_places",
        "purchase_price <= 9999999999.99",
    )
    op.create_check_constraint(
        "ck_portfolio_places_current_value_min",
        "portfolio_places",
        "current_value >= 0",
    )
    op.create_check_constraint(
        "ck_portfolio_places_current_value_max",
        "portfolio_places",
        "current_value <= 9999999999.99",
    )


def downgrade() -> None:
    op.drop_constraint("ck_portfolio_places_current_value_max", "portfolio_places", type_="check")
    op.drop_constraint("ck_portfolio_places_current_value_min", "portfolio_places", type_="check")
    op.drop_constraint("ck_portfolio_places_purchase_price_max", "portfolio_places", type_="check")
    op.drop_constraint("ck_portfolio_places_purchase_price_min", "portfolio_places", type_="check")

    with op.batch_alter_table("portfolio_places") as batch_op:
        batch_op.alter_column(
            "purchase_price",
            existing_type=sa.Numeric(12, 2),
            type_=sa.Float(),
            existing_nullable=False,
            existing_server_default="0",
        )
        batch_op.alter_column(
            "current_value",
            existing_type=sa.Numeric(12, 2),
            type_=sa.Float(),
            existing_nullable=False,
            existing_server_default="0",
        )
```

**Migration notes**:
- Uses `batch_alter_table` for SQLite compatibility (test DB uses SQLite)
- Existing `Float` values are cast to `Numeric(12,2)` automatically — any fractional digits beyond 2 are rounded
- Migration is safe to run on empty or populated tables
- `server_default="0"` is preserved (becomes `0.00` in Numeric)

---

## Client Implementation

### 1. Zod Schema Changes (`client/src/schemas/portfolio.ts`)

Monetary values change from `z.number()` to `z.string()` (matching the OpenAPI `type: string, format: decimal` decision). Add a reusable decimal refinement:

```typescript
/** Validates a decimal string with up to 10 integer digits and 2 decimal places. */
const decimalString = z.string().regex(
  /^\d{1,10}(\.\d{1,2})?$/,
  "Must be a valid decimal (up to 2 decimal places)"
);

/** Nullable decimal string (for percentages that may be null). */
const nullableDecimalString = z.string().nullable();
```

#### portfolioPlaceCreateSchema
```typescript
purchase_price: decimalString.default("0.00"),
current_value: decimalString.default("0.00"),
```

#### portfolioPlaceUpdateSchema
```typescript
purchase_price: decimalString.optional(),
current_value: decimalString.optional(),
```

#### portfolioPlaceReadSchema
```typescript
purchase_price: z.string(),
current_value: z.string(),
gain_loss: z.string(),
```

#### portfolioReadSchema
```typescript
total_value: z.string(),
```

#### portfolioDetailSchema
```typescript
total_value: z.string(),
total_purchase: z.string(),
gain_loss: z.string(),
gain_loss_pct: z.string().nullable(),
```

#### categoryAllocationSchema
```typescript
value: z.string(),
percentage: z.string(),
```

#### topPerformerSchema
```typescript
purchase_price: z.string(),
current_value: z.string(),
gain_loss: z.string(),
gain_loss_pct: z.string().nullable(),
```

#### portfolioAnalyticsSchema
```typescript
total_value: z.string(),
total_purchase: z.string(),
gain_loss: z.string(),
gain_loss_pct: z.string().nullable(),
```

### 2. UI Formatting Utility (new, optional)

Consider adding a formatting helper in `client/src/utils/decimal.ts`:

```typescript
/** Parse decimal string to number for display. */
export function parseDecimal(value: string): number {
  return parseFloat(value);
}

/** Format decimal string as currency. */
export function formatCurrency(value: string, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(parseFloat(value));
}
```

This is optional for E17 — E18 (Domain UI) will consume it.

### 3. Service Layer

No changes needed to `client/src/api/services/portfolios.ts` — the service layer passes data through Zod parsing, which handles the string type automatically.

### 4. MSW Handler Updates (`client/src/tests/handlers/`)

Update portfolio mock data to return string values for monetary fields instead of numbers:

```typescript
// Before
purchase_price: 100.50,
// After
purchase_price: "100.50",
```

---

## Files to Modify

| File | Change |
|------|--------|
| `docs/openapi/schemas/portfolio.yaml` | `double` → `string/decimal` for all monetary fields |
| `server/app/models/portfolio.py` | `Float` → `Numeric(12,2)`, `Mapped[Decimal]`, check constraints |
| `server/app/schemas/portfolio.py` | `float` → `Decimal` (or `DecimalStr`), add `le` bound, serializers |
| `server/app/api/v1/endpoints/portfolios.py` | `Decimal` arithmetic in computed values |
| `server/alembic/versions/006_float_to_numeric.py` | **New** — migration for column type + constraints |
| `client/src/schemas/portfolio.ts` | `z.number()` → `z.string()` for monetary fields |
| `client/src/api/types.ts` | **Auto-regenerated** via `pnpm generate:types` |

### Test Files to Update

| File | Change |
|------|--------|
| `server/tests/integration/test_portfolios.py` | Assert `Decimal` / string values instead of `float` |
| `client/src/api/services/__tests__/portfolios.test.ts` | Mock data uses string decimals |

---

## Test Plan

### Server Tests

#### Migration Tests
- [ ] Migration 006 applies cleanly on empty database
- [ ] Migration 006 applies cleanly on database with existing Float data
- [ ] Downgrade 006 reverts to Float without data loss
- [ ] Existing Float values are correctly rounded to 2 decimal places

#### Model / Validation Tests
- [ ] `purchase_price = Decimal("123.45")` persists and reads back exactly
- [ ] `purchase_price = Decimal("0.10") + Decimal("0.20")` equals `Decimal("0.30")` (no float error)
- [ ] Negative `purchase_price` rejected by check constraint
- [ ] Value exceeding `9999999999.99` rejected by check constraint
- [ ] `current_value = 0` (default) works correctly

#### Schema Tests
- [ ] `PortfolioPlaceCreate(purchase_price=Decimal("100.50"))` validates
- [ ] `PortfolioPlaceCreate(purchase_price=Decimal("-1"))` rejected (ge=0)
- [ ] `PortfolioPlaceCreate(purchase_price=Decimal("99999999999"))` rejected (le bound)
- [ ] JSON serialization outputs string: `"purchase_price": "100.50"`

#### Endpoint Tests
- [ ] `POST /portfolios/{id}/places` with decimal values returns string decimals
- [ ] `GET /portfolios/{id}` — `total_value`, `gain_loss` are string decimals
- [ ] `GET /portfolios/{id}/analytics` — all monetary fields are string decimals
- [ ] Gain/loss calculation: purchase=100.10, current=200.20, gain_loss="100.10" (exact)
- [ ] Percentage calculation with zero purchase: `gain_loss_pct` is null

### Client Tests

#### Zod Schema Tests
- [ ] `portfolioPlaceCreateSchema.parse({ place_id: "...", purchase_price: "100.50", current_value: "200.00" })` succeeds
- [ ] `portfolioPlaceCreateSchema.parse({ place_id: "...", purchase_price: -1 })` fails
- [ ] `portfolioPlaceReadSchema.parse({ ..., purchase_price: "100.50" })` succeeds
- [ ] `portfolioAnalyticsSchema.parse({ ..., total_value: "5000.00" })` succeeds

#### Service Tests
- [ ] `portfoliosService.getById()` returns string decimal fields
- [ ] `portfolioPlacesApi.add()` sends and receives string decimals
- [ ] `getPortfolioAnalytics()` returns string decimal fields

---

## Acceptance Criteria

- [ ] `purchase_price` and `current_value` stored as `Numeric(12,2)` in database
- [ ] Alembic migration 006 runs without errors (upgrade + downgrade)
- [ ] Check constraints enforce `0 <= value <= 9999999999.99` at database level
- [ ] Pydantic schemas use `Decimal` type with validation bounds
- [ ] API responses serialize monetary values as strings (lossless)
- [ ] OpenAPI spec updated — `format: decimal` on all monetary fields
- [ ] Zod schemas validate string decimal format
- [ ] `0.1 + 0.2 = 0.30` — no floating-point artifacts in gain/loss calculations
- [ ] All existing portfolio tests pass (updated for new types)
- [ ] Coverage >= 80% maintained
