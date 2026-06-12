#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# new-domain.sh — Generate a new domain module (no Claude Code needed)
#
# Usage:  ./scripts/new-domain.sh <name>
#         make new-domain NAME=notes
#
# Generates a full-stack domain with:
#   Server: SQLAlchemy model, Pydantic schemas, FastAPI CRUD endpoints,
#           domain registration (__init__.py), Alembic migration
#   Client: Zod schema, createService, React Query hooks,
#           MSW test handler, list page + CSS
# ──────────────────────────────────────────────────────────────
set -euo pipefail

# ── Helpers ────────────────────────────────────────────────────

BOLD='\033[1m'
GREEN='\033[32m'
CYAN='\033[36m'
RED='\033[31m'
DIM='\033[2m'
RESET='\033[0m'

die() { echo -e "${RED}Error: $1${RESET}" >&2; exit 1; }

# ── Parse input ────────────────────────────────────────────────

NAME="${1:-}"
[ -z "$NAME" ] && die "Usage: $0 <domain-name>  (e.g. note, blog_post)"

# Validate: lowercase, letters/underscores only
[[ "$NAME" =~ ^[a-z][a-z_]*$ ]] || die "Domain name must be lowercase letters/underscores (e.g. 'note', 'blog_post')"

# ── Derive naming variants ────────────────────────────────────

SNAKE="$NAME"

# Pluralise
if [[ "$SNAKE" =~ (s|x|z|sh|ch)$ ]]; then
  SNAKE_PLURAL="${SNAKE}es"
elif [[ "$SNAKE" =~ [^aeiou]y$ ]]; then
  SNAKE_PLURAL="${SNAKE%y}ies"
else
  SNAKE_PLURAL="${SNAKE}s"
fi

# PascalCase helper
to_pascal() {
  local result=""
  IFS='_' read -ra parts <<< "$1"
  for part in "${parts[@]}"; do
    result+="$(echo "${part:0:1}" | tr '[:lower:]' '[:upper:]')${part:1}"
  done
  echo "$result"
}

PASCAL=$(to_pascal "$SNAKE")
PASCAL_PLURAL=$(to_pascal "$SNAKE_PLURAL")
KEBAB_PLURAL=$(echo "$SNAKE_PLURAL" | tr '_' '-')

# camelCase helper
to_camel() {
  local pascal
  pascal=$(to_pascal "$1")
  echo "$(echo "${pascal:0:1}" | tr '[:upper:]' '[:lower:]')${pascal:1}"
}

CAMEL=$(to_camel "$SNAKE")
CAMEL_PLURAL=$(to_camel "$SNAKE_PLURAL")
UPPER=$(echo "$SNAKE" | tr '[:lower:]' '[:upper:]')

# ── Paths ──────────────────────────────────────────────────────

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DOMAIN_DIR="$ROOT/server/app/domains/$SNAKE_PLURAL"

if [ -d "$DOMAIN_DIR" ]; then
  die "Domain '$SNAKE_PLURAL' already exists at $DOMAIN_DIR"
fi

echo -e "${CYAN}Creating domain: ${BOLD}$SNAKE${RESET}"
echo -e "  Plural: $SNAKE_PLURAL | Pascal: $PASCAL | Kebab: $KEBAB_PLURAL"
echo ""

mkdir -p "$DOMAIN_DIR"

# ── Generate: models.py ───────────────────────────────────────

cat > "$DOMAIN_DIR/models.py" << PYEOF
"""${PASCAL} model — user-owned ${SNAKE} entity."""

import uuid

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import GUID, Base, TimestampMixin, UUIDMixin


class ${PASCAL}(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "${SNAKE_PLURAL}"

    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text, default=None)
    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID(), ForeignKey("user.id", ondelete="CASCADE"), index=True
    )
PYEOF

echo -e "  ${GREEN}✓${RESET} models.py"

# ── Generate: schemas.py ──────────────────────────────────────

