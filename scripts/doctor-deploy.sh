#!/usr/bin/env bash
# scripts/doctor-deploy.sh — Platform-specific deploy prerequisites checker
# Usage: bash scripts/doctor-deploy.sh [zeabur|cloudrun]
# Called by `make doctor-deploy PLATFORM=<platform>`.
# Exit 0 = all checks pass, exit 1 = issues found.

set -uo pipefail

PLATFORM="${1:-}"

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

# ── Platform selection ────────────────────────────────────────
if [ -z "$PLATFORM" ]; then
  echo ""
  printf "${CYAN}Deploy Prerequisites Checker${NC}\n"
  echo ""
  echo "Which platform?"
  echo "  1. Zeabur"
  echo "  2. Cloud Run"
  read -r -p "Choice [1/2]: " choice
  case "$choice" in
    1) PLATFORM="zeabur" ;;
    2) PLATFORM="cloudrun" ;;
    *) echo "Invalid choice"; exit 1 ;;
  esac
fi

PLATFORM=$(echo "$PLATFORM" | tr '[:upper:]' '[:lower:]')

if [ "$PLATFORM" != "zeabur" ] && [ "$PLATFORM" != "cloudrun" ]; then
  echo "Unknown platform: $PLATFORM"
  echo "Usage: $0 [zeabur|cloudrun]"
  exit 1
fi

echo ""
printf "${CYAN}Deploy Prerequisites — %s${NC}\n" "$PLATFORM"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ═══════════════════════════════════════════════════════════════
# Zeabur Checks
# ═══════════════════════════════════════════════════════════════
if [ "$PLATFORM" = "zeabur" ]; then

  # Node.js
  printf "${CYAN}Runtime${NC}\n"
  if command -v node &>/dev/null; then
    pass "Node.js $(node --version) installed"
  else
    fail "Node.js not found" "Install Node.js: nvm install 22 (or: brew install node)"
  fi

  echo ""

  # Zeabur CLI
  printf "${CYAN}Zeabur CLI${NC}\n"
  if command -v zeabur &>/dev/null; then
    pass "zeabur CLI installed ($(zeabur --version 2>&1 | head -1))"
  elif command -v npx &>/dev/null; then
    pass "zeabur CLI available via npx (npx zeabur)"
  else
    fail "zeabur CLI not found" "npm install -g @zeabur/cli  (or use: npx zeabur)"
  fi

  # Zeabur auth
  if command -v zeabur &>/dev/null; then
    if zeabur auth status &>/dev/null; then
      pass "Zeabur authenticated"
    else
      fail "Zeabur not authenticated" "zeabur auth login"
    fi
  elif command -v npx &>/dev/null; then
    if npx zeabur auth status &>/dev/null; then
      pass "Zeabur authenticated (via npx)"
    else
      fail "Zeabur not authenticated" "npx zeabur auth login"
    fi
  else
    fail "Cannot check Zeabur auth — CLI not available" "npm install -g @zeabur/cli && zeabur auth login"
  fi

  echo ""

  # Git remote
  printf "${CYAN}Git${NC}\n"
  if git remote get-url origin &>/dev/null; then
    pass "Git remote 'origin' configured ($(git remote get-url origin))"
  else
    fail "No git remote 'origin' set" "git remote add origin <your-github-repo-url>"
  fi

fi

# ═══════════════════════════════════════════════════════════════
# Cloud Run Checks
# ═══════════════════════════════════════════════════════════════
if [ "$PLATFORM" = "cloudrun" ]; then

  # Docker
  printf "${CYAN}Docker${NC}\n"
  if command -v docker &>/dev/null; then
    pass "Docker installed ($(docker --version | grep -oE '[0-9]+\.[0-9]+' | head -1))"
    # Check Docker daemon
    if docker info &>/dev/null; then
      pass "Docker daemon is running"
    else
      fail "Docker daemon is not running" "Start Docker Desktop (or: sudo systemctl start docker)"
    fi
  else
    fail "Docker not found" "Install Docker Desktop: https://docs.docker.com/get-docker/"
  fi

  echo ""

  # gcloud CLI
  printf "${CYAN}Google Cloud CLI${NC}\n"
  if command -v gcloud &>/dev/null; then
    pass "gcloud CLI installed ($(gcloud --version 2>&1 | head -1 | grep -oE '[0-9]+\.[0-9]+' || echo 'unknown'))"
  else
    fail "gcloud CLI not found" "Install: https://cloud.google.com/sdk/docs/install  (or: brew install google-cloud-sdk)"
    # Skip remaining gcloud checks
    echo ""
    printf "${CYAN}Skipping remaining GCP checks — gcloud not installed${NC}\n"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    printf "${RED}%d issue(s)${NC} found out of %d checks. Fix the items above and re-run ${YELLOW}make doctor-deploy PLATFORM=cloudrun${NC}.\n" "$issues" "$checks"
    exit 1
  fi

  # gcloud auth
  auth_account=$(gcloud auth list --filter="status:ACTIVE" --format="value(account)" 2>/dev/null)
  if [ -n "$auth_account" ]; then
    pass "gcloud authenticated as $auth_account"
  else
    fail "gcloud not authenticated" "gcloud auth login"
  fi

  # GCP project
  gcp_project=$(gcloud config get-value project 2>/dev/null)
  if [ -n "$gcp_project" ] && [ "$gcp_project" != "(unset)" ]; then
    pass "GCP project set: $gcp_project"
  else
    fail "No GCP project set" "gcloud config set project <your-project-id>"
  fi

  echo ""

  # Required APIs
  printf "${CYAN}Required APIs${NC}\n"
  if [ -n "$gcp_project" ] && [ "$gcp_project" != "(unset)" ]; then
    for api in run.googleapis.com artifactregistry.googleapis.com; do
      if gcloud services list --enabled --filter="name:$api" --format="value(name)" 2>/dev/null | grep -q "$api"; then
        pass "$api enabled"
      else
        fail "$api not enabled" "gcloud services enable $api"
      fi
    done
  else
    fail "Cannot check APIs — no project set" "gcloud config set project <your-project-id>"
  fi

fi

echo ""

# ═══════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ "$issues" -eq 0 ]; then
  printf "${GREEN}All %d checks passed!${NC} Ready to deploy to %s.\n" "$checks" "$PLATFORM"
  exit 0
else
  printf "${RED}%d issue(s)${NC} found out of %d checks. Fix the items above and re-run ${YELLOW}make doctor-deploy PLATFORM=%s${NC}.\n" "$issues" "$checks" "$PLATFORM"
  exit 1
fi
