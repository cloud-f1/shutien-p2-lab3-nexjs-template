#!/usr/bin/env bash
# scripts/doctor-production.sh — Production readiness diagnostic
# Usage: bash scripts/doctor-production.sh
# Called by `make doctor-production`.
# Exit 0 = all production checks pass, exit 1 = issues found.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/server/.env"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

issues=0
checks=0

pass() {
  checks=$((checks + 1))
  printf "  ${GREEN}✅${NC} %s\n" "$1"
}

fail() {
  checks=$((checks + 1))
  issues=$((issues + 1))
  printf "  ${RED}❌${NC} %s\n" "$1"
  printf "    ${YELLOW}Fix:${NC} %s\n" "$2"
}

echo ""
printf "${CYAN}Production Readiness Check${NC}\n"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ ! -f "$ENV_FILE" ]; then
  printf "  ${RED}❌${NC} server/.env not found — cannot run production checks.\n"
  printf "    ${YELLOW}Fix:${NC} Run: make go  (or: bash scripts/generate-env.sh)\n"
  exit 1
fi

# Helper: read env var value from .env file
read_env() {
  grep -E "^${1}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2-
}

# ═══════════════════════════════════════════════════════════════
# 1. Secrets — must not be placeholders
# ═══════════════════════════════════════════════════════════════
printf "${CYAN}Secrets${NC}\n"

secret_key=$(read_env SECRET_KEY)
if [ -z "$secret_key" ]; then
  fail "SECRET_KEY is empty" "Set SECRET_KEY in server/.env (openssl rand -hex 32)"
elif echo "$secret_key" | grep -qiE "CHANGE_ME|changeme|placeholder|^secret$"; then
  fail "SECRET_KEY is a placeholder" "openssl rand -hex 32"
else
  pass "SECRET_KEY is set to a real value"
fi

refresh_key=$(read_env REFRESH_SECRET_KEY)
if [ -z "$refresh_key" ]; then
  fail "REFRESH_SECRET_KEY is empty" "Set REFRESH_SECRET_KEY in server/.env (openssl rand -hex 32)"
elif echo "$refresh_key" | grep -qiE "CHANGE_ME|changeme|placeholder|^secret$"; then
  fail "REFRESH_SECRET_KEY is a placeholder" "openssl rand -hex 32"
else
  pass "REFRESH_SECRET_KEY is set to a real value"
fi

if [ -n "$secret_key" ] && [ -n "$refresh_key" ] && [ "$secret_key" = "$refresh_key" ]; then
  fail "SECRET_KEY and REFRESH_SECRET_KEY are identical" "Generate separate secrets for each"
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# 2. Database — must be PostgreSQL (not SQLite)
# ═══════════════════════════════════════════════════════════════
printf "${CYAN}Database${NC}\n"

db_url=$(read_env DATABASE_URL)
if [ -z "$db_url" ]; then
  fail "DATABASE_URL is empty" "Set DATABASE_URL to a PostgreSQL connection string"
elif echo "$db_url" | grep -qi "sqlite"; then
  fail "DATABASE_URL uses SQLite — not suitable for production" "Set to a PostgreSQL URL (postgresql+asyncpg://...)"
elif echo "$db_url" | grep -qi "postgresql"; then
  pass "DATABASE_URL uses PostgreSQL"
else
  fail "DATABASE_URL does not appear to be PostgreSQL" "Verify DATABASE_URL is a PostgreSQL connection string"
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# 3. Email — provider should not be console in production
# ═══════════════════════════════════════════════════════════════
printf "${CYAN}Email Provider${NC}\n"

email_provider=$(read_env EMAIL_PROVIDER)
if [ -z "$email_provider" ] || [ "$email_provider" = "console" ]; then
  fail "EMAIL_PROVIDER is '${email_provider:-console}' — emails go to server log, not users" "Set EMAIL_PROVIDER to mailgun or zeabur and configure API keys"
else
  pass "EMAIL_PROVIDER is '$email_provider'"
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# 4. OAuth — at least one provider configured
# ═══════════════════════════════════════════════════════════════
printf "${CYAN}OAuth Providers${NC}\n"

