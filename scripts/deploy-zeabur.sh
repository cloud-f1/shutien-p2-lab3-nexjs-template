#!/usr/bin/env bash
# scripts/deploy-zeabur.sh — One-click Zeabur deployment
# Usage: bash scripts/deploy-zeabur.sh [--first-time | --redeploy | --status | --env-only]
#
# Modes:
#   --first-time   Full setup: project → services → env vars → deploy → domains
#   --redeploy     Re-deploy existing services (after code changes)
#   --status       Show current deployment status
#   --env-only     Push environment variables without redeploying
#   (default)      Interactive — detects existing project and acts accordingly

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Colors ────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Helpers ───────────────────────────────────────────────
info()  { printf "${CYAN}ℹ${NC}  %s\n" "$*"; }
ok()    { printf "${GREEN}✓${NC}  %s\n" "$*"; }
warn()  { printf "${YELLOW}⚠${NC}  %s\n" "$*"; }
err()   { printf "${RED}✗${NC}  %s\n" "$*" >&2; }
step()  { printf "\n${BOLD}━━━ Step %s ━━━${NC}\n" "$*"; }

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    python3 -c "import secrets; print(secrets.token_hex(32))"
  fi
}

# ── Parse flags ───────────────────────────────────────────
MODE="auto"
for arg in "$@"; do
  case "$arg" in
    --first-time) MODE="first-time" ;;
    --redeploy)   MODE="redeploy" ;;
    --status)     MODE="status" ;;
    --env-only)   MODE="env-only" ;;
    --help|-h)
      echo "Usage: bash scripts/deploy-zeabur.sh [--first-time | --redeploy | --status | --env-only]"
      exit 0 ;;
    *)
      err "Unknown flag: $arg"
      echo "Usage: bash scripts/deploy-zeabur.sh [--first-time | --redeploy | --status | --env-only]"
      exit 1 ;;
  esac
done

# ══════════════════════════════════════════════════════════
# Gate 0: Prerequisites
# ══════════════════════════════════════════════════════════
step "0: Prerequisites"

if ! command -v zeabur >/dev/null 2>&1; then
  err "Zeabur CLI not found. Install: npm i -g zeabur"
  exit 1
fi
ok "Zeabur CLI found ($(zeabur version 2>/dev/null || echo 'unknown'))"

# Check auth
if ! zeabur profile 2>/dev/null | grep -q "username"; then
  warn "Not logged in. Opening browser..."
  zeabur auth login
fi
ok "Authenticated"

# ══════════════════════════════════════════════════════════
# Gate 1: Git status check
# ══════════════════════════════════════════════════════════
step "1: Git Status"

cd "$PROJECT_ROOT"
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
  warn "Current branch is '$BRANCH' (not main)"
  read -r -p "Continue anyway? (y/N) " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    err "Aborted. Switch to main first: git checkout main"
    exit 1
  fi
fi

DIRTY=$(git status --porcelain 2>/dev/null | head -5)
if [ -n "$DIRTY" ]; then
  warn "Uncommitted changes detected:"
  echo "$DIRTY"
  echo ""
  read -r -p "Continue with uncommitted changes? (y/N) " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    err "Aborted. Commit first: git add -A && git commit"
    exit 1
  fi
fi
ok "Git status checked"

# ══════════════════════════════════════════════════════════
# Status mode — just show info and exit
# ══════════════════════════════════════════════════════════
if [ "$MODE" = "status" ]; then
  step "Status"
  echo ""
  info "Context:"
  zeabur context get 2>/dev/null || warn "No context set"
  echo ""
  info "Services:"
  zeabur service list 2>/dev/null || warn "No services found"
  echo ""
  info "Domains:"
  zeabur domain list 2>/dev/null || warn "No domains found"
  exit 0
fi

# ══════════════════════════════════════════════════════════
# Gate 2: Project setup
# ══════════════════════════════════════════════════════════
step "2: Project"

# Check if context already set
EXISTING_PROJECT=$(zeabur context get 2>/dev/null | grep -i "project" || true)

if [ -n "$EXISTING_PROJECT" ] && [ "$MODE" != "first-time" ]; then
  ok "Using existing project context"
  echo "  $EXISTING_PROJECT"
