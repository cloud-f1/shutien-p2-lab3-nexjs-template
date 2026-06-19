#!/usr/bin/env bash
# deploy/deploy-zeabur.sh — One-service Zeabur deploy helper for the Next.js app
# Usage: bash deploy/deploy-zeabur.sh [--first-time | --redeploy | --status | --env-only]
#
# This repo is a SINGLE Next.js service (next-app/ — App Router + Drizzle + Auth.js v5).
# The old FastAPI server/ + Vite client/ split is gone — there is no API service, no
# VITE_API_URL, no SECRET_KEY/REFRESH_SECRET_KEY. This helper deploys ONE `web` service
# alongside a Zeabur-managed PostgreSQL.
#
# Modes:
#   --first-time   Full setup: project -> env vars -> deploy -> domain -> migrate
#   --redeploy     Re-deploy the existing web service (after code changes)
#   --status       Show current deployment status
#   --env-only     Push environment variables without redeploying
#   (default)      Interactive — detects existing project and acts accordingly
#
# For the full reproducible runbook see docs/guides/deployment-zeabur.md or the
# `deploy-config` skill (covers both Zeabur and GCP Cloud Run).
#
# NON-INTERACTIVE / HEADLESS AUTOMATION: For CI pipelines, dedicated-server targeting,
# or fork automation, use the zeabur-deploy skill instead — it encodes the exact
# --json -i=false CLI flow, PostgreSQL via template B20CX0, and local-machine migration
# (the standalone runtime has no drizzle-kit):
#   → .claude/skills/zeabur-deploy/SKILL.md  (invoke /zeabur-deploy in Claude Code)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVICE="web"

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

# AUTH_SECRET is an Auth.js v5 JWT signing key — base64, not hex (matches
# `openssl rand -base64 32`, the value docs + the Makefile generate).
generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -base64 32
  else
    python3 -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"
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
      echo "Usage: bash deploy/deploy-zeabur.sh [--first-time | --redeploy | --status | --env-only]"
      exit 0 ;;
    *)
      err "Unknown flag: $arg"
      echo "Usage: bash deploy/deploy-zeabur.sh [--first-time | --redeploy | --status | --env-only]"
      exit 1 ;;
  esac
done

# ══════════════════════════════════════════════════════════
# Gate 0: Prerequisites
# ══════════════════════════════════════════════════════════
step "0: Prerequisites"

if ! command -v zeabur >/dev/null 2>&1; then
  err "Zeabur CLI not found. Install: npm i -g @zeabur/cli  (or: make install-deploy-tools)"
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
      read -r -p "  Project name [my-saas]: " proj_name
      proj_name="${proj_name:-my-saas}"
      zeabur project create --name "$proj_name"
      ok "Project '$proj_name' created"
      ;;
    *)
      info "Setting context interactively..."
      zeabur context set
      ;;
  esac
fi

if [ "$MODE" = "first-time" ]; then
  echo ""
  info "Reminder: this app needs a PostgreSQL service in the same project."
  echo "  Add one via the dashboard (Marketplace → PostgreSQL) or:"
  echo "    zeabur service create --template postgresql --name postgres"
  echo "  Then copy its DATABASE_URL for the env step below."
  echo ""
fi

