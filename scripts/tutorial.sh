#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# AI-Coding-Template — Interactive Tutorial
# "Build your first endpoint in 5 minutes"
#
# Works WITHOUT Claude Code. Just run:  make tutorial
# ──────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colours & helpers ──────────────────────────────────────────

BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[32m'
YELLOW='\033[33m'
CYAN='\033[36m'
RED='\033[31m'
RESET='\033[0m'

step_num=0

banner() {
  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${BOLD}  $1${RESET}"
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
}

step() {
  step_num=$((step_num + 1))
  echo ""
  echo -e "${YELLOW}──── Step ${step_num}: $1 ────${RESET}"
  echo ""
}

info() {
  echo -e "  ${DIM}$1${RESET}"
}

success() {
  echo -e "  ${GREEN}✓ $1${RESET}"
}

fail() {
  echo -e "  ${RED}✗ $1${RESET}"
}

pause() {
  echo ""
  echo -e "  ${DIM}Press Enter to continue...${RESET}"
  read -r
}

# ── Welcome ────────────────────────────────────────────────────

banner "AI-Coding-Template — Interactive Tutorial"

echo "  Welcome! This guide walks you through building your first"
echo "  domain endpoint in about 5 minutes."
echo ""
echo "  What you'll do:"
echo "    1. Make sure the dev environment is running"
echo "    2. Create a new domain (\"notes\")"
echo "    3. Explore the generated code"
echo "    4. Run the server and test the endpoint"
echo "    5. Run the test suite"
echo ""
echo -e "  ${DIM}No Claude Code required — just your terminal.${RESET}"

pause

# ── Step 1: Check environment ──────────────────────────────────

step "Check environment"

info "Making sure prerequisites are installed..."

missing=0

for cmd in node pnpm python3 docker; do
  if command -v "$cmd" &>/dev/null; then
    success "$cmd found: $(command -v "$cmd")"
  else
    fail "$cmd not found — please install it first."
    missing=1
  fi
done

if [ "$missing" -eq 1 ]; then
  echo ""
  echo -e "  ${RED}Some prerequisites are missing. Install them and re-run.${RESET}"
  echo "  See the README for installation instructions."
  exit 1
fi

# Check if uv is available
if command -v uv &>/dev/null; then
  success "uv found: $(command -v uv)"
else
  fail "uv not found — install with: curl -LsSf https://astral.sh/uv/install.sh | sh"
  exit 1
fi

success "All prerequisites installed!"

pause

# ── Step 2: Create a domain ───────────────────────────────────

step "Create a new domain"

echo "  We'll create a \"notes\" domain — a simple CRUD resource"
echo "  with title and body fields."
echo ""
echo -e "  ${CYAN}Command: make new-domain NAME=notes${RESET}"
echo ""
echo "  This generates:"
echo "    - Server model, schemas, endpoints"
echo "    - Database migration"
echo "    - Client schemas, service, hooks"
echo "    - Test boilerplate"

pause

# Check if domain already exists
if [ -d "server/app/domains/notes" ]; then
  echo -e "  ${YELLOW}The 'notes' domain already exists.${RESET}"
  echo "  Skipping creation — we'll use the existing one."
else
  info "Running domain generator..."
  make new-domain NAME=notes
  success "Domain \"notes\" created!"
fi

pause

# ── Step 3: Explore generated code ────────────────────────────

step "Explore the generated code"

echo "  Here's what was generated:"
echo ""

if [ -d "server/app/domains/notes" ]; then
  echo -e "  ${CYAN}Server files:${RESET}"
  for f in server/app/domains/notes/*.py; do
    echo "    $f"
  done
  echo ""
fi

if [ -f "client/src/schemas/note.ts" ]; then
  echo -e "  ${CYAN}Client files:${RESET}"
  for f in \
    "client/src/schemas/note.ts" \
    "client/src/api/services/notes.ts" \
    "client/src/hooks/useNotes.ts" \
    "client/src/tests/handlers/notes.ts" \
    "client/src/pages/notes/NotesPage.tsx" \
    "client/src/pages/notes/Notes.css"; do
    [ -f "$f" ] && echo "    $f"
  done
  echo ""
fi

echo "  Key files to understand:"
echo ""
echo -e "  ${BOLD}server/app/domains/notes/models.py${RESET}"
echo "    SQLAlchemy model — defines database columns"
echo ""
echo -e "  ${BOLD}server/app/domains/notes/schemas.py${RESET}"
echo "    Pydantic schemas — request/response validation"
echo ""
echo -e "  ${BOLD}server/app/domains/notes/endpoints.py${RESET}"
echo "    FastAPI router — CRUD endpoint handlers"
echo ""
echo -e "  ${BOLD}client/src/schemas/note.ts${RESET}"
echo "    Zod schemas — client-side validation + TypeScript types"
echo ""
echo -e "  ${BOLD}client/src/hooks/useNotes.ts${RESET}"
echo "    React Query hooks — data fetching + mutations"

pause

# ── Step 4: Test the endpoint ─────────────────────────────────

step "Test your endpoint"

echo "  Now let's verify the endpoint works."
echo ""
echo "  If you haven't already, start the dev server in another terminal:"
echo ""
echo -e "    ${CYAN}make go${RESET}"
echo ""
echo "  Then you can test with curl:"
echo ""
echo -e "    ${DIM}# Check the API docs (opens in browser)${RESET}"
echo -e "    ${CYAN}open http://localhost:8080/docs${RESET}"
echo ""
echo -e "    ${DIM}# Hit the health endpoint${RESET}"
echo -e "    ${CYAN}curl http://localhost:8080/api/v1/health${RESET}"
echo ""
echo -e "    ${DIM}# The notes endpoints require auth — try the Swagger UI${RESET}"
echo -e "    ${DIM}# at http://localhost:8080/docs to test with login.${RESET}"

pause

# ── Step 5: Run tests ─────────────────────────────────────────

step "Run the test suite"

echo "  Let's run the server tests to make sure everything is wired up:"
echo ""
echo -e "    ${CYAN}make test-server${RESET}"
echo ""
echo "  Or run just the notes integration tests:"
echo ""
echo -e "    ${CYAN}cd server && uv run pytest tests/integration/test_notes.py -v${RESET}"
echo ""
echo "  For client tests:"
echo ""
echo -e "    ${CYAN}make test-client${RESET}"

pause

# ── Done! ─────────────────────────────────────────────────────

banner "Tutorial Complete!"

echo "  You've just:"
echo -e "    ${GREEN}✓${RESET} Verified your development environment"
echo -e "    ${GREEN}✓${RESET} Created a full CRUD domain (notes)"
echo -e "    ${GREEN}✓${RESET} Explored the generated code structure"
echo -e "    ${GREEN}✓${RESET} Learned how to test your endpoints"
echo ""
echo "  ${BOLD}What's next?${RESET}"
echo ""
echo "    1. Customise the notes model — edit server/app/domains/notes/models.py"
echo "    2. Add the route to client/src/App.tsx (see the generator output)"
echo "    3. Add more fields — update server schemas + client Zod schemas"
echo "    4. Create another domain:"
echo -e "       ${CYAN}make new-domain NAME=tasks${RESET}"
echo ""
echo "    5. Check the full guide:"
echo -e "       ${CYAN}docs/guides/en/without-claude-code.md${RESET}"
echo ""
echo "    6. If you have Claude Code, try the AI-powered workflow:"
echo -e "       ${CYAN}/athena:domain notes --fields \"title:string,body:text\"${RESET}"
echo ""
echo -e "  ${DIM}Happy building!${RESET}"
echo ""