google_id=$(read_env GOOGLE_CLIENT_ID)
github_id=$(read_env GITHUB_CLIENT_ID)

has_oauth=false
if [ -n "$google_id" ]; then
  pass "Google OAuth configured"
  has_oauth=true
fi
if [ -n "$github_id" ]; then
  pass "GitHub OAuth configured"
  has_oauth=true
fi

if [ "$has_oauth" = false ]; then
  fail "No OAuth provider configured" "Set GOOGLE_CLIENT_ID/SECRET or GITHUB_CLIENT_ID/SECRET for social login"
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# 5. Migration drift — pending or diverged Alembic migrations
# ═══════════════════════════════════════════════════════════════
printf "${CYAN}Migration Drift${NC}\n"

if command -v uv >/dev/null 2>&1; then
  alembic_output=$(cd "$PROJECT_ROOT/server" && uv run alembic check 2>&1) && \
    pass "No pending migrations" || \
    fail "Alembic detected pending or diverged migrations" "cd server && uv run alembic revision --autogenerate -m 'description' && uv run alembic upgrade head"
else
  fail "uv not found — cannot check migrations" "Install uv: curl -LsSf https://astral.sh/uv/install.sh | sh"
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# 6. DEBUG enforcement — must be false or unset
# ═══════════════════════════════════════════════════════════════
printf "${CYAN}DEBUG Enforcement${NC}\n"

debug_val=$(read_env DEBUG)
if [ -z "$debug_val" ] || [ "$debug_val" = "false" ] || [ "$debug_val" = "False" ] || [ "$debug_val" = "0" ]; then
  pass "DEBUG is off (${debug_val:-unset})"
else
  fail "DEBUG is '$debug_val' — must be false or unset in production" "Set DEBUG=false in server/.env (or remove the line)"
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# 7. No localhost origins — ALLOWED_ORIGINS_STR check
# ═══════════════════════════════════════════════════════════════
printf "${CYAN}Allowed Origins${NC}\n"

origins_val=$(read_env ALLOWED_ORIGINS_STR)
if [ -z "$origins_val" ]; then
  pass "ALLOWED_ORIGINS_STR is unset (will use defaults)"
elif echo "$origins_val" | grep -qi "localhost"; then
  fail "ALLOWED_ORIGINS_STR contains 'localhost'" "Remove localhost entries from ALLOWED_ORIGINS_STR in server/.env"
else
  pass "ALLOWED_ORIGINS_STR has no localhost entries"
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# 8. Secret key length — must be >= 32 characters
# ═══════════════════════════════════════════════════════════════
printf "${CYAN}Secret Key Length${NC}\n"

secret_key_val=$(read_env SECRET_KEY)
if [ -n "$secret_key_val" ]; then
  key_len=${#secret_key_val}
  if [ "$key_len" -ge 32 ]; then
    pass "SECRET_KEY is $key_len characters (>= 32)"
  else
    fail "SECRET_KEY is only $key_len characters (minimum 32)" "Generate a longer key: openssl rand -hex 32"
  fi
else
  fail "SECRET_KEY is empty — cannot check length" "Set SECRET_KEY in server/.env (openssl rand -hex 32)"
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# 9. Client build — must succeed without errors
# ═══════════════════════════════════════════════════════════════
printf "${CYAN}Client Build${NC}\n"

build_log=$(mktemp)
if (cd "$PROJECT_ROOT/client" && pnpm build > "$build_log" 2>&1); then
  pass "Client build succeeded"
else
  fail "Client build failed" "cd client && pnpm build — check TypeScript/Vite errors"
  printf "    ${YELLOW}Build output:${NC}\n"
  sed 's/^/      /' "$build_log"
fi
rm -f "$build_log"

echo ""

# ═══════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$issues" -eq 0 ]; then
  printf "${GREEN}All %d production checks passed!${NC} Ready to deploy.\n" "$checks"
  exit 0
else
  printf "${RED}%d issue(s)${NC} found out of %d checks. Fix before deploying to production.\n" "$issues" "$checks"
  exit 1
fi