cat > "$DOMAIN_DIR/schemas.py" << PYEOF
"""${PASCAL} schemas — Pydantic v2 request / response models."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ${PASCAL}Create(BaseModel):
    name: str
    description: str | None = None


class ${PASCAL}Update(BaseModel):
    name: str | None = None
    description: str | None = None


class ${PASCAL}Read(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    description: str | None
    user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime


class Paginated${PASCAL}Response(BaseModel):
    items: list[${PASCAL}Read]
    total: int
    page: int
    size: int
PYEOF

echo -e "  ${GREEN}✓${RESET} schemas.py"

# ── Generate: endpoints.py ────────────────────────────────────

cat > "$DOMAIN_DIR/endpoints.py" << PYEOF
"""${PASCAL} endpoints — CRUD operations for ${SNAKE_PLURAL}."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_active_user
from app.db.session import get_db
from app.models.user import User

from .models import ${PASCAL}
from .schemas import (
    ${PASCAL}Create,
    ${PASCAL}Read,
    ${PASCAL}Update,
    Paginated${PASCAL}Response,
)

router = APIRouter()


@router.get("/", response_model=Paginated${PASCAL}Response)
async def list_${SNAKE_PLURAL}(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),
):
    offset = (page - 1) * size
    total_q = select(func.count()).select_from(${PASCAL}).where(${PASCAL}.user_id == user.id)
    total = (await db.execute(total_q)).scalar() or 0

    items_q = (
        select(${PASCAL})
        .where(${PASCAL}.user_id == user.id)
        .offset(offset)
        .limit(size)
        .order_by(${PASCAL}.created_at.desc())
    )
    items = (await db.execute(items_q)).scalars().all()

    return Paginated${PASCAL}Response(
        items=[${PASCAL}Read.model_validate(i) for i in items],
        total=total,
        page=page,
        size=size,
    )


@router.post("/", response_model=${PASCAL}Read, status_code=201)
async def create_${SNAKE}(
    payload: ${PASCAL}Create,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),
):
    obj = ${PASCAL}(**payload.model_dump(), user_id=user.id)
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return ${PASCAL}Read.model_validate(obj)


@router.get("/{${SNAKE}_id}", response_model=${PASCAL}Read)
async def get_${SNAKE}(
    ${SNAKE}_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),
):
    q = select(${PASCAL}).where(${PASCAL}.id == ${SNAKE}_id, ${PASCAL}.user_id == user.id)
    obj = (await db.execute(q)).scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="${PASCAL} not found")
    return ${PASCAL}Read.model_validate(obj)


@router.patch("/{${SNAKE}_id}", response_model=${PASCAL}Read)
async def update_${SNAKE}(
    ${SNAKE}_id: uuid.UUID,
    payload: ${PASCAL}Update,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),
):
    q = select(${PASCAL}).where(${PASCAL}.id == ${SNAKE}_id, ${PASCAL}.user_id == user.id)
    obj = (await db.execute(q)).scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="${PASCAL} not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)

    await db.commit()
    await db.refresh(obj)
    return ${PASCAL}Read.model_validate(obj)


@router.delete("/{${SNAKE}_id}", status_code=204)
async def delete_${SNAKE}(
    ${SNAKE}_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(current_active_user),
):
    q = select(${PASCAL}).where(${PASCAL}.id == ${SNAKE}_id, ${PASCAL}.user_id == user.id)
    obj = (await db.execute(q)).scalar_one_or_none()
    if not obj:
        raise HTTPException(status_code=404, detail="${PASCAL} not found")

    await db.delete(obj)
    await db.commit()
PYEOF

echo -e "  ${GREEN}✓${RESET} endpoints.py"

# ── Generate: __init__.py ─────────────────────────────────────

cat > "$DOMAIN_DIR/__init__.py" << PYEOF
"""${PASCAL_PLURAL} domain — user-owned ${SNAKE_PLURAL} with CRUD operations."""

from app.domains import DomainConfig
from app.domains.${SNAKE_PLURAL}.endpoints import router
from app.domains.${SNAKE_PLURAL}.models import ${PASCAL}

domain_config = DomainConfig(
    router=router,
    prefix="/${KEBAB_PLURAL}",
    tags=["${KEBAB_PLURAL}"],
    models=[${PASCAL}],
)

__all__ = ["domain_config", "${PASCAL}"]
PYEOF

