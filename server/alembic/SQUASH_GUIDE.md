# Alembic Migration Squashing Guide

## When to Squash
After 50+ migration files, fresh database setup becomes slow. Squashing replaces many small migrations with a single baseline.

## Prerequisites
- All environments (dev, staging, production) are on the same head revision
- No pending or in-progress migrations
- Full database backup completed

## Steps

### 1. Record current head
```bash
cd server && uv run alembic heads
# Note the current head revision ID
```

### 2. Generate baseline from current models
```bash
# Create a fresh DB and let SQLAlchemy create all tables
uv run python -c "
from app.models.base import Base
from app.models import *  # import all models
from sqlalchemy import create_engine
engine = create_engine('sqlite:///squash_check.db')
Base.metadata.create_all(engine)
"
```

### 3. Create the squashed migration
```bash
# Archive old migrations
mkdir -p alembic/versions/archive
mv alembic/versions/*.py alembic/versions/archive/

# Generate new baseline from current models
uv run alembic revision --autogenerate -m "squashed_baseline"
```

### 4. Stamp existing databases
For databases that already have all tables:
```bash
uv run alembic stamp <new_revision_id>
```

### 5. Verify
```bash
# On a fresh DB: upgrade should create everything
uv run alembic upgrade head

# On existing DB: stamp + upgrade head should be no-op
```

## Risks
- **Never squash if environments are on different revisions** — they won't be able to upgrade
- **Keep the archive** — old migrations may be needed for rollback analysis
- **Test on a fresh DB** before deploying the squashed migration
