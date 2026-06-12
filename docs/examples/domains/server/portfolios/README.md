# Portfolios Domain — Example Implementation

> This is a **reference domain** shipped with the template. Study its patterns, then run `template-cleanup.sh` to remove it.

## Purpose

Demonstrates a more complex domain with relationships: a portfolio contains multiple places, with computed fields (total value) and nested queries.

## Architecture Highlights

```
portfolios/
  __init__.py       # Domain auto-registration
  models.py         # Portfolio model with M2M relationship to Places
  schemas.py        # Schemas with nested place references
  endpoints.py      # CRUD + relationship management endpoints
```

### Key Patterns to Study

- **Model relationships**: Many-to-many via association table (`portfolio_places`)
- **Computed fields**: `total_value` aggregated from related places
- **Nested serialization**: Response schemas include related place data
- **Decimal precision**: Financial values use `Numeric(12,2)` not Float (E17)

## Migration

對應的資料庫 migration 位於 [`docs/examples/migrations/004_portfolios.py`](../../../migrations/004_portfolios.py)。

> Portfolios 依賴 places 和 teams，安裝時需同時安裝 `002_places.py` 和 `003_teams.py`。

安裝步驟請參考 [`docs/examples/migrations/README.md`](../../../migrations/README.md)。

## After Studying

Generate your own domain:
```bash
make new-domain NAME=notes
```

Or remove this example:
```bash
bash .github/template-cleanup.sh
```