echo -e "  ${GREEN}✓${RESET} __init__.py"

# ── Generate Alembic migration ────────────────────────────────

echo ""
echo -e "  ${DIM}Generating database migration...${RESET}"

VERSIONS_DIR="$ROOT/server/alembic/versions"
MIGRATION_TMPL="$ROOT/docs/templates/domain/server/migration.py.tmpl"

# Auto-detect next migration number (scan existing filenames for max NNN prefix)
NEXT_NUM=1
if ls "$VERSIONS_DIR"/[0-9]*.py &>/dev/null; then
  MAX_NUM=$(ls "$VERSIONS_DIR"/[0-9]*.py | sed 's|.*/||' | grep -oE '^[0-9]+' | sort -n | tail -1)
  NEXT_NUM=$((MAX_NUM + 1))
fi
REVISION_ID=$(printf "%03d" "$NEXT_NUM")

# Detect current head revision via alembic heads
cd "$ROOT/server"
HEAD_OUTPUT=$(uv run alembic heads 2>/dev/null || true)
HEAD_COUNT=$(echo "$HEAD_OUTPUT" | grep -c '(head)' || true)

if [ "$HEAD_COUNT" -gt 1 ]; then
  echo -e "  ${RED}⚠  Multiple alembic heads detected:${RESET}"
  echo "$HEAD_OUTPUT"
  echo -e "  ${RED}   Run 'cd server && uv run alembic merge heads -m merge' first.${RESET}"
  echo -e "  ${DIM}   Migration skipped — generate manually after merging.${RESET}"
  cd "$ROOT"
else
  # Extract the head revision ID (format: "001 (head)")
  DOWN_REV=$(echo "$HEAD_OUTPUT" | grep '(head)' | awk '{print $1}' | head -1)

  if [ -z "$DOWN_REV" ]; then
    DOWN_REVISION_VALUE="None"
    DOWN_REVISION_DISPLAY="None"
  else
    DOWN_REVISION_VALUE="\"$DOWN_REV\""
    DOWN_REVISION_DISPLAY="$DOWN_REV"
  fi

  CREATE_DATE=$(date +%Y-%m-%d)
  MIGRATION_FILE="$VERSIONS_DIR/${REVISION_ID}_${SNAKE_PLURAL}.py"

  if [ -f "$MIGRATION_TMPL" ]; then
    sed \
      -e "s|{{SNAKE_PLURAL}}|${SNAKE_PLURAL}|g" \
      -e "s|{{REVISION_ID}}|${REVISION_ID}|g" \
      -e "s|{{DOWN_REVISION_VALUE}}|${DOWN_REVISION_VALUE}|g" \
      -e "s|{{DOWN_REVISION}}|${DOWN_REVISION_DISPLAY}|g" \
      -e "s|{{CREATE_DATE}}|${CREATE_DATE}|g" \
      "$MIGRATION_TMPL" > "$MIGRATION_FILE"

    echo -e "  ${GREEN}✓${RESET} Migration generated: alembic/versions/${REVISION_ID}_${SNAKE_PLURAL}.py"

    if uv run alembic upgrade head 2>/dev/null; then
      echo -e "  ${GREEN}✓${RESET} Migration applied"
    else
      echo -e "  ${DIM}  (Run 'cd server && uv run alembic upgrade head' to apply later)${RESET}"
    fi
  else
    echo -e "  ${DIM}  Migration template not found at $MIGRATION_TMPL${RESET}"
    echo -e "  ${DIM}  (Run 'cd server && uv run alembic revision --autogenerate -m \"add ${SNAKE_PLURAL} table\"' later)${RESET}"
  fi

  cd "$ROOT"
fi

# ══════════════════════════════════════════════════════════════
# CLIENT SCAFFOLDING
# ══════════════════════════════════════════════════════════════

echo ""
echo -e "${CYAN}Creating client scaffolding...${RESET}"
echo ""

# ── Generate: client/src/schemas/<name>.ts ────────────────────

mkdir -p "$ROOT/client/src/schemas"

cat > "$ROOT/client/src/schemas/${SNAKE}.ts" << TSEOF
import { z } from "zod";

