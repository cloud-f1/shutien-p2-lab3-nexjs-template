#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# verify-customization.sh — Post-clone customization verifier
# Checks that all template placeholders have been replaced and
# essential configuration is in place before first deploy.
# ──────────────────────────────────────────────────────────────
set -uo pipefail

# ─── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
RESET='\033[0m'

PASS="${GREEN}✅${RESET}"
FAIL="${RED}❌${RESET}"
WARN="${YELLOW}⚠️${RESET}"

# ─── State ───────────────────────────────────────────────────
FAILURES=0
CHECK_NUM=0

check() {
  CHECK_NUM=$((CHECK_NUM + 1))
  local label="$1"
  local ok="$2"
  local hint="$3"

  if [ "$ok" = "true" ]; then
    printf "  ${PASS}  Check %d: %s\n" "$CHECK_NUM" "$label"
  else
    printf "  ${FAIL}  Check %d: %s\n" "$CHECK_NUM" "$label"
    printf "     ${YELLOW}Fix: %s${RESET}\n" "$hint"
    FAILURES=$((FAILURES + 1))
  fi
}

printf "\n"
printf "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
printf "  ${BOLD}make verify${RESET} — Post-Clone Customization Verifier\n"
printf "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
printf "\n"

# ─── Check 1: OpenAPI title ──────────────────────────────────
OPENAPI_FILE="docs/openapi.yaml"
if [ -f "$OPENAPI_FILE" ]; then
  if grep -q "AI-Coding-Template" "$OPENAPI_FILE" || grep -q "AI Coding Template" "$OPENAPI_FILE"; then
    check "OpenAPI title customized" "false" \
      "Edit docs/openapi.yaml → info.title to your project name"
  else
    check "OpenAPI title customized" "true" ""
  fi
else
  check "OpenAPI title customized" "false" \
    "docs/openapi.yaml not found — restore from template"
fi

# ─── Check 2: CLAUDE.md PROJECT_DISPLAY ──────────────────────
CLAUDE_FILE="CLAUDE.md"
if [ -f "$CLAUDE_FILE" ]; then
  if grep -q '{{PROJECT_DISPLAY}}' "$CLAUDE_FILE"; then
    check "CLAUDE.md PROJECT_DISPLAY customized" "false" \
      "Replace {{PROJECT_DISPLAY}} in CLAUDE.md with your project name"
  else
    check "CLAUDE.md PROJECT_DISPLAY customized" "true" ""
  fi
else
  check "CLAUDE.md PROJECT_DISPLAY customized" "false" \
    "CLAUDE.md not found — restore from template"
fi

# ─── Check 3–5: .env secrets ────────────────────────────────
ENV_FILE="server/.env"
if [ -f "$ENV_FILE" ]; then
  # Source .env safely (handle comments and empty lines)
  _get_env_val() {
    grep -E "^${1}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d'=' -f2-
  }

  # Placeholder values from server/app/core/config.py
  PLACEHOLDER_SECRETS=(
    "CHANGE_ME_TO_A_RANDOM_64_CHAR_HEX_STRING"
    "CHANGE_ME_TO_A_RANDOM_64_CHAR_HEX_STRING_refresh"
    "CHANGE_ME_REFRESH_SECRET"
    "changeme"
    "secret"
  )

  _is_placeholder() {
    local val="$1"
    for p in "${PLACEHOLDER_SECRETS[@]}"; do
      if [ "$val" = "$p" ]; then
        return 0
      fi
    done
    return 1
  }

  # Check 3: SECRET_KEY
  SK=$(_get_env_val "SECRET_KEY")
  if [ -z "$SK" ] || _is_placeholder "$SK"; then
    check "SECRET_KEY is not a placeholder" "false" \
      "Run: openssl rand -hex 32 — paste into server/.env SECRET_KEY"
  else
    check "SECRET_KEY is not a placeholder" "true" ""
  fi

  # Check 4: REFRESH_SECRET_KEY
  RSK=$(_get_env_val "REFRESH_SECRET_KEY")
  if [ -z "$RSK" ] || _is_placeholder "$RSK"; then
    check "REFRESH_SECRET_KEY is not a placeholder" "false" \
      "Run: openssl rand -hex 32 — paste into server/.env REFRESH_SECRET_KEY"
  else
    check "REFRESH_SECRET_KEY is not a placeholder" "true" ""
  fi

  # Check 5: DATABASE_URL
  DB_URL=$(_get_env_val "DATABASE_URL")
  if [ -z "$DB_URL" ]; then
    check "DATABASE_URL is set" "false" \
      "Set DATABASE_URL in server/.env (e.g. postgresql+asyncpg://user:pass@localhost:5432/mydb)"
  else
    check "DATABASE_URL is set" "true" ""
  fi
