#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# E125 — PG Migration Round-Trip Verification
#
# Spins up a disposable PostgreSQL 16 container, runs:
#   1. alembic upgrade head
#   2. alembic downgrade base
#   3. alembic upgrade head   (idempotency check)
# Then tears down the container regardless of outcome.
#
# Usage:  bash scripts/verify-pg-migrations.sh
# ─────────────────────────────────────────────────────────────
set -euo pipefail

# ─── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# ─── Container Setup ────────────────────────────────────────
CONTAINER_NAME="pg-migration-test-$$"
PG_USER="migration_test"
PG_PASS="migration_test"
PG_DB="migration_test_db"

cleanup() {
    echo ""
    echo -e "${CYAN}🧹 Tearing down container ${CONTAINER_NAME}...${NC}"
    docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}  PG Migration Round-Trip Verification${NC}"
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ─── Step 0: Check Docker ───────────────────────────────────
if ! command -v docker &>/dev/null; then
    echo -e "${RED}❌ Docker is not installed or not in PATH.${NC}"
    exit 1
fi

# ─── Step 1: Start PG 16 Container on Random Port ──────────
echo -e "${CYAN}▶ Starting PostgreSQL 16 container (${CONTAINER_NAME})...${NC}"

docker run -d \
    --name "$CONTAINER_NAME" \
    -e POSTGRES_USER="$PG_USER" \
    -e POSTGRES_PASSWORD="$PG_PASS" \
    -e POSTGRES_DB="$PG_DB" \
    --publish "127.0.0.1:0:5432" \
    postgres:16-alpine \
    >/dev/null

# Discover the assigned host port
HOST_PORT=$(docker inspect "$CONTAINER_NAME" \
    --format '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}')

echo -e "  Container: ${CONTAINER_NAME}"
echo -e "  Port:      127.0.0.1:${HOST_PORT}"

# ─── Step 2: Wait for PG Ready ─────────────────────────────
echo -e "${CYAN}▶ Waiting for PostgreSQL to accept connections...${NC}"

MAX_WAIT=30
ELAPSED=0
until docker exec "$CONTAINER_NAME" pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; do
    if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
        echo -e "${RED}❌ PostgreSQL did not become ready within ${MAX_WAIT}s.${NC}"
        exit 1
    fi
    sleep 1
    ELAPSED=$((ELAPSED + 1))
done
echo -e "  ${GREEN}Ready after ${ELAPSED}s.${NC}"

# ─── Build DATABASE_URL ─────────────────────────────────────
DATABASE_URL="postgresql+asyncpg://${PG_USER}:${PG_PASS}@127.0.0.1:${HOST_PORT}/${PG_DB}"

# ─── Helper: Run Alembic Step ───────────────────────────────
FAILURES=0

run_alembic() {
    local label="$1"
    shift
    echo ""
    echo -e "${CYAN}▶ ${label}${NC}"
    echo -e "  Command: alembic $*"

    if (cd server && DATABASE_URL="$DATABASE_URL" uv run alembic "$@") 2>&1; then
        echo -e "  ${GREEN}✅ ${label} — PASS${NC}"
    else
        echo -e "  ${RED}❌ ${label} — FAIL${NC}"
        FAILURES=$((FAILURES + 1))
    fi
}

# ─── Step 3–5: Migration Round Trip ────────────────────────
run_alembic "Step 1/3: upgrade head"   upgrade head
run_alembic "Step 2/3: downgrade base" downgrade base
run_alembic "Step 3/3: upgrade head (idempotency)" upgrade head

# ─── Result ─────────────────────────────────────────────────
echo ""
echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
if [ "$FAILURES" -eq 0 ]; then
    echo -e "  ${GREEN}${BOLD}✅ ALL STEPS PASSED — migrations round-trip OK${NC}"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    exit 0
else
    echo -e "  ${RED}${BOLD}❌ ${FAILURES} STEP(S) FAILED — see output above${NC}"
    echo -e "${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    exit 1
fi