export const ${CAMEL}CreateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

export const ${CAMEL}ReadSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  user_id: z.string().uuid(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const ${CAMEL}UpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
});

export type ${PASCAL}Create = z.infer<typeof ${CAMEL}CreateSchema>;
export type ${PASCAL}Read = z.infer<typeof ${CAMEL}ReadSchema>;
export type ${PASCAL}Update = z.infer<typeof ${CAMEL}UpdateSchema>;
TSEOF

echo -e "  ${GREEN}✓${RESET} client/src/schemas/${SNAKE}.ts"

# ── Generate: client/src/api/services/<name>.ts ──────────────

mkdir -p "$ROOT/client/src/api/services"

cat > "$ROOT/client/src/api/services/${SNAKE_PLURAL}.ts" << TSEOF
import { createService } from "./createService";
import { ${CAMEL}ReadSchema } from "../../schemas/${SNAKE}";

export const ${CAMEL_PLURAL}Service = createService("/${KEBAB_PLURAL}", ${CAMEL}ReadSchema);
TSEOF

echo -e "  ${GREEN}✓${RESET} client/src/api/services/${SNAKE_PLURAL}.ts"

# ── Generate: client/src/hooks/use<Name>.ts ──────────────────

mkdir -p "$ROOT/client/src/hooks"

cat > "$ROOT/client/src/hooks/use${PASCAL_PLURAL}.ts" << TSEOF
import { useServiceQuery, useServiceMutation } from "./useService";
import { CACHE_TIERS } from "../cacheConfig";
import { ${CAMEL_PLURAL}Service } from "../api/services/${SNAKE_PLURAL}";
import type { PaginationParams } from "../schemas/common";
import type { ${PASCAL}Create, ${PASCAL}Update } from "../schemas/${SNAKE}";

export function use${PASCAL}List(params?: PaginationParams) {
  return useServiceQuery(
    ["${SNAKE_PLURAL}", params],
    () => ${CAMEL_PLURAL}Service.list(params),
    CACHE_TIERS.STANDARD,
  );
}

export function use${PASCAL}Detail(id: string) {
  return useServiceQuery(
    ["${SNAKE_PLURAL}", id],
    () => ${CAMEL_PLURAL}Service.getById(id),
    CACHE_TIERS.STANDARD,
    { enabled: !!id },
  );
}

export function use${PASCAL}Create() {
  return useServiceMutation(
    (data: ${PASCAL}Create) => ${CAMEL_PLURAL}Service.create(data as Record<string, unknown>),
    { invalidateKeys: [["${SNAKE_PLURAL}"]] },
  );
}

export function use${PASCAL}Update() {
  return useServiceMutation(
    ({ id, data }: { id: string; data: ${PASCAL}Update }) =>
      ${CAMEL_PLURAL}Service.update(id, data as Record<string, unknown>),
    { invalidateKeys: [["${SNAKE_PLURAL}"]] },
  );
}

export function use${PASCAL}Delete() {
  return useServiceMutation(
    (id: string) => ${CAMEL_PLURAL}Service.remove(id),
    { invalidateKeys: [["${SNAKE_PLURAL}"]] },
  );
}
TSEOF

echo -e "  ${GREEN}✓${RESET} client/src/hooks/use${PASCAL_PLURAL}.ts"

# ── Generate: client/src/tests/handlers/<name>.ts ────────────

mkdir -p "$ROOT/client/src/tests/handlers"

cat > "$ROOT/client/src/tests/handlers/${SNAKE_PLURAL}.ts" << TSEOF
import { createCrudHandlers } from "../helpers/createHandlers";

const ${UPPER}_FIXTURES = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Test ${PASCAL} A",
    description: "A test ${SNAKE}",
    user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "22222222-2222-2222-2222-222222222222",
    name: "Test ${PASCAL} B",
    description: null,
    user_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    created_at: "2026-01-02T00:00:00Z",
    updated_at: "2026-01-02T00:00:00Z",
  },
];

export const ${CAMEL}Handlers = createCrudHandlers("/${KEBAB_PLURAL}", ${UPPER}_FIXTURES);
export { ${UPPER}_FIXTURES };
TSEOF

