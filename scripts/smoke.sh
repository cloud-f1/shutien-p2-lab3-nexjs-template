#!/usr/bin/env bash
#
# smoke.sh — one-shot "is everything OK?" gate for the Next.js @saas template.
#
# Runs the full verification surface so a reviewer can code-review with
# confidence. Core gates always run; heavier gates (e2e, install-smoke, docker)
# are attempted and reported SKIP (not FAIL) when their prerequisites are absent.
#
# Usage:
#   scripts/smoke.sh             # core + attempt e2e/install (skip if no DB/network)
#   scripts/smoke.sh --core      # core gates only (fast, deterministic)
#   scripts/smoke.sh --docker    # also probe `docker compose up` boot
#
# Exit non-zero if any RUN gate fails. SKIP never fails the run.

set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$ROOT/next-app"
DOCS="$ROOT/dev-docs"
MODE_CORE=0; DO_DOCKER=0
for a in "$@"; do case "$a" in --core) MODE_CORE=1;; --docker) DO_DOCKER=1;; esac; done

PASS=(); FAILED=(); SKIPPED=()
hdr()  { printf '\n\033[1m━━ %s\033[0m\n' "$1"; }
rung() { # rung "<name>" <cmd...>
  local name="$1"; shift
  printf '  ▶ %s … ' "$name"
  if "$@" >/tmp/smoke-last.log 2>&1; then printf '\033[32mPASS\033[0m\n'; PASS+=("$name");
  else printf '\033[31mFAIL\033[0m\n'; FAILED+=("$name"); tail -8 /tmp/smoke-last.log | sed 's/^/      /'; fi
}
skip() { printf '  ⏭ %s … \033[33mSKIP\033[0m (%s)\n' "$1" "$2"; SKIPPED+=("$1: $2"); }
# rung_make "<target>" — run a make target, or SKIP if it doesn't exist on this branch
rung_make() {
  if make -C "$ROOT" -n "$1" >/dev/null 2>&1; then rung "$1" make -C "$ROOT" "$1";
  else skip "$1" "no '$1' make target on this branch"; fi
}

# Abnormal-exit guard. Gates run with `set +e` semantics (we WANT to run them all),
# so a non-zero gate is handled by rung(). This trap catches the *other* class of
# failure — the harness itself dying before the summary (a setup crash, a `set -u`
# unbound var, a syntax error) — so we never emit a misleading partial/green result.
SMOKE_DONE=0
trap 'rc=$?; if [ "$SMOKE_DONE" != 1 ]; then printf "\n\033[31m✖ smoke ABORTED (exit %s) before the summary — harness/setup error, NOT a gate result. Last captured log:\033[0m\n" "$rc"; tail -12 /tmp/smoke-last.log 2>/dev/null | sed "s/^/      /"; fi' EXIT

cd "$APP" || { echo "✖ next-app not found at $APP" >&2; exit 1; }

hdr "Static + build (next-app)"
rung "typecheck"        pnpm typecheck
rung "lint"             pnpm lint
# build needs env present (lib/db.ts throws on missing DATABASE_URL at import; postgres-js stays lazy so a dummy is fine)
rung "production build" env DATABASE_URL="${DATABASE_URL:-postgres://build:build@localhost:5432/build}" AUTH_SECRET="${AUTH_SECRET:-smoke-build-secret}" NEXTAUTH_URL="${NEXTAUTH_URL:-http://localhost:3000}" pnpm build
rung "unit tests"       pnpm test

hdr "Registry + modules"
rung "registry:build"   pnpm registry:build
rung "module:validate"  pnpm module:validate

hdr "Plan alignment (deliverables present)"
# Phase 60 (Cobalt design integration) — asserts every planned token/FX/landing/
# dashboard deliverable actually landed. Extend with more suites as phases ship.
rung "cobalt-integration" pnpm test app/cobalt-integration.test.ts

