#!/usr/bin/env bash
# scripts/check-prereqs.sh — Validate development prerequisites
# Called by `make go` before any other step.
# Exit 0 = all good, exit 1 = missing/outdated tools.

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

errors=0

# ── Helper: compare semver (major.minor) ─────────────────────
# Returns 0 if $1 >= $2
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

echo "🔍 Checking prerequisites..."
echo ""

# ── git ──────────────────────────────────────────────────────
if command -v git &>/dev/null; then
  git_ver=$(git --version | grep -oE '[0-9]+\.[0-9]+')
  printf "${GREEN}✓${NC} git %s\n" "$git_ver"
else
  printf "${RED}✗${NC} git — not found\n"
  printf "  Install: ${YELLOW}brew install git${NC} (macOS) or ${YELLOW}sudo apt-get install git${NC} (Linux)\n"
  errors=$((errors + 1))
fi

# ── Node.js >= 22 ────────────────────────────────────────────
if command -v node &>/dev/null; then
  node_ver=$(node --version | sed 's/^v//' | cut -d. -f1-2)
  if version_gte "$node_ver" "22.0"; then
    printf "${GREEN}✓${NC} node %s\n" "$node_ver"
  else
    printf "${RED}✗${NC} node %s — need >= 22\n" "$node_ver"
    printf "  Upgrade: ${YELLOW}nvm install 22 && nvm use 22${NC}\n"
    errors=$((errors + 1))
  fi
else
  printf "${RED}✗${NC} node — not found\n"
  printf "  Install: ${YELLOW}brew install nvm && nvm install 22${NC} or https://nodejs.org\n"
  errors=$((errors + 1))
fi

# ── pnpm ─────────────────────────────────────────────────────
if command -v pnpm &>/dev/null; then
  pnpm_ver=$(pnpm --version | cut -d. -f1-2)
  printf "${GREEN}✓${NC} pnpm %s\n" "$pnpm_ver"
else
  printf "${RED}✗${NC} pnpm — not found\n"
  printf "  Install: ${YELLOW}npm install -g pnpm${NC} or https://pnpm.io/installation\n"
  errors=$((errors + 1))
fi

# ── Python >= 3.12 ───────────────────────────────────────────
PYTHON_CMD=""
if command -v python3 &>/dev/null; then
  PYTHON_CMD="python3"
elif command -v python &>/dev/null; then
  PYTHON_CMD="python"
fi

if [ -n "$PYTHON_CMD" ]; then
  py_ver=$($PYTHON_CMD --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
  if version_gte "$py_ver" "3.12"; then
    printf "${GREEN}✓${NC} python %s\n" "$py_ver"
  else
    printf "${RED}✗${NC} python %s — need >= 3.12\n" "$py_ver"
    printf "  Upgrade: ${YELLOW}pyenv install 3.12 && pyenv global 3.12${NC}\n"
    errors=$((errors + 1))
  fi
else
  printf "${RED}✗${NC} python — not found\n"
  printf "  Install: ${YELLOW}brew install pyenv && pyenv install 3.12${NC} or https://python.org\n"
  errors=$((errors + 1))
fi

# ── uv ───────────────────────────────────────────────────────
if command -v uv &>/dev/null; then
  uv_ver=$(uv --version 2>&1 | grep -oE '[0-9]+\.[0-9]+')
  printf "${GREEN}✓${NC} uv %s\n" "$uv_ver"
else
  printf "${RED}✗${NC} uv — not found\n"
  printf "  Install: ${YELLOW}curl -LsSf https://astral.sh/uv/install.sh | sh${NC}\n"
  errors=$((errors + 1))
fi

# ── Docker ───────────────────────────────────────────────────
if command -v docker &>/dev/null; then
  docker_ver=$(docker --version | grep -oE '[0-9]+\.[0-9]+' | head -1)
  printf "${GREEN}✓${NC} docker %s\n" "$docker_ver"
else
  printf "${RED}✗${NC} docker — not found\n"
  printf "  Install: ${YELLOW}brew install --cask docker${NC} (macOS) or https://docs.docker.com/get-docker/\n"
  errors=$((errors + 1))
fi

# ── Summary ──────────────────────────────────────────────────
echo ""
if [ "$errors" -gt 0 ]; then
  printf "${RED}%d prerequisite(s) missing or outdated.${NC} Fix the issues above and retry.\n" "$errors"
  exit 1
else
  printf "${GREEN}All prerequisites satisfied!${NC}\n"
  exit 0
fi