echo -e "  ${GREEN}✓${RESET} client/src/tests/handlers/${SNAKE_PLURAL}.ts"

# ── Generate: client/src/pages/<name>/<Name>Page.tsx ─────────

PAGE_DIR="$ROOT/client/src/pages/${SNAKE_PLURAL}"
mkdir -p "$PAGE_DIR"

cat > "$PAGE_DIR/${PASCAL_PLURAL}Page.tsx" << TSEOF
import { use${PASCAL}List } from "../../hooks/use${PASCAL_PLURAL}";
import type { ${PASCAL}Read } from "../../schemas/${SNAKE}";
import "./${PASCAL_PLURAL}.css";

export default function ${PASCAL_PLURAL}Page() {
  const { data, isLoading, error } = use${PASCAL}List();

  if (isLoading) return <p className="${SNAKE}-loading">Loading...</p>;
  if (error) return <p className="${SNAKE}-error">Failed to load ${SNAKE_PLURAL}.</p>;

  const items: ${PASCAL}Read[] = data?.items ?? [];

  return (
    <div className="${SNAKE_PLURAL}-page">
      <div className="${SNAKE_PLURAL}-header">
        <h1>${PASCAL_PLURAL}</h1>
      </div>

      {items.length === 0 ? (
        <p className="${SNAKE_PLURAL}-empty">No ${SNAKE_PLURAL} yet.</p>
      ) : (
        <table className="${SNAKE_PLURAL}-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.description ?? "—"}</td>
                <td>{new Date(item.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
TSEOF

echo -e "  ${GREEN}✓${RESET} client/src/pages/${SNAKE_PLURAL}/${PASCAL_PLURAL}Page.tsx"

# ── Generate: client/src/pages/<name>/<Name>.css ─────────────

cat > "$PAGE_DIR/${PASCAL_PLURAL}.css" << CSSEOF
.${SNAKE_PLURAL}-page {
  padding: 2rem;
  max-width: 960px;
  margin: 0 auto;
}

.${SNAKE_PLURAL}-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.${SNAKE_PLURAL}-header h1 {
  font-family: var(--font-display, sans-serif);
  font-size: 1.75rem;
  color: var(--text-primary, #fff);
}

.${SNAKE_PLURAL}-table {
  width: 100%;
  border-collapse: collapse;
}

.${SNAKE_PLURAL}-table th,
.${SNAKE_PLURAL}-table td {
  text-align: left;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.1));
}

.${SNAKE_PLURAL}-table th {
  font-weight: 600;
  color: var(--text-secondary, #aaa);
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.${SNAKE_PLURAL}-table td {
  color: var(--text-primary, #fff);
}

.${SNAKE_PLURAL}-table tbody tr:hover {
  background: var(--surface-hover, rgba(255, 255, 255, 0.05));
}

.${SNAKE_PLURAL}-empty {
  color: var(--text-secondary, #aaa);
  text-align: center;
  padding: 3rem 0;
}

.${SNAKE}-loading,
.${SNAKE}-error {
  color: var(--text-secondary, #aaa);
  text-align: center;
  padding: 3rem 0;
}
CSSEOF

echo -e "  ${GREEN}✓${RESET} client/src/pages/${SNAKE_PLURAL}/${PASCAL_PLURAL}.css"

# ══════════════════════════════════════════════════════════════
# DOMAIN TEST SCAFFOLDING
# ══════════════════════════════════════════════════════════════

echo ""
echo -e "${CYAN}Creating domain test scaffolding...${RESET}"
echo ""

DOMAIN_TEST_DIR="$ROOT/server/tests/domains/${SNAKE_PLURAL}"
mkdir -p "$DOMAIN_TEST_DIR"

cat > "$DOMAIN_TEST_DIR/__init__.py" << PYEOF
PYEOF

cat > "$DOMAIN_TEST_DIR/test_${SNAKE_PLURAL}_endpoints.py" << PYEOF
"""${PASCAL} endpoint tests — CRUD operations for /${KEBAB_PLURAL}."""

import pytest
from httpx import AsyncClient


@pytest.fixture()
async def auth_headers(client: AsyncClient) -> dict[str, str]:
    """Register + login a test user, return Authorization header."""
    await client.post(
        "/auth/register",
        json={
            "email": "${SNAKE}test@example.com",
            "password": "Test#Pass1",
            "display_name": "Test User",
        },
    )
    resp = await client.post(
        "/auth/jwt/login",
        data={"username": "${SNAKE}test@example.com", "password": "Test#Pass1"},
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


async def test_list_${SNAKE_PLURAL}_empty(client: AsyncClient, auth_headers: dict):
    """GET /${KEBAB_PLURAL}/ returns empty list for new user."""
    resp = await client.get("/${KEBAB_PLURAL}/", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["items"] == []
    assert body["total"] == 0


async def test_create_${SNAKE}(client: AsyncClient, auth_headers: dict):
    """POST /${KEBAB_PLURAL}/ creates a new ${SNAKE}."""
    resp = await client.post(
        "/${KEBAB_PLURAL}/",
        json={"name": "Test ${PASCAL}", "description": "A test ${SNAKE}"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Test ${PASCAL}"
    assert body["description"] == "A test ${SNAKE}"
    assert "id" in body


async def test_list_${SNAKE_PLURAL}_unauthorized(client: AsyncClient):
    """GET /${KEBAB_PLURAL}/ without auth returns 401."""
    resp = await client.get("/${KEBAB_PLURAL}/")
    assert resp.status_code == 401
PYEOF

echo -e "  ${GREEN}✓${RESET} server/tests/domains/${SNAKE_PLURAL}/test_${SNAKE_PLURAL}_endpoints.py"

# ── Done ──────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${GREEN}  Domain '${SNAKE}' created successfully!${RESET}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo ""
echo "  Generated files:"
echo ""
echo -e "  ${CYAN}Server:${RESET}"
echo "    server/app/domains/${SNAKE_PLURAL}/__init__.py"
echo "    server/app/domains/${SNAKE_PLURAL}/models.py"
echo "    server/app/domains/${SNAKE_PLURAL}/schemas.py"
echo "    server/app/domains/${SNAKE_PLURAL}/endpoints.py"
if [ -n "${REVISION_ID:-}" ] && [ -f "$ROOT/server/alembic/versions/${REVISION_ID}_${SNAKE_PLURAL}.py" ]; then
echo "    server/alembic/versions/${REVISION_ID}_${SNAKE_PLURAL}.py"
fi
echo ""
echo -e "  ${CYAN}Tests:${RESET}"
echo "    server/tests/domains/${SNAKE_PLURAL}/__init__.py"
echo "    server/tests/domains/${SNAKE_PLURAL}/test_${SNAKE_PLURAL}_endpoints.py"
echo ""
echo -e "  ${CYAN}Client:${RESET}"
echo "    client/src/schemas/${SNAKE}.ts"
echo "    client/src/api/services/${SNAKE_PLURAL}.ts"
echo "    client/src/hooks/use${PASCAL_PLURAL}.ts"
echo "    client/src/tests/handlers/${SNAKE_PLURAL}.ts"
echo "    client/src/pages/${SNAKE_PLURAL}/${PASCAL_PLURAL}Page.tsx"
echo "    client/src/pages/${SNAKE_PLURAL}/${PASCAL_PLURAL}.css"
echo ""
echo -e "  ${BOLD}Next steps:${RESET}"
echo "    1. Add a route to client/src/App.tsx:"
echo -e "       ${DIM}import ${PASCAL_PLURAL}Page from './pages/${SNAKE_PLURAL}/${PASCAL_PLURAL}Page';${RESET}"
echo -e "       ${DIM}<Route path=\"/${KEBAB_PLURAL}\" element={<${PASCAL_PLURAL}Page />} />${RESET}"
echo "    2. Start the server:  make go"
echo "    3. Check the API docs: http://localhost:8080/docs"
echo "    4. Run tests:          make test-server && make test-client"
echo "    5. Customise the model in server/app/domains/${SNAKE_PLURAL}/models.py"
echo ""
echo -e "  ${DIM}The server domain is auto-registered — no need to edit main.py.${RESET}"
echo ""
