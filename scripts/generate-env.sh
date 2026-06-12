#!/usr/bin/env bash
# scripts/generate-env.sh — Interactive .env generator with random secrets
# Usage: bash scripts/generate-env.sh [--force]
# Called by `make go` (via ensure-env) if server/.env doesn't exist.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/server/.env"
ENV_EXAMPLE="$PROJECT_ROOT/server/.env.example"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── Parse flags ──────────────────────────────────────────────
FORCE=false
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=true ;;
  esac
done

# ── Guard: skip if .env exists (unless --force) ─────────────
if [ -f "$ENV_FILE" ] && [ "$FORCE" = false ]; then
  printf "${GREEN}✓${NC} server/.env already exists — skipping. Use ${YELLOW}--force${NC} to regenerate.\n"
  exit 0
fi

# ── Generate random secret ──────────────────────────────────
generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  elif command -v python3 >/dev/null 2>&1; then
    python3 -c "import secrets; print(secrets.token_hex(32))"
  elif command -v python >/dev/null 2>&1; then
    python -c "import secrets; print(secrets.token_hex(32))"
  else
    echo "ERROR: Neither openssl nor python found — cannot generate secrets." >&2
    exit 1
  fi
}

# ── Start from example ──────────────────────────────────────
if [ ! -f "$ENV_EXAMPLE" ]; then
  echo "ERROR: server/.env.example not found." >&2
  exit 1
fi

cp "$ENV_EXAMPLE" "$ENV_FILE"

# ── Replace placeholder secrets ─────────────────────────────
SECRET_KEY=$(generate_secret)
REFRESH_SECRET_KEY=$(generate_secret)

if [ "$(uname)" = "Darwin" ]; then
  sed -i '' "s|CHANGE_ME_TO_A_RANDOM_64_CHAR_HEX_STRING|$SECRET_KEY|" "$ENV_FILE"
  sed -i '' "s|CHANGE_ME_REFRESH_SECRET|$REFRESH_SECRET_KEY|" "$ENV_FILE"
else
  sed -i "s|CHANGE_ME_TO_A_RANDOM_64_CHAR_HEX_STRING|$SECRET_KEY|" "$ENV_FILE"
  sed -i "s|CHANGE_ME_REFRESH_SECRET|$REFRESH_SECRET_KEY|" "$ENV_FILE"
fi

printf "${GREEN}✓${NC} Generated random SECRET_KEY and REFRESH_SECRET_KEY\n"

# ── Interactive: optional features ──────────────────────────
# Only prompt if stdin is a terminal (skip in CI / non-interactive)
if [ -t 0 ]; then
  echo ""
  printf "${CYAN}Optional integrations${NC} (press Enter to skip all):\n"
  echo ""

  # ── Google OAuth ──
  read -r -p "Enable Google OAuth? (y/N) " enable_google
  if [[ "$enable_google" =~ ^[Yy]$ ]]; then
    read -r -p "  Google Client ID: " google_id
    read -r -p "  Google Client Secret: " google_secret
    if [ -n "$google_id" ] && [ -n "$google_secret" ]; then
      if [ "$(uname)" = "Darwin" ]; then
        sed -i '' "s|# GOOGLE_CLIENT_ID=.*|GOOGLE_CLIENT_ID=$google_id|" "$ENV_FILE"
        sed -i '' "s|# GOOGLE_CLIENT_SECRET=.*|GOOGLE_CLIENT_SECRET=$google_secret|" "$ENV_FILE"
      else
        sed -i "s|# GOOGLE_CLIENT_ID=.*|GOOGLE_CLIENT_ID=$google_id|" "$ENV_FILE"
        sed -i "s|# GOOGLE_CLIENT_SECRET=.*|GOOGLE_CLIENT_SECRET=$google_secret|" "$ENV_FILE"
      fi
      printf "  ${GREEN}✓${NC} Google OAuth configured\n"
    fi
  fi

  # ── GitHub OAuth ──
  read -r -p "Enable GitHub OAuth? (y/N) " enable_github
  if [[ "$enable_github" =~ ^[Yy]$ ]]; then
    read -r -p "  GitHub Client ID: " github_id
    read -r -p "  GitHub Client Secret: " github_secret
    if [ -n "$github_id" ] && [ -n "$github_secret" ]; then
      if [ "$(uname)" = "Darwin" ]; then
        sed -i '' "s|# GITHUB_CLIENT_ID=.*|GITHUB_CLIENT_ID=$github_id|" "$ENV_FILE"
        sed -i '' "s|# GITHUB_CLIENT_SECRET=.*|GITHUB_CLIENT_SECRET=$github_secret|" "$ENV_FILE"
      else
        sed -i "s|# GITHUB_CLIENT_ID=.*|GITHUB_CLIENT_ID=$github_id|" "$ENV_FILE"
        sed -i "s|# GITHUB_CLIENT_SECRET=.*|GITHUB_CLIENT_SECRET=$github_secret|" "$ENV_FILE"
      fi
      printf "  ${GREEN}✓${NC} GitHub OAuth configured\n"
    fi
  fi

  # ── Stripe ──
  read -r -p "Enable Stripe billing? (y/N) " enable_stripe
  if [[ "$enable_stripe" =~ ^[Yy]$ ]]; then
    read -r -p "  Stripe Secret Key (sk_test_...): " stripe_sk
    read -r -p "  Stripe Publishable Key (pk_test_...): " stripe_pk
    if [ -n "$stripe_sk" ] && [ -n "$stripe_pk" ]; then
      if [ "$(uname)" = "Darwin" ]; then
        sed -i '' "s|# STRIPE_SECRET_KEY=.*|STRIPE_SECRET_KEY=$stripe_sk|" "$ENV_FILE"
        sed -i '' "s|# STRIPE_PUBLISHABLE_KEY=.*|STRIPE_PUBLISHABLE_KEY=$stripe_pk|" "$ENV_FILE"
      else
        sed -i "s|# STRIPE_SECRET_KEY=.*|STRIPE_SECRET_KEY=$stripe_sk|" "$ENV_FILE"
        sed -i "s|# STRIPE_PUBLISHABLE_KEY=.*|STRIPE_PUBLISHABLE_KEY=$stripe_pk|" "$ENV_FILE"
      fi
      printf "  ${GREEN}✓${NC} Stripe configured\n"
    fi
  fi
fi

echo ""
printf "${GREEN}✅ server/.env created successfully.${NC}\n"
printf "   Run ${YELLOW}make doctor${NC} to verify your environment.\n"
