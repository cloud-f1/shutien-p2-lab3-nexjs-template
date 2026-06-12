#!/usr/bin/env bash
# ============================================================================
# Post-clone cleanup for ai-coding-template
# Usage: bash .github/template-cleanup.sh
# Idempotent: safe to run multiple times
# ============================================================================
set -euo pipefail

# ----------------------------------------------------------------------------
# Colors & helpers
# ----------------------------------------------------------------------------
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

info()    { echo -e "${GREEN}[OK]${NC}    $1"; }
warn()    { echo -e "${YELLOW}[SKIP]${NC}  $1"; }
fail()    { echo -e "${RED}[ERROR]${NC} $1"; }
section() { echo -e "\n${CYAN}${BOLD}▸ $1${NC}"; }

safe_rm() {
  local target="$1"
  if [ -e "$target" ]; then
    rm -rf "$target"
    info "Removed $target"
  else
    warn "Not found: $target (already clean)"
  fi
}

# ----------------------------------------------------------------------------
# Ensure we're at repo root
# ----------------------------------------------------------------------------
if [ ! -f "CLAUDE.md" ] || [ ! -d "server" ] || [ ! -d "client" ]; then
  fail "This script must be run from the repository root."
  fail "Usage: cd <your-repo> && bash .github/template-cleanup.sh"
  exit 1
fi

# ----------------------------------------------------------------------------
# Confirmation prompt
# ----------------------------------------------------------------------------
echo -e "${BOLD}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         AI Coding Template — Post-Clone Cleanup            ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  This script will:                                         ║"
echo "║                                                            ║"
echo "║  1. Remove example domains (places, portfolios)            ║"
echo "║     - Server: domains, models, schemas, endpoints, tests   ║"
echo "║     - Client: pages, hooks, services, schemas, handlers    ║"
echo "║     - OpenAPI: domain paths & schemas                      ║"
echo "║  2. Reset EPIC_INDEX.md to blank template                  ║"
echo "║  3. Remove epic spec files (docs/epics/e*.md)              ║"
echo "║  4. Reset session context                                  ║"
echo "║  5. Remove Alembic migration files                         ║"
echo "║  6. Clear changelog                                        ║"
echo "║  7. Reset git history (new initial commit)                 ║"
echo "║  8. Self-delete this script + TEMPLATE_SETUP.md            ║"
echo "║                                                            ║"
echo "║  Core modules (auth, session, user) are NOT affected.      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

read -rp "Proceed? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo ""

# ============================================================================
# 1. Remove example server domain files
# ============================================================================
section "Removing example server domains"

# Domain packages
safe_rm "server/app/domains/places"
safe_rm "server/app/domains/portfolios"

# Backward-compat shims
safe_rm "server/app/models/place.py"
safe_rm "server/app/models/portfolio.py"
safe_rm "server/app/schemas/place.py"
safe_rm "server/app/schemas/portfolio.py"
safe_rm "server/app/api/v1/endpoints/places.py"
safe_rm "server/app/api/v1/endpoints/portfolios.py"

# Integration tests
safe_rm "server/tests/integration/test_places.py"
safe_rm "server/tests/integration/test_portfolios.py"

# ============================================================================
# 2. Remove example client files
# ============================================================================
section "Removing example client files"

# Pages
safe_rm "client/src/pages/places"
safe_rm "client/src/pages/portfolios"

# Hooks
safe_rm "client/src/hooks/usePlaces.ts"
safe_rm "client/src/hooks/usePortfolios.ts"

# Services + tests
safe_rm "client/src/api/services/places.ts"
safe_rm "client/src/api/services/portfolios.ts"
safe_rm "client/src/api/services/__tests__/places.test.ts"
safe_rm "client/src/api/services/__tests__/portfolios.test.ts"

# Schemas
safe_rm "client/src/schemas/place.ts"
safe_rm "client/src/schemas/portfolio.ts"

# MSW handlers
safe_rm "client/src/tests/handlers/places.ts"
safe_rm "client/src/tests/handlers/portfolios.ts"

# ============================================================================
# 3. Remove example OpenAPI specs
# ============================================================================
section "Removing example OpenAPI domain specs"

safe_rm "docs/openapi/paths/places.yaml"
safe_rm "docs/openapi/paths/portfolios.yaml"
safe_rm "docs/openapi/schemas/place.yaml"
safe_rm "docs/openapi/schemas/portfolio.yaml"

# ============================================================================
# 4. Reset EPIC_INDEX.md to blank template
# ============================================================================
section "Resetting EPIC_INDEX.md"

if [ -f "docs/epics/EPIC_INDEX.md" ]; then
  cat > "docs/epics/EPIC_INDEX.md" << 'EPIC_EOF'
