#!/usr/bin/env bash
# Next.js stack smoke test
# Boots docker infra, builds the app, starts it, and hits key endpoints.
# Usage: ./scripts/smoke-test.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/next-app"

export DATABASE_URL="postgresql://saas_user:saas_pass@localhost:5432/saas_dev"
export AUTH_SECRET="smoke-test-secret-$(openssl rand -hex 8)"
export SMTP_HOST="localhost"
export SMTP_PORT="1025"
export SMTP_SECURE="false"

PORT=3099
export NEXTAUTH_URL="http://localhost:$PORT"
export NEXT_PUBLIC_APP_URL="http://localhost:$PORT"
PASS=0
FAIL=0

log()  { echo "[smoke] $*"; }
ok()   { echo "[smoke] ✅ $*"; ((PASS++)) || true; }
fail() { echo "[smoke] ❌ $*"; ((FAIL++)) || true; }

# ── 1. Infra ──────────────────────────────────────────────────────────────────
log "Starting DB..."
docker compose -f "$ROOT/docker-compose.yml" up -d db

log "Waiting for DB to be healthy..."
for i in $(seq 1 20); do
  docker compose -f "$ROOT/docker-compose.yml" exec -T db \
    pg_isready -U saas_user -d saas_dev -q 2>/dev/null && break
  sleep 1
  [ "$i" -eq 20 ] && { fail "DB not healthy after 20s"; exit 1; }
done
ok "DB healthy"

# ── 2. Build ──────────────────────────────────────────────────────────────────
log "Building Next.js app..."
if (cd "$APP" && DATABASE_URL="$DATABASE_URL" AUTH_SECRET="$AUTH_SECRET" npx next build 2>&1 | tail -5); then
  ok "Build passed"
else
  fail "Build failed"; exit 1
fi

# ── 3. Start + probe ──────────────────────────────────────────────────────────
log "Starting server on port $PORT..."
(cd "$APP" && PORT=$PORT AUTH_SECRET="$AUTH_SECRET" DATABASE_URL="$DATABASE_URL" npx next start -p $PORT > /tmp/next-smoke.log 2>&1) &
SERVER_PID=$!

log "Waiting for server to respond..."
for i in $(seq 1 20); do
  curl -sf "http://localhost:$PORT/api/health" > /dev/null 2>&1 && break
  sleep 1
  [ "$i" -eq 20 ] && { fail "Server not ready after 20s"; kill "$SERVER_PID" 2>/dev/null; exit 1; }
done
ok "Server started"

# /api/health
health=$(curl -sf "http://localhost:$PORT/api/health")
echo "$health" | grep -q '"status":"ok"' && ok 'GET /api/health → {"status":"ok"}' || fail "GET /api/health bad response: $health"

# /login returns 200
status=$(curl -so /dev/null -w "%{http_code}" "http://localhost:$PORT/login")
[ "$status" = "200" ] && ok "GET /login → 200" || fail "GET /login → $status"

# /dashboard redirects unauthenticated users to /login
redir=$(curl -so /dev/null -w "%{url_effective}" -L "http://localhost:$PORT/dashboard")
echo "$redir" | grep -q "login" && ok "GET /dashboard (unauth) → redirected to /login" || fail "GET /dashboard redir unexpected: $redir"

# ── 4. Cleanup ────────────────────────────────────────────────────────────────
kill "$SERVER_PID" 2>/dev/null || true

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
printf "  Smoke test: %s passed, %s failed\n" "$PASS" "$FAIL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