# ══════════════════════════════════════════════════════════
# Gate 3: Environment variables
# ══════════════════════════════════════════════════════════
if [ "$MODE" = "first-time" ] || [ "$MODE" = "env-only" ] || [ "$MODE" = "auto" ]; then
  step "3: Environment Variables"

  # Generate .env.zeabur for the single web service
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
    info "Generating production environment variables for the '$SERVICE' service..."

    AUTH_SECRET=$(generate_secret)

    # Ask for the deploy domain + database URL
    echo ""
    info "Database (Zeabur-managed PostgreSQL):"
    echo "  Copy DATABASE_URL from the PostgreSQL service → Variables tab,"
    echo "  or: zeabur env get DATABASE_URL --service postgres"
    echo ""
    read -r -p "  DATABASE_URL (postgresql://...): " DATABASE_URL

    echo ""
    info "App domain — your Zeabur or custom domain (with https://):"
    read -r -p "  APP_URL (e.g. https://my-saas.zeabur.app): " APP_URL
    APP_URL="${APP_URL%/}"  # strip trailing slash

    # Ask for email (SMTP) — verification + reset emails
    echo ""
    info "Email (SMTP) — for verification + password-reset links (Enter to skip):"
    read -r -p "  SMTP_HOST: " SMTP_HOST
    read -r -p "  SMTP_PORT [587]: " SMTP_PORT_INPUT
    SMTP_PORT="${SMTP_PORT_INPUT:-587}"
    read -r -p "  SMTP_USER (Enter to skip): " SMTP_USER
    read -r -p "  SMTP_PASS (Enter to skip): " SMTP_PASS
    read -r -p "  EMAIL_FROM [noreply@example.com]: " EMAIL_FROM_INPUT
    EMAIL_FROM="${EMAIL_FROM_INPUT:-noreply@example.com}"

    (umask 077; cat > "$ENV_ZEABUR" <<EOF
# Zeabur Production Environment — Generated $(date +%Y-%m-%d)
# Push to the web service: zeabur variable env -f .env.zeabur -n ${SERVICE}
#
# NOTE: NEXT_PUBLIC_* values are baked at BUILD time. After changing them you
# must REDEPLOY (a restart will not pick them up). Runtime-only vars
# (DATABASE_URL, AUTH_SECRET, AUTH_URL, SMTP_*) take effect on restart.

# ── Database (Zeabur-managed PostgreSQL) ──
DATABASE_URL=${DATABASE_URL}

# ── Auth.js v5 (JWT sessions) ──
AUTH_SECRET=${AUTH_SECRET}
AUTH_URL=${APP_URL}
AUTH_TRUST_HOST=true

# ── Public base URL (build-time NEXT_PUBLIC_* — also pass as a build-arg) ──
NEXT_PUBLIC_APP_URL=${APP_URL}
# Production: never ship the demo quick-login buttons.
NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false

# ── App config ──
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1

# ── Email (SMTP) ──
SMTP_HOST=${SMTP_HOST:-}
SMTP_PORT=${SMTP_PORT}
SMTP_USER=${SMTP_USER:-}
SMTP_PASS=${SMTP_PASS:-}
SMTP_SECURE=false
EMAIL_FROM=${EMAIL_FROM}

# ── Optional: Stripe billing (set if using @saas/billing-stripe) ──
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# ── Optional: ECPay 綠界 billing (set if using @saas/billing-ecpay) ──
ECPAY_MERCHANT_ID=
ECPAY_HASH_KEY=
ECPAY_HASH_IV=
EOF
    )

    ok "Generated .env.zeabur (AUTH_SECRET auto-generated, demo login disabled)"
    if [ -z "${SMTP_HOST:-}" ]; then
      warn "SMTP left blank — verification + reset emails will fail until SMTP_* is set."
    fi
    echo ""
    printf "  ${CYAN}File:${NC} %s\n" "$ENV_ZEABUR"
    warn "NEXT_PUBLIC_APP_URL is baked at build time — also pass it as a"
    warn "build-arg (or set it before the build) so email/payment links are correct."
  fi

  # Push env vars to the web service
  echo ""
  read -r -p "  Push env vars to the '$SERVICE' service now? (y/N) " push_env
  if [[ "$push_env" =~ ^[Yy]$ ]]; then
    zeabur variable env -f "$ENV_ZEABUR" -n "$SERVICE"
    ok "Environment variables pushed to '$SERVICE'"
    warn "Redeploy so build-time NEXT_PUBLIC_* values take effect:"
    echo "    bash deploy/deploy-zeabur.sh --redeploy"
  fi

  if [ "$MODE" = "env-only" ]; then
    echo ""
    ok "Environment variables updated. Done!"
    exit 0
  fi
fi

# ══════════════════════════════════════════════════════════
# Gate 4: Deploy the web service
# ══════════════════════════════════════════════════════════
step "4: Deploy"

if [ "$MODE" = "first-time" ]; then
  info "First-time deploy — uploading the Next.js '$SERVICE' service (root: next-app/)..."
  zeabur deploy --name "$SERVICE" --create
  ok "'$SERVICE' deployed"
elif [ "$MODE" = "redeploy" ] || [ "$MODE" = "auto" ]; then
  info "Redeploying the '$SERVICE' service (root: next-app/)..."
  zeabur deploy --name "$SERVICE"
  ok "'$SERVICE' redeployed"
