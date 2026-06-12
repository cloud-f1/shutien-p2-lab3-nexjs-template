#!/usr/bin/env bash
# scripts/doctor.sh — Environment diagnostic tool
# Usage: bash scripts/doctor.sh
# Called by `make doctor`.
# Exit 0 = all healthy, exit 1 = issues found.

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
  printf "  ${GREEN}✓${NC} %s\n" "$1"
}

fail() {
  checks=$((checks + 1))
  issues=$((issues + 1))
  printf "  ${RED}✗${NC} %s\n" "$1"
  printf "    ${YELLOW}Fix:${NC} %s\n" "$2"
}

warn() {
  checks=$((checks + 1))
  printf "  ${YELLOW}!${NC} %s\n" "$1"
}

echo ""
printf "${CYAN}Environment Diagnostic${NC}\n"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Helper: compare semver (major.minor) ─────────────────────
version_gte() {
  local have="$1" need="$2"
  local have_major have_minor need_major need_minor
  have_major=$(echo "$have" | cut -d. -f1)
  have_minor=$(echo "$have" | cut -d. -f2)
  need_major=$(echo "$need" | cut -d. -f1)
  need_minor=$(echo "$need" | cut -d. -f2)
  if [ "$have_major" -gt "$need_major" ] 2>/dev/null; then return 0; fi
  if [ "$have_major" -eq "$need_major" ] 2>/dev/null && \
     [ "$have_minor" -ge "$need_minor" ] 2>/dev/null; then return 0; fi
  return 1
}

# ═══════════════════════════════════════════════════════════════
# 1. Tool Versions
# ═══════════════════════════════════════════════════════════════
printf "${CYAN}Tool Versions${NC}\n"

# Python >= 3.12
PYTHON_CMD=""
if command -v python3 &>/dev/null; then PYTHON_CMD="python3"
elif command -v python &>/dev/null; then PYTHON_CMD="python"
fi