hdr "Athena guards (repo root)"
rung_make "guard-selftest"
rung_make "skills-guard"
rung_make "doc-truth"

hdr "Dev-docs (VitePress)"
if [ -d "$DOCS" ]; then rung "vitepress build" bash -c "cd '$DOCS' && pnpm build"; else skip "vitepress build" "no dev-docs/"; fi

if [ "$MODE_CORE" -eq 0 ]; then
  hdr "E2E (Playwright — needs Postgres)"
  if pg_isready >/dev/null 2>&1 || nc -z localhost 5432 >/dev/null 2>&1; then
    # auto-inject the env the dev server (spawned by Playwright's webServer) needs; all overridable
    export DATABASE_URL="${DATABASE_URL:-postgresql://saas_user:saas_pass@localhost:5432/saas_dev}"
    export AUTH_SECRET="${AUTH_SECRET:-smoke-e2e-secret}" AUTH_TRUST_HOST="${AUTH_TRUST_HOST:-true}"
    export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://localhost:3000}"
    export SMTP_HOST="${SMTP_HOST:-localhost}" SMTP_PORT="${SMTP_PORT:-1025}" SMTP_SECURE="${SMTP_SECURE:-false}" EMAIL_FROM="${EMAIL_FROM:-test@example.com}"
    # db:migrate — tolerate an already-migrated dev DB (idempotent prep, not a gate)
    printf '  ▶ db:migrate … '
    if pnpm db:migrate >/tmp/smoke-mig.log 2>&1; then printf '\033[32mPASS\033[0m\n'; PASS+=("db:migrate")
    elif grep -qi "already exists\|no migrations" /tmp/smoke-mig.log; then printf '\033[33mSKIP\033[0m (already applied)\n'; SKIPPED+=("db:migrate: already applied")
    else printf '\033[31mFAIL\033[0m\n'; FAILED+=("db:migrate"); tail -8 /tmp/smoke-mig.log | sed 's/^/      /'; fi
    rung "db:seed"  pnpm db:seed
    rung "e2e"      pnpm test:e2e
  else
    skip "e2e" "no Postgres on :5432 — run 'make db' / 'docker compose up postgres' then re-run"
  fi

  hdr "Install-smoke (@saas/landing → temp app)"
  if command -v npx >/dev/null 2>&1 && curl -sf -o /dev/null "http://localhost:3000/r/landing.json" 2>/dev/null; then
    rung "shadcn add @saas/landing" bash -c 'cd "$(mktemp -d)" && npx --yes shadcn@latest add http://localhost:3000/r/landing.json --yes'
  else
    skip "install-smoke" "needs the app served at :3000 (npx shadcn add reads /r/*.json over http)"
  fi
fi

if [ "$DO_DOCKER" -eq 1 ]; then
  hdr "Docker boot probe"
  if command -v docker >/dev/null 2>&1; then
    rung "docker compose up" bash -c 'cd "'"$ROOT"'" && docker compose up --build -d && sleep 25 && curl -sf http://localhost:3000/api/health && docker compose down'
  else skip "docker" "docker not installed"; fi
fi

hdr "SMOKE SUMMARY"
SMOKE_DONE=1  # reached the summary cleanly → disarm the abnormal-exit guard
printf '  \033[32mPASS:%d\033[0m  \033[31mFAIL:%d\033[0m  \033[33mSKIP:%d\033[0m\n' "${#PASS[@]}" "${#FAILED[@]}" "${#SKIPPED[@]}"
[ "${#SKIPPED[@]}" -gt 0 ] && printf '  skipped: %s\n' "$(printf '%s; ' "${SKIPPED[@]}")"
if [ "${#FAILED[@]}" -gt 0 ]; then printf '  \033[31mFAILED: %s\033[0m\n' "$(printf '%s ' "${FAILED[@]}")"; exit 1; fi
printf '  \033[32m✅ all run gates passed\033[0m\n'