else
  info "Select or create a Zeabur project..."
  echo ""
  echo "  Options:"
  echo "    1) Select existing project (interactive)"
  echo "    2) Create new project"
  echo ""
  read -r -p "  Choice (1/2): " choice

  case "$choice" in
    2)
      read -r -p "  Project name [ai-coding-template]: " proj_name
      proj_name="${proj_name:-ai-coding-template}"
      zeabur project create --name "$proj_name"
      ok "Project '$proj_name' created"
      ;;
    *)
      info "Setting context interactively..."
      zeabur context set
      ;;
  esac
fi

# ══════════════════════════════════════════════════════════
# Gate 3: Environment variables
# ══════════════════════════════════════════════════════════
if [ "$MODE" = "first-time" ] || [ "$MODE" = "env-only" ] || [ "$MODE" = "auto" ]; then
  step "3: Environment Variables"

  # Generate .env.zeabur for server
  ENV_ZEABUR="$PROJECT_ROOT/.env.zeabur"

  if [ -f "$ENV_ZEABUR" ] && [ "$MODE" != "first-time" ]; then
    ok "Found existing .env.zeabur"
    read -r -p "  Regenerate? (y/N) " regen
    if [[ ! "$regen" =~ ^[Yy]$ ]]; then
      info "Keeping existing .env.zeabur"
    else
      rm -f "$ENV_ZEABUR"
    fi
  fi

  if [ ! -f "$ENV_ZEABUR" ]; then
    info "Generating production environment variables..."

    SECRET_KEY=$(generate_secret)
    REFRESH_SECRET_KEY=$(generate_secret)

    # Ask for domains
    echo ""
    read -r -p "  Server domain (e.g., api.example.zeabur.app): " API_DOMAIN
    read -r -p "  Client domain (e.g., app.example.zeabur.app): " CLIENT_DOMAIN

    # Ask for Zeabur Email API key (optional)
    echo ""
    info "Email setup (Zeabur Email service):"
    echo "  Create an API key at: Zeabur Dashboard → Email → API Keys"
    echo ""
    read -r -p "  Zeabur Email API key (Enter to skip — email logs to console): " ZEABUR_EMAIL_API_KEY

    if [ -n "$ZEABUR_EMAIL_API_KEY" ]; then
      EMAIL_PROVIDER="zeabur"
    else
      EMAIL_PROVIDER="console"
    fi

    (umask 077; cat > "$ENV_ZEABUR" <<EOF
# Zeabur Production Environment — Generated $(date +%Y-%m-%d)
# Push to server service: zeabur variable env -f .env.zeabur -n server

# ── Secrets (auto-generated) ──
SECRET_KEY=${SECRET_KEY}
REFRESH_SECRET_KEY=${REFRESH_SECRET_KEY}

# ── App Config ──
ENVIRONMENT=production
DEBUG=false
APP_VERSION=1.0.0
LOG_FORMAT=json

# ── CORS ──
ALLOWED_ORIGINS_STR=https://${CLIENT_DOMAIN:-localhost}

# ── Auth ──
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=30
RATE_LIMIT_AUTH=5/minute

# ── Email ──
EMAIL_PROVIDER=${EMAIL_PROVIDER}
ZEABUR_EMAIL_API_KEY=${ZEABUR_EMAIL_API_KEY:-}
EMAIL_FROM=noreply@${CLIENT_DOMAIN:-example.com}

# ── Optional ──
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
SENTRY_DSN=
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=
EOF
    )

    ok "Generated .env.zeabur (EMAIL_PROVIDER=${EMAIL_PROVIDER})"
    if [ "$EMAIL_PROVIDER" = "console" ]; then
      warn "Email set to console mode — emails will be logged, not sent."
      warn "To enable sending, add ZEABUR_EMAIL_API_KEY later."
    else
      warn "Review and edit .env.zeabur before pushing"
    fi
    echo ""
    printf "  ${CYAN}File:${NC} $ENV_ZEABUR\n"
  fi

  # Push env vars to server service
  echo ""
  read -r -p "  Push env vars to server service now? (y/N) " push_env
  if [[ "$push_env" =~ ^[Yy]$ ]]; then
    zeabur variable env -f "$ENV_ZEABUR" -n server
    ok "Environment variables pushed to server"
  fi

  # Set VITE_API_URL on client service
  if [ -n "${API_DOMAIN:-}" ]; then
    read -r -p "  Set VITE_API_URL on client service? (y/N) " set_vite
    if [[ "$set_vite" =~ ^[Yy]$ ]]; then
      zeabur variable create -n client -k VITE_API_URL -v "https://${API_DOMAIN}" -y
      ok "VITE_API_URL set on client"
    fi
  fi

  if [ "$MODE" = "env-only" ]; then
    echo ""
    ok "Environment variables updated. Done!"
    exit 0
  fi
