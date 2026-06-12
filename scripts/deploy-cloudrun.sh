#!/usr/bin/env bash
# scripts/deploy-cloudrun.sh — Interactive Cloud Run deployment
# Usage: bash scripts/deploy-cloudrun.sh [--first-time | --redeploy | --status | --env-only]
#
# Modes:
#   --first-time   Full guided setup (all 8 gates)
#   --redeploy     Rebuild images + redeploy (skip setup gates)
#   --status       Show current Cloud Run service status
#   --env-only     Update env vars without rebuilding
#   (default)      Interactive — detects existing config and acts accordingly

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONFIG_FILE="$PROJECT_ROOT/.deploy-cloudrun.env"

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
step()  { printf "\n${BOLD}━━━ Gate %s ━━━${NC}\n" "$*"; }

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    python3 -c "import secrets; print(secrets.token_hex(32))"
  fi
}

# Load saved config if exists
load_config() {
  if [ -f "$CONFIG_FILE" ]; then
    # shellcheck disable=SC1090
    source "$CONFIG_FILE"
    return 0
  fi
  return 1
}

# Save config for future runs
save_config() {
  (umask 077; cat > "$CONFIG_FILE" <<EOF
# Cloud Run Deploy Config — Generated $(date +%Y-%m-%d)
# Used by deploy-cloudrun.sh for --redeploy and --env-only modes
GCP_PROJECT=${GCP_PROJECT:-}
GCP_REGION=${GCP_REGION:-}
REPO_NAME=${REPO_NAME:-}
SERVER_SERVICE=${SERVER_SERVICE:-server}
CLIENT_SERVICE=${CLIENT_SERVICE:-client}
DATABASE_URL=${DATABASE_URL:-}
SERVER_URL=${SERVER_URL:-}
CLIENT_URL=${CLIENT_URL:-}
EOF
  )
  ok "Config saved to .deploy-cloudrun.env"
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
      echo "Usage: bash scripts/deploy-cloudrun.sh [--first-time | --redeploy | --status | --env-only]"
      echo ""
      echo "Modes:"
      echo "  --first-time   Full guided setup (all 8 gates)"
      echo "  --redeploy     Rebuild images + redeploy (skip gates 2-4)"
      echo "  --status       Show current Cloud Run service status"
      echo "  --env-only     Update env vars without rebuilding"
      exit 0 ;;
    *)
      err "Unknown flag: $arg"
      echo "Usage: bash scripts/deploy-cloudrun.sh [--first-time | --redeploy | --status | --env-only]"
      exit 1 ;;
  esac
done

echo ""
printf "${BOLD}${CYAN}Cloud Run Deploy${NC}\n"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ══════════════════════════════════════════════════════════
# Gate 0: Prerequisites (delegate to doctor-deploy.sh)
# ══════════════════════════════════════════════════════════
step "0: Prerequisites"

if [ ! -f "$SCRIPT_DIR/doctor-deploy.sh" ]; then
  err "doctor-deploy.sh not found at $SCRIPT_DIR/"
  err "Fix: Ensure scripts/doctor-deploy.sh exists (from E120)"
  exit 1
fi

if ! bash "$SCRIPT_DIR/doctor-deploy.sh" cloudrun; then
  echo ""
  err "Prerequisites check failed. Fix the issues above and re-run."
  exit 1
fi
ok "All prerequisites passed"

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
ok "Git status checked (branch: $BRANCH)"