else
  check "SECRET_KEY is not a placeholder" "false" \
    "server/.env not found — run: make ensure-env"
  check "REFRESH_SECRET_KEY is not a placeholder" "false" \
    "server/.env not found — run: make ensure-env"
  check "DATABASE_URL is set" "false" \
    "server/.env not found — run: make ensure-env"
fi

# ─── Check 6: OAuth provider ────────────────────────────────
if [ -f "$ENV_FILE" ]; then
  GOOGLE_ID=$(_get_env_val "GOOGLE_CLIENT_ID")
  GITHUB_ID=$(_get_env_val "GITHUB_CLIENT_ID")
  OAUTH_DISABLED=$(_get_env_val "OAUTH_DISABLED")

  if [ "$OAUTH_DISABLED" = "true" ]; then
    check "OAuth configured (or explicitly disabled)" "true" ""
  elif [ -n "$GOOGLE_ID" ] || [ -n "$GITHUB_ID" ]; then
    check "OAuth configured (or explicitly disabled)" "true" ""
  else
    check "OAuth configured (or explicitly disabled)" "false" \
      "Set GOOGLE_CLIENT_ID or GITHUB_CLIENT_ID in server/.env, or add OAUTH_DISABLED=true"
  fi
else
  check "OAuth configured (or explicitly disabled)" "false" \
    "server/.env not found — run: make ensure-env"
fi

# ─── Check 7: Email provider in production ───────────────────
if [ -f "$ENV_FILE" ]; then
  ENV_MODE=$(_get_env_val "ENVIRONMENT")
  EMAIL_PROV=$(_get_env_val "EMAIL_PROVIDER")

  if [ "$ENV_MODE" = "production" ] && [ "$EMAIL_PROV" = "console" ]; then
    check "Email provider set for production" "false" \
      "Set EMAIL_PROVIDER to 'mailgun' or 'zeabur' in server/.env (console is dev-only)"
  else
    check "Email provider set for production" "true" ""
  fi
else
  check "Email provider set for production" "false" \
    "server/.env not found — run: make ensure-env"
fi

# ─── Check 8: README.md title ───────────────────────────────
README_FILE="README.md"
if [ -f "$README_FILE" ]; then
  FIRST_LINE=$(head -1 "$README_FILE")
  if echo "$FIRST_LINE" | grep -qi "AI Coding Template"; then
    check "README.md title customized" "false" \
      "Edit the first line of README.md to your project name"
  else
    check "README.md title customized" "true" ""
  fi
else
  check "README.md title customized" "false" \
    "README.md not found — restore from template"
fi

# ─── Summary ────────────────────────────────────────────────
printf "\n"
if [ "$FAILURES" -eq 0 ]; then
  printf "  ${GREEN}${BOLD}All %d checks passed!${RESET} Your project is fully customized.\n" "$CHECK_NUM"
else
  printf "  ${RED}${BOLD}%d of %d checks failed.${RESET} Please fix the items above.\n" "$FAILURES" "$CHECK_NUM"
  printf "  ${YELLOW}Tip: Run 'make init' or 'pnpm new-site' for guided customization.${RESET}\n"
fi
printf "\n"

if [ "$FAILURES" -gt 0 ]; then
  exit 1
fi