fi

# ══════════════════════════════════════════════════════════
# Gate 4: Deploy services
# ══════════════════════════════════════════════════════════
step "4: Deploy"

if [ "$MODE" = "first-time" ]; then
  info "First-time deploy — uploading both services..."
  echo ""

  # Deploy server
  info "Deploying server..."
  cd "$PROJECT_ROOT/server"
  zeabur deploy --name server --create
  ok "Server deployed"

  # Deploy client (from root for pnpm workspace access)
  info "Deploying client..."
  cd "$PROJECT_ROOT"
  zeabur deploy --name client --create
  ok "Client deployed"

elif [ "$MODE" = "redeploy" ] || [ "$MODE" = "auto" ]; then
  echo ""
  echo "  Which service to redeploy?"
  echo "    1) server"
  echo "    2) client"
  echo "    3) both"
  echo ""
  read -r -p "  Choice (1/2/3): " svc_choice

  case "$svc_choice" in
    1)
      info "Redeploying server..."
      cd "$PROJECT_ROOT/server"
      zeabur deploy --name server
      ok "Server redeployed"
      ;;
    2)
      info "Redeploying client..."
      cd "$PROJECT_ROOT"
      zeabur deploy --name client
      ok "Client redeployed"
      ;;
    3)
      info "Redeploying both services..."
      cd "$PROJECT_ROOT/server"
      zeabur deploy --name server
      ok "Server redeployed"
      cd "$PROJECT_ROOT"
      zeabur deploy --name client
      ok "Client redeployed"
      ;;
    *)
      warn "Invalid choice — skipping redeploy."
      ;;
  esac
fi

# ══════════════════════════════════════════════════════════
# Gate 5: Domain setup (first-time only)
# ══════════════════════════════════════════════════════════
if [ "$MODE" = "first-time" ]; then
  step "5: Domains"

  echo ""
  read -r -p "  Set up custom domains? (y/N) " setup_domains
  if [[ "$setup_domains" =~ ^[Yy]$ ]]; then
    # Generate Zeabur domains
    info "Creating domains..."
    zeabur domain create -n server -g -y || true
    zeabur domain create -n client -g -y || true
    ok "Generated domains created"

    echo ""
    info "Custom domains (optional):"
    read -r -p "  Custom server domain (Enter to skip): " custom_api
    if [ -n "$custom_api" ]; then
      zeabur domain create -n server --domain "$custom_api" -y
      ok "Server domain: $custom_api"
    fi

    read -r -p "  Custom client domain (Enter to skip): " custom_client
    if [ -n "$custom_client" ]; then
      zeabur domain create -n client --domain "$custom_client" -y
      ok "Client domain: $custom_client"
    fi
  else
    info "Skipped domain setup. Configure in Zeabur dashboard later."
  fi
fi

# ══════════════════════════════════════════════════════════
# Gate 6: Verification
# ══════════════════════════════════════════════════════════
step "6: Verification"

echo ""
info "Deployed services:"
zeabur service list 2>/dev/null || true
echo ""
info "Domains:"
zeabur domain list 2>/dev/null || true
echo ""
info "Email provider: ${EMAIL_PROVIDER:-unknown}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
printf "  ${GREEN}${BOLD}Deployment complete!${NC}\n"
echo ""
echo "  Next steps:"
echo "    1. Wait 2-3 minutes for services to build"
echo "    2. Check server health: curl https://<server-domain>/health"
echo "    3. Visit client: https://<client-domain>"
if [ "${EMAIL_PROVIDER:-}" = "console" ]; then
echo "    4. Enable email sending:"
echo "       - Go to Zeabur Dashboard → Email → API Keys"
echo "       - Create an API key, then update env vars:"
echo "         bash scripts/deploy-zeabur.sh --env-only"
fi
echo ""
echo "  Useful commands:"
echo "    bash scripts/deploy-zeabur.sh --status     # Check status"
echo "    bash scripts/deploy-zeabur.sh --redeploy   # Redeploy services"
echo "    bash scripts/deploy-zeabur.sh --env-only   # Update env vars"
echo ""
echo "    zeabur service list                        # List services"
echo "    zeabur domain list                         # List domains"
echo "    zeabur variable list -n server             # Show server env"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