# ══════════════════════════════════════════════════════════
# Status mode — show info and exit
# ══════════════════════════════════════════════════════════
if [ "$MODE" = "status" ]; then
  step "Status"

  if load_config; then
    info "Saved config: project=$GCP_PROJECT, region=$GCP_REGION"
  else
    # Try to detect from gcloud
    GCP_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "(unset)")
    GCP_REGION="${GCP_REGION:-us-central1}"
    info "Detected project: $GCP_PROJECT"
  fi

  echo ""
  info "Server service:"
  gcloud run services describe "${SERVER_SERVICE:-server}" \
    --region="${GCP_REGION:-us-central1}" \
    --format="table(status.url, status.conditions[0].status, spec.template.spec.containerConcurrency, spec.template.metadata.annotations.'autoscaling.knative.dev/minScale', spec.template.metadata.annotations.'autoscaling.knative.dev/maxScale')" \
    2>/dev/null || warn "Server service not found"

  echo ""
  info "Client service:"
  gcloud run services describe "${CLIENT_SERVICE:-client}" \
    --region="${GCP_REGION:-us-central1}" \
    --format="table(status.url, status.conditions[0].status, spec.template.spec.containerConcurrency, spec.template.metadata.annotations.'autoscaling.knative.dev/minScale', spec.template.metadata.annotations.'autoscaling.knative.dev/maxScale')" \
    2>/dev/null || warn "Client service not found"

  echo ""
  info "Recent revisions (server):"
  gcloud run revisions list --service="${SERVER_SERVICE:-server}" \
    --region="${GCP_REGION:-us-central1}" \
    --format="table(metadata.name, status.conditions[0].status, metadata.creationTimestamp)" \
    --limit=3 2>/dev/null || true

  echo ""
  info "Recent revisions (client):"
  gcloud run revisions list --service="${CLIENT_SERVICE:-client}" \
    --region="${GCP_REGION:-us-central1}" \
    --format="table(metadata.name, status.conditions[0].status, metadata.creationTimestamp)" \
    --limit=3 2>/dev/null || true

  exit 0
fi

# ══════════════════════════════════════════════════════════
# For --redeploy and --env-only, load saved config
# ══════════════════════════════════════════════════════════
if [ "$MODE" = "redeploy" ] || [ "$MODE" = "env-only" ]; then
  if load_config; then
    ok "Loaded saved config (project=$GCP_PROJECT, region=$GCP_REGION)"
  else
    err "No saved config found at .deploy-cloudrun.env"
    err "Fix: Run with --first-time first, or create .deploy-cloudrun.env manually"
    exit 1
  fi
fi

# ══════════════════════════════════════════════════════════
# Gate 2: GCP Project setup (skip for --redeploy, --env-only)
# ══════════════════════════════════════════════════════════
if [ "$MODE" = "first-time" ] || [ "$MODE" = "auto" ]; then
  step "2: GCP Project"

  # Detect current project
  CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")

  if [ -n "$CURRENT_PROJECT" ] && [ "$CURRENT_PROJECT" != "(unset)" ] && [ "$MODE" != "first-time" ]; then
    ok "Using current GCP project: $CURRENT_PROJECT"
    GCP_PROJECT="$CURRENT_PROJECT"
  else
    echo ""
    info "GCP Project setup"
    echo ""

    # List existing projects
    info "Your GCP projects:"
    gcloud projects list --format="table(projectId, name, projectNumber)" 2>/dev/null || true
    echo ""

    echo "  Options:"
    echo "    1) Use current project ($CURRENT_PROJECT)"
    echo "    2) Select a different project"
    echo "    3) Create a new project"
    echo ""
    read -r -p "  Choice [1/2/3]: " proj_choice

    case "$proj_choice" in
      1)
        GCP_PROJECT="${CURRENT_PROJECT}"
        ;;
      2)
        read -r -p "  Project ID: " GCP_PROJECT
        gcloud config set project "$GCP_PROJECT"
        ok "Switched to project: $GCP_PROJECT"
        ;;
      3)
        read -r -p "  New project ID (lowercase, hyphens ok): " GCP_PROJECT
        gcloud projects create "$GCP_PROJECT" 2>/dev/null || {
          err "Failed to create project. The ID may already be taken."
          err "Fix: Choose a different project ID or use an existing project"
          exit 1
        }
        gcloud config set project "$GCP_PROJECT"
        ok "Created and selected project: $GCP_PROJECT"

        # Enable billing reminder
        warn "IMPORTANT: Enable billing for this project before proceeding!"
        echo "  Visit: https://console.cloud.google.com/billing/linkedaccount?project=$GCP_PROJECT"
        read -r -p "  Press Enter when billing is enabled..." _
        ;;
      *)
        GCP_PROJECT="${CURRENT_PROJECT}"
        ;;
    esac
  fi

  # Region selection
  echo ""
  info "Select deployment region:"
  echo "  Popular options:"
  echo "    1) us-central1      (Iowa — lowest cost)"
  echo "    2) us-east1          (South Carolina)"
  echo "    3) europe-west1      (Belgium)"
  echo "    4) asia-east1        (Taiwan)"
  echo "    5) asia-northeast1   (Tokyo)"
  echo "    6) Custom region"
  echo ""
  read -r -p "  Choice [1-6, default=1]: " region_choice

  case "${region_choice:-1}" in
    1) GCP_REGION="us-central1" ;;
    2) GCP_REGION="us-east1" ;;
    3) GCP_REGION="europe-west1" ;;
    4) GCP_REGION="asia-east1" ;;
    5) GCP_REGION="asia-northeast1" ;;
    6)
      read -r -p "  Region (e.g., australia-southeast1): " GCP_REGION
      ;;
    *) GCP_REGION="us-central1" ;;
  esac

  ok "Region: $GCP_REGION"

  # Enable required APIs
  info "Enabling required APIs..."
  gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
    secretmanager.googleapis.com cloudbuild.googleapis.com \
    --project="$GCP_PROJECT" 2>/dev/null || {
    warn "Some APIs may not have been enabled. Check billing is active."
  }
  ok "Required APIs enabled"