fi

# ══════════════════════════════════════════════════════════
# Post-deploy smoke test
# ══════════════════════════════════════════════════════════
if [ -n "${APP_URL:-}" ]; then
  step "4b: Smoke Test"
  info "Waiting 10s for the service to start..."
  sleep 10
  info "Checking $APP_URL ..."

  RETRIES=3
  SMOKE_OK=false
  for i in $(seq 1 $RETRIES); do
    if curl -sf -o /dev/null --max-time 10 "$APP_URL"; then
      SMOKE_OK=true
      break
    fi
    warn "Attempt $i/$RETRIES failed — retrying in 10s..."
    sleep 10
  done

  if [ "$SMOKE_OK" = true ]; then
    ok "Reachable: $APP_URL"
  else
    warn "Service not reachable after $RETRIES attempts."
    warn "It may still be building. Check manually:"
    echo "  curl -I $APP_URL"
  fi
fi

# ══════════════════════════════════════════════════════════
# Gate 5: Domain setup (first-time only)
# ══════════════════════════════════════════════════════════
if [ "$MODE" = "first-time" ]; then
  step "5: Domain"

  echo ""
  read -r -p "  Set up a domain for the '$SERVICE' service? (y/N) " setup_domains
  if [[ "$setup_domains" =~ ^[Yy]$ ]]; then
    info "Creating a generated Zeabur domain..."
    zeabur domain create -n "$SERVICE" -g -y || true
    ok "Generated domain created"

    echo ""
    info "Custom domain (optional):"
    read -r -p "  Custom domain (Enter to skip): " custom_domain
    if [ -n "$custom_domain" ]; then
      zeabur domain create -n "$SERVICE" --domain "$custom_domain" -y
      ok "Domain: $custom_domain"
      warn "Update AUTH_URL + NEXT_PUBLIC_APP_URL to https://$custom_domain, then redeploy."
    fi
  else
    info "Skipped domain setup. Configure in the Zeabur dashboard later."
  fi
fi

# ══════════════════════════════════════════════════════════
# Gate 6: Database migration reminder (first-time only)
# ══════════════════════════════════════════════════════════
if [ "$MODE" = "first-time" ]; then
  step "6: Database Migration"
  echo ""
  info "The schema must be created before the app can serve requests."
  echo "  Run migrations (idempotent) against the managed DB:"
  echo "    zeabur exec --service $SERVICE -- pnpm db:migrate"
  echo ""
  echo "  Optional — seed demo data (dev accounts):"
  echo "    zeabur exec --service $SERVICE -- pnpm db:seed"
  echo ""
  read -r -p "  Run 'pnpm db:migrate' now via zeabur exec? (y/N) " run_migrate
  if [[ "$run_migrate" =~ ^[Yy]$ ]]; then
    zeabur exec --service "$SERVICE" -- pnpm db:migrate && ok "Migrations applied" \
      || warn "Migrate failed — run it manually once the build finishes."
  fi
fi

# ══════════════════════════════════════════════════════════
# Gate 7: Verification
# ══════════════════════════════════════════════════════════
step "7: Verification"

echo ""
info "Services:"
zeabur service list 2>/dev/null || true
echo ""
info "Domains:"
zeabur domain list 2>/dev/null || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
printf "  ${GREEN}${BOLD}Deployment complete!${NC}\n"
echo ""
echo "  Next steps:"
echo "    1. Wait 2-3 minutes for the service to build"
echo "    2. Run migrations:  zeabur exec --service $SERVICE -- pnpm db:migrate"
echo "    3. Visit your app:  https://<your-domain>"
echo ""
echo "  Useful commands:"
echo "    bash deploy/deploy-zeabur.sh --status     # Check status"
echo "    bash deploy/deploy-zeabur.sh --redeploy   # Redeploy the web service"
echo "    bash deploy/deploy-zeabur.sh --env-only   # Update env vars"
echo ""
echo "    zeabur service list                       # List services"
echo "    zeabur domain list                        # List domains"
echo "    zeabur variable list -n $SERVICE              # Show web env"
echo ""
echo "  Full runbook: docs/guides/deployment-zeabur.md  (or the deploy-config skill)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
