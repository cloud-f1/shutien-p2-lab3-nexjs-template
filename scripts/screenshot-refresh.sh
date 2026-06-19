#!/usr/bin/env bash
# scripts/screenshot-refresh.sh — refresh dev-docs screenshots from the running app.
#
# Run this AFTER you change a UI surface so a screenshot-backed user manual
# (dev-docs/public/screenshots/**) doesn't silently drift from the app. It re-runs the
# logged-in Playwright tour (scripts/mockup/tour-app.cjs) into dev-docs/public/screenshots,
# then shows what git sees so you review the visual diff and commit the real changes intentionally.
#
# This is a MANUAL refresh, NOT a CI gate: PNG re-encoding makes byte-diff noisy, so an
# automated pixel-VRT (Playwright `toHaveScreenshot`, already wired via `pnpm test:vrt`) is the
# follow-on for true visual regression — see the user-guide-builder skill.
#
# NOTE: this template logs in by **email + password** (demo: admin@example.com / Admin123!),
# not by badge — tour-app.cjs is already adapted accordingly (E303/E307).
#
# Usage: scripts/screenshot-refresh.sh [baseURL]   (default http://localhost:3000)
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
BASE="${1:-http://localhost:3000}"
TOUR="scripts/mockup/tour-app.cjs"
SHOTS="dev-docs/public/screenshots"

if [ ! -f "$TOUR" ]; then
  echo "✗ $TOUR not found (added in E303). Nothing to run." >&2
  exit 2
fi

# Precondition — the app must be up + seeded (the tour logs in).
code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "$BASE/login" || echo 000)"
if [ "$code" != "200" ]; then
  echo "✗ app not reachable at $BASE/login (got $code)."
  echo "  Start it first:  make local   (Docker Postgres + Next.js)  then  make local-db  (migrate + seed)"
  echo "  …then re-run this script."
  exit 1
fi

echo "▶ Re-capturing dev-docs screenshots from $BASE (logged-in tour)…"
node "$TOUR" "$BASE"

echo ""
echo "▶ Screenshots git now sees as changed (review the VISUAL diff before committing):"
changed="$(git status --porcelain "$SHOTS" 2>/dev/null || true)"
if [ -z "$changed" ]; then
  echo "  (none — screenshots already match the current UI)"
else
  echo "$changed" | sed 's/^/  /'
  echo ""
  echo "  Keep the PNGs that reflect a REAL UI change; \`git checkout -- <png>\` the ones that only"
  echo "  re-encoded (no visible change). Then commit the kept ones alongside the UI change."
fi