fi

# ══════════════════════════════════════════════════════════
# Gate 3: Database setup (skip for --redeploy, --env-only)
# ══════════════════════════════════════════════════════════
if [ "$MODE" = "first-time" ] || [ "$MODE" = "auto" ]; then
  step "3: Database"

  echo ""
  echo "  Database options:"
  echo "    ${BOLD}1)${NC} Cloud SQL PostgreSQL  (~\$7/mo — managed, guided setup)"
  echo "    ${BOLD}2)${NC} External PostgreSQL   (Neon/Supabase — free tier available)"
  echo "    ${BOLD}3)${NC} I already have a DATABASE_URL"
  echo ""
  read -r -p "  Choice [1/2/3]: " db_choice

  case "$db_choice" in
    1)
      # Cloud SQL guided setup
      info "Setting up Cloud SQL PostgreSQL..."
      echo ""

      # Enable SQL API
      gcloud services enable sqladmin.googleapis.com --project="$GCP_PROJECT" 2>/dev/null || true

      DB_INSTANCE="${GCP_PROJECT}-db"
      DB_NAME="app"
      DB_USER="app"
      DB_PASS=$(generate_secret | head -c 24)

      read -r -p "  Instance name [$DB_INSTANCE]: " custom_instance
      DB_INSTANCE="${custom_instance:-$DB_INSTANCE}"

      read -r -p "  Database name [$DB_NAME]: " custom_db
      DB_NAME="${custom_db:-$DB_NAME}"

      # Check if instance already exists
      if gcloud sql instances describe "$DB_INSTANCE" --project="$GCP_PROJECT" &>/dev/null; then
        ok "Cloud SQL instance '$DB_INSTANCE' already exists"
      else
        info "Creating Cloud SQL instance (this takes 3-5 minutes)..."
        gcloud sql instances create "$DB_INSTANCE" \
          --database-version=POSTGRES_15 \
          --tier=db-f1-micro \
          --region="$GCP_REGION" \
          --project="$GCP_PROJECT" \
          --storage-size=10GB \
          --storage-auto-increase \
          --no-assign-ip \
          --network=default 2>/dev/null || {
            # Fallback: try with public IP if VPC not configured
            warn "Private IP failed, trying with public IP..."
            gcloud sql instances create "$DB_INSTANCE" \
              --database-version=POSTGRES_15 \
              --tier=db-f1-micro \
              --region="$GCP_REGION" \
              --project="$GCP_PROJECT" \
              --storage-size=10GB \
              --storage-auto-increase \
              --assign-ip 2>/dev/null || {
                err "Failed to create Cloud SQL instance"
                err "Fix: Check billing is enabled and you have permissions"
                exit 1
              }
          }
        ok "Cloud SQL instance created: $DB_INSTANCE"
      fi

      # Create database
      gcloud sql databases create "$DB_NAME" \
        --instance="$DB_INSTANCE" \
        --project="$GCP_PROJECT" 2>/dev/null || ok "Database '$DB_NAME' already exists"

      # Create user
      gcloud sql users create "$DB_USER" \
        --instance="$DB_INSTANCE" \
        --password="$DB_PASS" \
        --project="$GCP_PROJECT" 2>/dev/null || ok "User '$DB_USER' already exists"

      # Build connection string
      CONNECTION_NAME=$(gcloud sql instances describe "$DB_INSTANCE" \
        --project="$GCP_PROJECT" \
        --format="value(connectionName)" 2>/dev/null)

      # Cloud Run uses Unix socket for Cloud SQL
      DATABASE_URL="postgresql+asyncpg://${DB_USER}:${DB_PASS}@/${DB_NAME}?host=/cloudsql/${CONNECTION_NAME}"

      ok "Database configured via Cloud SQL proxy"
      info "Connection: $CONNECTION_NAME"
      warn "Password stored in DATABASE_URL — keep .deploy-cloudrun.env secure!"
      ;;

    2)
      # External PostgreSQL
      echo ""
      info "External PostgreSQL (free tier options):"
      echo ""
      echo "  Neon:     https://neon.tech        (free 0.5 GB)"
      echo "  Supabase: https://supabase.com     (free 500 MB)"
      echo "  Render:   https://render.com       (free 256 MB)"
      echo ""
      echo "  Create a database, then paste the connection string below."
      echo "  Format: postgresql+asyncpg://user:pass@host:5432/dbname"
      echo ""
      read -r -p "  DATABASE_URL: " DATABASE_URL

      if [ -z "$DATABASE_URL" ]; then
        err "DATABASE_URL cannot be empty"
        exit 1
      fi

      # Basic validation
      if [[ ! "$DATABASE_URL" =~ ^postgres ]]; then
        warn "URL doesn't start with 'postgres' — are you sure it's correct?"
        read -r -p "  Continue anyway? (y/N) " confirm
        if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
          exit 1
        fi
      fi

      # Ensure asyncpg driver
      if [[ "$DATABASE_URL" =~ ^postgresql:// ]] && [[ ! "$DATABASE_URL" =~ ^postgresql\+asyncpg:// ]]; then
        DATABASE_URL="${DATABASE_URL/postgresql:\/\//postgresql+asyncpg:\/\/}"
        info "Auto-converted to asyncpg driver: postgresql+asyncpg://..."
      fi

      ok "External database configured"
      ;;

    3)
      # User has a DATABASE_URL
      echo ""
      read -r -p "  DATABASE_URL: " DATABASE_URL

      if [ -z "$DATABASE_URL" ]; then
        err "DATABASE_URL cannot be empty"
        exit 1
      fi

      # Ensure asyncpg driver
      if [[ "$DATABASE_URL" =~ ^postgresql:// ]] && [[ ! "$DATABASE_URL" =~ ^postgresql\+asyncpg:// ]]; then
        DATABASE_URL="${DATABASE_URL/postgresql:\/\//postgresql+asyncpg:\/\/}"
        info "Auto-converted to asyncpg driver: postgresql+asyncpg://..."
      fi

      ok "Database URL accepted"
      ;;

    *)
      err "Invalid choice. Aborting."
      exit 1
      ;;
  esac
fi

# ══════════════════════════════════════════════════════════
# Gate 4: Secrets (skip for --redeploy)
# ══════════════════════════════════════════════════════════
if [ "$MODE" = "first-time" ] || [ "$MODE" = "auto" ] || [ "$MODE" = "env-only" ]; then
  step "4: Secrets"

  SECRET_KEY=${SECRET_KEY:-$(generate_secret)}
  REFRESH_SECRET_KEY=${REFRESH_SECRET_KEY:-$(generate_secret)}

  if [ "$MODE" = "env-only" ]; then
    # In env-only mode, ask if user wants to regenerate
    echo ""
    read -r -p "  Regenerate SECRET_KEY and REFRESH_SECRET_KEY? (y/N) " regen_secrets
    if [[ "$regen_secrets" =~ ^[Yy]$ ]]; then
      SECRET_KEY=$(generate_secret)
      REFRESH_SECRET_KEY=$(generate_secret)
      ok "Secrets regenerated"
    else
      info "Keeping existing secrets"
    fi
  fi

  echo ""
  echo "  Secret storage options:"
  echo "    ${BOLD}1)${NC} GCP Secret Manager   (recommended — encrypted at rest)"
  echo "    ${BOLD}2)${NC} Plain env vars       (simpler — stored in Cloud Run config)"
  echo ""
  read -r -p "  Choice [1/2, default=2]: " secret_choice

  SECRETS_METHOD="${secret_choice:-2}"

  if [ "$SECRETS_METHOD" = "1" ]; then
    info "Storing secrets in Secret Manager..."

    # Create or update secrets
    for secret_name in SECRET_KEY REFRESH_SECRET_KEY; do
      secret_val="${!secret_name}"
      if gcloud secrets describe "$secret_name" --project="$GCP_PROJECT" &>/dev/null; then
        echo -n "$secret_val" | gcloud secrets versions add "$secret_name" \
          --data-file=- --project="$GCP_PROJECT" 2>/dev/null
        ok "Updated secret: $secret_name"
      else
        echo -n "$secret_val" | gcloud secrets create "$secret_name" \
          --data-file=- --replication-policy=automatic \
          --project="$GCP_PROJECT" 2>/dev/null
        ok "Created secret: $secret_name"
      fi
    done

    # Grant Cloud Run access to secrets
    PROJECT_NUMBER=$(gcloud projects describe "$GCP_PROJECT" --format="value(projectNumber)" 2>/dev/null)
    SA_EMAIL="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

    for secret_name in SECRET_KEY REFRESH_SECRET_KEY; do
      gcloud secrets add-iam-policy-binding "$secret_name" \
        --member="serviceAccount:${SA_EMAIL}" \
        --role="roles/secretmanager.secretAccessor" \
        --project="$GCP_PROJECT" 2>/dev/null || true
    done
    ok "Secret Manager access granted to Cloud Run service account"
  else
    ok "Using plain env vars for secrets"
  fi

  # Email setup
  echo ""
  info "Email setup:"
  echo "  The server needs an email provider for verification emails."
  echo "  For Cloud Run, 'console' mode logs emails to stdout (check Cloud Logging)."
  echo ""
  read -r -p "  EMAIL_PROVIDER [console]: " EMAIL_PROVIDER
  EMAIL_PROVIDER="${EMAIL_PROVIDER:-console}"

  if [ "$EMAIL_PROVIDER" != "console" ]; then
    read -r -p "  EMAIL_FROM (e.g., noreply@example.com): " EMAIL_FROM
  else
    EMAIL_FROM="noreply@example.com"
    info "Email set to console mode — emails logged to Cloud Logging"
  fi

  if [ "$MODE" = "env-only" ]; then
    # Update env vars on existing services
    info "Updating environment variables on server service..."
    ENV_VARS="DATABASE_URL=${DATABASE_URL}"
    ENV_VARS="${ENV_VARS},ENVIRONMENT=production"
    ENV_VARS="${ENV_VARS},DEBUG=false"
    ENV_VARS="${ENV_VARS},EMAIL_PROVIDER=${EMAIL_PROVIDER}"
    ENV_VARS="${ENV_VARS},EMAIL_FROM=${EMAIL_FROM}"

    if [ "$SECRETS_METHOD" = "1" ]; then
      # Use secret references
      gcloud run services update "${SERVER_SERVICE:-server}" \
        --region="$GCP_REGION" \
        --update-env-vars="$ENV_VARS" \
        --update-secrets="SECRET_KEY=SECRET_KEY:latest,REFRESH_SECRET_KEY=REFRESH_SECRET_KEY:latest" \
        --project="$GCP_PROJECT" 2>/dev/null
    else
      ENV_VARS="${ENV_VARS},SECRET_KEY=${SECRET_KEY}"
      ENV_VARS="${ENV_VARS},REFRESH_SECRET_KEY=${REFRESH_SECRET_KEY}"
      gcloud run services update "${SERVER_SERVICE:-server}" \
        --region="$GCP_REGION" \
        --update-env-vars="$ENV_VARS" \
        --project="$GCP_PROJECT" 2>/dev/null
    fi

    ok "Environment variables updated on server"
    save_config
    echo ""
    ok "Done! Environment variables updated."
    exit 0
  fi
fi

# ══════════════════════════════════════════════════════════
# Gate 5: Artifact Registry + Build + Push
# ══════════════════════════════════════════════════════════
step "5: Build & Push Images"

REPO_NAME="${REPO_NAME:-cloud-run-images}"
SERVER_SERVICE="${SERVER_SERVICE:-server}"
CLIENT_SERVICE="${CLIENT_SERVICE:-client}"
IMAGE_BASE="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT}/${REPO_NAME}"

# Create Artifact Registry repo if needed
if ! gcloud artifacts repositories describe "$REPO_NAME" \
    --location="$GCP_REGION" --project="$GCP_PROJECT" &>/dev/null; then
  info "Creating Artifact Registry repository..."
  gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location="$GCP_REGION" \
    --project="$GCP_PROJECT" 2>/dev/null
  ok "Artifact Registry repo created: $REPO_NAME"
else
  ok "Artifact Registry repo exists: $REPO_NAME"
fi

# Configure Docker auth
info "Configuring Docker authentication..."
gcloud auth configure-docker "${GCP_REGION}-docker.pkg.dev" --quiet 2>/dev/null
ok "Docker authenticated for Artifact Registry"

# Build and push server image
echo ""
info "Building server image..."
SERVER_IMAGE="${IMAGE_BASE}/server:latest"

docker build \
  -t "$SERVER_IMAGE" \
  -f "$PROJECT_ROOT/server/Dockerfile" \
  "$PROJECT_ROOT/server" || {
    err "Server image build failed"
    err "Fix: Check server/Dockerfile and ensure it builds locally: docker build ./server"
    exit 1
  }
ok "Server image built"

info "Pushing server image..."
docker push "$SERVER_IMAGE" || {
  err "Server image push failed"
  err "Fix: Check Artifact Registry permissions and Docker auth"
  exit 1
}
ok "Server image pushed: $SERVER_IMAGE"

# Build and push client image
# Server URL needed for VITE_API_URL build arg
if [ -z "${SERVER_URL:-}" ]; then
  # Try to get existing server URL
  SERVER_URL=$(gcloud run services describe "$SERVER_SERVICE" \
    --region="$GCP_REGION" --project="$GCP_PROJECT" \
    --format="value(status.url)" 2>/dev/null || echo "")

  if [ -z "$SERVER_URL" ]; then
    echo ""
    warn "Server URL not yet known (first deploy)."
    info "The client will be built after the server is deployed."
    info "For now, using a placeholder — client will be redeployed in Gate 6."
    SERVER_URL="https://${SERVER_SERVICE}-placeholder.run.app"
    NEED_CLIENT_REDEPLOY=true
  fi
fi

echo ""
info "Building client image (VITE_API_URL=$SERVER_URL)..."
CLIENT_IMAGE="${IMAGE_BASE}/client:latest"

docker build \
  -t "$CLIENT_IMAGE" \
  --build-arg "VITE_API_URL=$SERVER_URL" \
  -f "$PROJECT_ROOT/client/Dockerfile" \
  "$PROJECT_ROOT" || {
    # Try alternate Dockerfile location
    docker build \
      -t "$CLIENT_IMAGE" \
      --build-arg "VITE_API_URL=$SERVER_URL" \
      "$PROJECT_ROOT/client" || {
        err "Client image build failed"
        err "Fix: Check client/Dockerfile and ensure it builds locally"
        exit 1
      }
  }
ok "Client image built"

info "Pushing client image..."
docker push "$CLIENT_IMAGE" || {
  err "Client image push failed"
  err "Fix: Check Artifact Registry permissions and Docker auth"
  exit 1
}
ok "Client image pushed: $CLIENT_IMAGE"

# ══════════════════════════════════════════════════════════
# Gate 6: Deploy services
# ══════════════════════════════════════════════════════════
step "6: Deploy Services"

# Build env vars string for server
ENV_VARS="DATABASE_URL=${DATABASE_URL}"
ENV_VARS="${ENV_VARS},ENVIRONMENT=production"
ENV_VARS="${ENV_VARS},DEBUG=false"
ENV_VARS="${ENV_VARS},APP_VERSION=1.0.0"
ENV_VARS="${ENV_VARS},LOG_FORMAT=json"
ENV_VARS="${ENV_VARS},ACCESS_TOKEN_EXPIRE_MINUTES=15"
ENV_VARS="${ENV_VARS},REFRESH_TOKEN_EXPIRE_DAYS=30"
ENV_VARS="${ENV_VARS},RATE_LIMIT_AUTH=5/minute"
ENV_VARS="${ENV_VARS},EMAIL_PROVIDER=${EMAIL_PROVIDER:-console}"
ENV_VARS="${ENV_VARS},EMAIL_FROM=${EMAIL_FROM:-noreply@example.com}"

# Add Cloud SQL connection if applicable
CLOUD_SQL_FLAG=""
if [[ "${DATABASE_URL:-}" == *"/cloudsql/"* ]]; then
  CONNECTION_NAME=$(echo "$DATABASE_URL" | grep -oP '(?<=/cloudsql/)[^"]+' || true)
  if [ -n "$CONNECTION_NAME" ]; then
    CLOUD_SQL_FLAG="--add-cloudsql-instances=$CONNECTION_NAME"
  fi
fi

# Deploy server
info "Deploying server to Cloud Run..."
DEPLOY_CMD=(
  gcloud run deploy "$SERVER_SERVICE"
  --image="$SERVER_IMAGE"
  --region="$GCP_REGION"
  --project="$GCP_PROJECT"
  --allow-unauthenticated
  --min-instances=0
  --max-instances=5
  --memory=512Mi
  --cpu=1
  --port=8000
  --set-env-vars="$ENV_VARS"
)

# Add secrets if using Secret Manager
if [ "${SECRETS_METHOD:-2}" = "1" ]; then
  DEPLOY_CMD+=(--update-secrets="SECRET_KEY=SECRET_KEY:latest,REFRESH_SECRET_KEY=REFRESH_SECRET_KEY:latest")
else
  DEPLOY_CMD+=(--set-env-vars="SECRET_KEY=${SECRET_KEY},REFRESH_SECRET_KEY=${REFRESH_SECRET_KEY}")
fi

# Add Cloud SQL flag if needed
if [ -n "$CLOUD_SQL_FLAG" ]; then
  DEPLOY_CMD+=("$CLOUD_SQL_FLAG")
fi

"${DEPLOY_CMD[@]}" 2>/dev/null || {
  err "Server deployment failed"
  err "Fix: Check Cloud Run logs: gcloud run services logs read $SERVER_SERVICE --region=$GCP_REGION"
  exit 1
}

# Get server URL
SERVER_URL=$(gcloud run services describe "$SERVER_SERVICE" \
  --region="$GCP_REGION" --project="$GCP_PROJECT" \
  --format="value(status.url)" 2>/dev/null)
ok "Server deployed: $SERVER_URL"

# Update ALLOWED_ORIGINS on server with actual client URL (will get it after client deploy)
# For now, set a permissive origin that we'll tighten after client deploy

# Rebuild client with actual server URL if needed
if [ "${NEED_CLIENT_REDEPLOY:-false}" = "true" ]; then
  echo ""
  info "Rebuilding client with actual server URL ($SERVER_URL)..."
  docker build \
    -t "$CLIENT_IMAGE" \
    --build-arg "VITE_API_URL=$SERVER_URL" \
    -f "$PROJECT_ROOT/client/Dockerfile" \
    "$PROJECT_ROOT" 2>/dev/null || \
  docker build \
    -t "$CLIENT_IMAGE" \
    --build-arg "VITE_API_URL=$SERVER_URL" \
    "$PROJECT_ROOT/client" 2>/dev/null || {
      err "Client rebuild failed"
      exit 1
    }
  docker push "$CLIENT_IMAGE" 2>/dev/null
  ok "Client image rebuilt with correct API URL"
fi

# Deploy client
echo ""
info "Deploying client to Cloud Run..."
gcloud run deploy "$CLIENT_SERVICE" \
  --image="$CLIENT_IMAGE" \
  --region="$GCP_REGION" \
  --project="$GCP_PROJECT" \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=3 \
  --memory=256Mi \
  --cpu=1 \
  --port=80 2>/dev/null || {
    err "Client deployment failed"
    err "Fix: Check Cloud Run logs: gcloud run services logs read $CLIENT_SERVICE --region=$GCP_REGION"
    exit 1
  }

CLIENT_URL=$(gcloud run services describe "$CLIENT_SERVICE" \
  --region="$GCP_REGION" --project="$GCP_PROJECT" \
  --format="value(status.url)" 2>/dev/null)
ok "Client deployed: $CLIENT_URL"

# Update CORS on server with actual client URL
info "Updating CORS origin on server..."
gcloud run services update "$SERVER_SERVICE" \
  --region="$GCP_REGION" \
  --project="$GCP_PROJECT" \
  --update-env-vars="ALLOWED_ORIGINS_STR=$CLIENT_URL" 2>/dev/null || {
    warn "Failed to update CORS. Set manually: ALLOWED_ORIGINS_STR=$CLIENT_URL"
  }
ok "CORS updated with client URL"

# Save config for future runs
save_config

# ══════════════════════════════════════════════════════════
# Gate 7: Domain setup
# ══════════════════════════════════════════════════════════
step "7: Domain Setup"

echo ""
info "Default URLs (auto-assigned by Cloud Run):"
echo "  Server: $SERVER_URL"
echo "  Client: $CLIENT_URL"
echo ""

read -r -p "  Set up custom domain mapping? (y/N) " setup_domain
if [[ "$setup_domain" =~ ^[Yy]$ ]]; then
  echo ""
  read -r -p "  Custom server domain (e.g., api.example.com, Enter to skip): " custom_api
  if [ -n "$custom_api" ]; then
    gcloud run domain-mappings create \
      --service="$SERVER_SERVICE" \
      --domain="$custom_api" \
      --region="$GCP_REGION" \
      --project="$GCP_PROJECT" 2>/dev/null || {
        warn "Domain mapping failed. You may need to verify domain ownership first."
        echo "  Visit: https://console.cloud.google.com/run/domains?project=$GCP_PROJECT"
      }
    ok "Server domain mapped: $custom_api"

    echo ""
    info "Add these DNS records for $custom_api:"
    gcloud run domain-mappings describe \
      --domain="$custom_api" \
      --region="$GCP_REGION" \
      --project="$GCP_PROJECT" \
      --format="table(resourceRecords[].type, resourceRecords[].rrdata)" 2>/dev/null || true
  fi

  echo ""
  read -r -p "  Custom client domain (e.g., app.example.com, Enter to skip): " custom_client
  if [ -n "$custom_client" ]; then
    gcloud run domain-mappings create \
      --service="$CLIENT_SERVICE" \
      --domain="$custom_client" \
      --region="$GCP_REGION" \
      --project="$GCP_PROJECT" 2>/dev/null || {
        warn "Domain mapping failed. You may need to verify domain ownership first."
        echo "  Visit: https://console.cloud.google.com/run/domains?project=$GCP_PROJECT"
      }
    ok "Client domain mapped: $custom_client"

    # Update CORS with custom domain
    gcloud run services update "$SERVER_SERVICE" \
      --region="$GCP_REGION" \
      --project="$GCP_PROJECT" \
      --update-env-vars="ALLOWED_ORIGINS_STR=https://${custom_client}" 2>/dev/null || true
  fi
else
  info "Skipped custom domains. Using default *.run.app URLs."
fi

# ══════════════════════════════════════════════════════════
# Gate 8: Verification
# ══════════════════════════════════════════════════════════
step "8: Verification"

echo ""
info "Running health checks..."

# Wait a moment for services to stabilize
info "Waiting 10s for services to stabilize..."
sleep 10

# Health check server
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${SERVER_URL}/health" 2>/dev/null || echo "000")
if [ "$HEALTH_STATUS" = "200" ]; then
  ok "Server health check: HTTP $HEALTH_STATUS"
else
  warn "Server health check: HTTP $HEALTH_STATUS (may still be starting up)"
  echo "  Try again in a minute: curl ${SERVER_URL}/health"
fi

# Health check client
CLIENT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${CLIENT_URL}" 2>/dev/null || echo "000")
if [ "$CLIENT_STATUS" = "200" ]; then
  ok "Client health check: HTTP $CLIENT_STATUS"
else
  warn "Client health check: HTTP $CLIENT_STATUS (may still be starting up)"
  echo "  Try again in a minute: curl ${CLIENT_URL}"
fi

# ══════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
printf "  ${GREEN}${BOLD}Deployment complete!${NC}\n"
echo ""
echo "  Service URLs:"
printf "    ${CYAN}Server:${NC} %s\n" "$SERVER_URL"
printf "    ${CYAN}Client:${NC} %s\n" "$CLIENT_URL"
echo ""
echo "  GCP Console:"
echo "    https://console.cloud.google.com/run?project=$GCP_PROJECT"
echo ""
if [ "${EMAIL_PROVIDER:-console}" = "console" ]; then
echo "  Email is in console mode — check Cloud Logging for email output:"
echo "    gcloud run services logs read $SERVER_SERVICE --region=$GCP_REGION --limit=50"
echo ""
fi
echo "  Useful commands:"
echo "    bash scripts/deploy-cloudrun.sh --status     # Check status"
echo "    bash scripts/deploy-cloudrun.sh --redeploy   # Rebuild + redeploy"
echo "    bash scripts/deploy-cloudrun.sh --env-only   # Update env vars"
echo ""
echo "    gcloud run services logs read server --region=$GCP_REGION   # Server logs"
echo "    gcloud run services logs read client --region=$GCP_REGION   # Client logs"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