# {{PROJECT_DISPLAY}} — Epic Progress Tracker

> **Purpose**: Machine-readable state for the Epic Loop orchestrator
> **Updated by**: Agent after each step completes
> **Read by**: `/athena:loop` or `SessionStart` to determine next action

---

## Phase Status

| Phase | Epics | Status |
|-------|-------|--------|
| Phase 1 | E1 | ⬜ Pending |

## Epic Step Matrix

<!--
Steps: spec → implement → qa → commit → merge
Status: ⬜ pending | 🔄 in-progress | ✅ done | ⏭️ skip | ❌ failed
Size: S (~1 session) | M (1-2 sessions) | L (2-3 sessions)
-->

| Epic | Name | Size | Spec | Impl | QA | Commit | Merge | Notes |
|------|------|------|------|------|-----|--------|-------|-------|
| E1 | (your first epic) | S | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | |

---

## Next Action

Start with `/athena:spec` to design your first feature.
EPIC_EOF
  info "Reset docs/epics/EPIC_INDEX.md to blank template"
else
  warn "docs/epics/EPIC_INDEX.md not found"
fi

# ============================================================================
# 5. Remove epic spec files (keep EPIC_INDEX.md and CLAUDE.md)
# ============================================================================
section "Removing epic spec files"

for f in docs/epics/e*.md; do
  if [ -f "$f" ]; then
    safe_rm "$f"
  fi
done

# ============================================================================
# 6. Reset session context
# ============================================================================
section "Resetting session context"

if [ -f "docs/context/session-summary.md" ]; then
  cat > "docs/context/session-summary.md" << 'CTX_EOF'
# Session Summary

> Last updated: (not yet started)

No sessions recorded yet. Run `/athena:load` to begin.
CTX_EOF
  info "Reset docs/context/session-summary.md"
else
  warn "docs/context/session-summary.md not found"
fi

# ============================================================================
# 7. Remove Alembic migrations (keep env.py and directory structure)
# ============================================================================
section "Removing Alembic migration files"

if [ -d "server/alembic/versions" ]; then
  migration_count=0
  for f in server/alembic/versions/*.py; do
    if [ -f "$f" ] && [ "$(basename "$f")" != "__init__.py" ]; then
      safe_rm "$f"
      migration_count=$((migration_count + 1))
    fi
  done
  if [ "$migration_count" -eq 0 ]; then
    warn "No migration files found (already clean)"
  fi
else
  warn "server/alembic/versions/ directory not found"
fi

# ============================================================================
# 8. Clear changelog
# ============================================================================
section "Clearing changelog"

if [ -f "docs/dev-guide/changelog.md" ]; then
  cat > "docs/dev-guide/changelog.md" << 'CL_EOF'
# Changelog

All notable changes to this project will be documented in this file.

Generated by [git-cliff](https://github.com/orhun/git-cliff). See [cliff.toml](../../cliff.toml) for configuration.
CL_EOF
  info "Cleared docs/dev-guide/changelog.md"
else
  warn "docs/dev-guide/changelog.md not found"
fi

# ============================================================================
# 9. Reset git history
# ============================================================================
section "Resetting git history"

if [ -d ".git" ]; then
  rm -rf .git
  info "Removed old .git directory"
fi

git init --quiet
git add -A
git commit --quiet -m "Initial commit from ai-coding-template"
info "Initialized new git repository with initial commit"

# ============================================================================
# 10. Self-cleanup
# ============================================================================
section "Self-cleanup"

safe_rm ".github/TEMPLATE_SETUP.md"

# Remove this script last
SELF_PATH=".github/template-cleanup.sh"
if [ -f "$SELF_PATH" ]; then
  rm -f "$SELF_PATH"
  info "Removed $SELF_PATH"
fi

# ============================================================================
# Done
# ============================================================================
echo ""
echo -e "${GREEN}${BOLD}Cleanup complete!${NC}"
echo ""
echo -e "Next steps:"
echo -e "  1. ${CYAN}make go${NC}               Install deps, start DB, launch dev servers"
echo -e "  2. Open ${CYAN}http://localhost:5173/getting-started${NC} for an interactive walkthrough"
echo -e "  3. ${CYAN}make tutorial${NC}          5-minute guided endpoint tutorial"
echo -e "  4. ${CYAN}/athena:spec${NC}           Design your first feature (with Claude Code)"
echo ""
echo -e "Prefer a wizard? Run ${CYAN}pnpm new-site${NC} before ${CYAN}make go${NC} to customize"
echo -e "project name, theme, and feature modules interactively."
echo ""
echo -e "Documentation: ${CYAN}docs/guides/en/quickstart.md${NC}"