if [ -n "$PYTHON_CMD" ]; then
  py_ver=$($PYTHON_CMD --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
  if version_gte "$py_ver" "3.12"; then
    pass "Python $py_ver"
  else
    fail "Python $py_ver — need >= 3.12" "pyenv install 3.12 && pyenv global 3.12"
  fi
else
  fail "Python not found" "Install Python 3.12+: brew install pyenv && pyenv install 3.12"
fi

# Node >= 22
if command -v node &>/dev/null; then
  node_ver=$(node --version | sed 's/^v//' | cut -d. -f1-2)
  if version_gte "$node_ver" "22.0"; then
    pass "Node.js $node_ver"
  else
    fail "Node.js $node_ver — need >= 22" "nvm install 22 && nvm use 22"
  fi
else
  fail "Node.js not found" "Install Node.js 22+: nvm install 22"
fi

# pnpm
if command -v pnpm &>/dev/null; then
  pass "pnpm $(pnpm --version | cut -d. -f1-2)"
else
  fail "pnpm not found" "npm install -g pnpm"
fi

# uv
if command -v uv &>/dev/null; then
  pass "uv $(uv --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')"
else
  fail "uv not found" "curl -LsSf https://astral.sh/uv/install.sh | sh"
fi

# Docker
if command -v docker &>/dev/null; then
  pass "Docker $(docker --version | grep -oE '[0-9]+\.[0-9]+' | head -1)"
else
  fail "Docker not found" "Install Docker Desktop: https://docs.docker.com/get-docker/"
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# 2. Environment Variables
# ═══════════════════════════════════════════════════════════════
printf "${CYAN}Environment Variables${NC}\n"

if [ ! -f "$ENV_FILE" ]; then
  fail "server/.env not found" "Run: make go  (or: bash scripts/generate-env.sh)"
else
  pass "server/.env exists"

  # Check SECRET_KEY
  secret_key=$(grep -E '^SECRET_KEY=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2-)
  if [ -z "$secret_key" ]; then
    fail "SECRET_KEY is empty" "Set SECRET_KEY in server/.env (openssl rand -hex 32)"
  elif echo "$secret_key" | grep -qE "CHANGE_ME|changeme|placeholder"; then
    fail "SECRET_KEY is still a placeholder" "Run: make go  (or: openssl rand -hex 32)"
  else
    pass "SECRET_KEY is set"
  fi

  # Check REFRESH_SECRET_KEY
  refresh_key=$(grep -E '^REFRESH_SECRET_KEY=' "$ENV_FILE" 2>/dev/null | head -1 | cut -d= -f2-)
  if [ -z "$refresh_key" ]; then
    fail "REFRESH_SECRET_KEY is missing" "Add REFRESH_SECRET_KEY to server/.env (openssl rand -hex 32)"
  elif echo "$refresh_key" | grep -qE "CHANGE_ME|changeme|placeholder"; then
    fail "REFRESH_SECRET_KEY is still a placeholder" "Run: make go  (or: openssl rand -hex 32)"
  else
    pass "REFRESH_SECRET_KEY is set"
  fi

  # Check SECRET_KEY != REFRESH_SECRET_KEY
  if [ -n "$secret_key" ] && [ -n "$refresh_key" ] && [ "$secret_key" = "$refresh_key" ]; then
    fail "SECRET_KEY and REFRESH_SECRET_KEY are identical" "Generate separate secrets for each"
  fi
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# 3. Database
# ═══════════════════════════════════════════════════════════════
printf "${CYAN}Database${NC}\n"

if command -v docker &>/dev/null; then
  if docker compose ps --status running 2>/dev/null | grep -q "db"; then
    pass "PostgreSQL container is running"
    # Try pg_isready
    if docker compose exec -T db pg_isready -U saas_user -d saas_dev >/dev/null 2>&1; then
      pass "PostgreSQL is accepting connections"
    else
      fail "PostgreSQL not accepting connections" "Check: docker compose logs db"
    fi
  else
    warn "PostgreSQL container is not running (start with: make db)"
  fi
else
  warn "Docker not installed — cannot check PostgreSQL"
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# 4. Port Availability
# ═══════════════════════════════════════════════════════════════
printf "${CYAN}Port Availability${NC}\n"

check_port() {
  local port=$1 service=$2
  if command -v lsof &>/dev/null; then
    if lsof -iTCP:"$port" -sTCP:LISTEN -P -n >/dev/null 2>&1; then
      warn "Port $port ($service) is in use — may conflict if starting $service"
    else
      pass "Port $port ($service) is available"
    fi
  elif command -v ss &>/dev/null; then
    if ss -tlnp 2>/dev/null | grep -q ":$port "; then
      warn "Port $port ($service) is in use — may conflict if starting $service"
    else
      pass "Port $port ($service) is available"
    fi
  else
    warn "Cannot check port $port — neither lsof nor ss available"
  fi
}

check_port 8080 "uvicorn / FastAPI"
check_port 5173 "Vite dev server"
check_port 5432 "PostgreSQL"

echo ""

# ═══════════════════════════════════════════════════════════════
# 5. Context Budget
# ═══════════════════════════════════════════════════════════════
printf "${CYAN}Context Budget${NC}\n"

BUDGET_SCRIPT="$SCRIPT_DIR/checks/check-context-budget.sh"
if [ -x "$BUDGET_SCRIPT" ]; then
  budget_output=$("$BUDGET_SCRIPT" 2>&1) && budget_ok=true || budget_ok=false
  if $budget_ok; then
    pass "Context docs within budget"
  else
    fail "Context docs over budget" "Run: bash $BUDGET_SCRIPT for details"
  fi
else
  warn "check-context-budget.sh not found or not executable"
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$issues" -eq 0 ]; then
  printf "${GREEN}All %d checks passed!${NC} Your environment is healthy.\n" "$checks"
  exit 0
else
  printf "${RED}%d issue(s)${NC} found out of %d checks. Fix the items above and re-run ${YELLOW}make doctor${NC}.\n" "$issues" "$checks"
  exit 1
fi
