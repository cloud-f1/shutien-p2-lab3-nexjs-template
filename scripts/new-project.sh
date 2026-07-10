#!/usr/bin/env bash
# scripts/new-project.sh — interactive fork → new-product bootstrap wizard.
#
# Walks you through the DETERMINISTIC half of turning this template into your product:
# product name, repo slug, docs domain, and pruning unused template skills. It does NOT
# rewrite prose or domain logic — that's judgment work left to `/athena:new-project`
# (the agent command) and `/athena:plan`. See `.claude/skills/new-project/` +
# `docs/TEMPLATE-VS-PRODUCT.md`.
#
# Usage:
#   scripts/new-project.sh            # dry-run: prompt + preview the plan, change nothing
#   scripts/new-project.sh --apply    # prompt, confirm, then apply the deterministic edits
#
# Safe by design: dry-run default, every edit is scoped find/replace, one confirm before --apply.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
APPLY=false; [[ "${1:-}" == "--apply" ]] && APPLY=true

BLD=$'\033[1m'; CYN=$'\033[0;36m'; GRN=$'\033[0;32m'; YLW=$'\033[1;33m'; DIM=$'\033[2m'; NC=$'\033[0m'
say()  { printf "%s\n" "$*"; }
ask()  { local p="$1" d="$2" v; read -r -p "$(printf "%s%s%s [%s%s%s]: " "$CYN" "$p" "$NC" "$DIM" "$d" "$NC")" v; printf "%s" "${v:-$d}"; }
yesno(){ local p="$1" d="${2:-n}" v; read -r -p "$(printf "%s%s%s (y/N): " "$CYN" "$p" "$NC")" v; v="${v:-$d}"; [[ "$v" =~ ^[Yy] ]]; }
BRANDING="next-app/lib/branding.ts"

# ── Detect current (OLD) identity dynamically — works for any fork ─────────────
OLD_NAME="$(grep -oE '\|\| *"[^"]+"' "$BRANDING" 2>/dev/null | head -1 | sed -E 's/.*"([^"]+)"/\1/' || echo 'AI App Template')"
OLD_SLUG="$(git remote get-url origin 2>/dev/null | sed -E 's#.*[:/]([^/]+/[^/]+)$#\1#; s#\.git$##' || echo '')"
# the slug literally hardcoded in the docs (what we must replace) — may differ from origin on a fresh fork
HARDCODED_SLUG="$(grep -rhoE 'github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+' README.md 2>/dev/null | sed -E 's#github.com/##; s#\.git$##' | sort | uniq -c | sort -rn | head -1 | awk '{print $2}' || echo '')"
OLD_DOMAIN="$(grep -rhoE '[a-z0-9-]+\.pages\.dev' dev-docs/.vitepress/config.mts README.md 2>/dev/null | sort | uniq -c | sort -rn | head -1 | awk '{print $2}' || echo '')"

say ""
say "${BLD}new-project — template → product bootstrap${NC}  ${DIM}($([ "$APPLY" = true ] && echo APPLY || echo dry-run))${NC}"
say "${DIM}Detected current identity → product:'${OLD_NAME:-?}'  repo:'${HARDCODED_SLUG:-?}'  docs:'${OLD_DOMAIN:-none}'${NC}"
say ""

# ── 1. Collect the new identity ───────────────────────────────────────────────
NEW_NAME="$(ask 'Product name' "${OLD_NAME}")"
NEW_SLUG="$(ask 'New repo slug (org/repo)' "${OLD_SLUG:-$HARDCODED_SLUG}")"
NEW_DOMAIN="$(ask 'Docs domain (blank = skip)' "${OLD_DOMAIN}")"

# ── 2. Choose template-only skills to prune (per TEMPLATE-VS-PRODUCT.md) ───────
# Template-substrate skills a fork may not need. The loop skips any that don't exist,
# so this list is safe to over-specify for forks taken from an earlier point.
TEMPLATE_SKILLS=(install-landing module-author deploy-config spec-first install-stripe-billing install-ecpay-billing upgrade-stripe)
PRUNE=()
say ""; say "${BLD}Template-only skills${NC} ${DIM}(substrate — prune what your product won't use)${NC}"
for s in "${TEMPLATE_SKILLS[@]}"; do
  [ -e ".claude/skills/$s" ] || continue
  if yesno "  prune .claude/skills/$s ?"; then PRUNE+=("$s"); fi
done

# ── 3. Plan summary + confirm ─────────────────────────────────────────────────
say ""; say "${BLD}━━ Plan ━━${NC}"
say "  ${GRN}set${NC}      $BRANDING APP_NAME default → ${BLD}$NEW_NAME${NC}"
[ -n "${HARDCODED_SLUG:-}" ] && [ "${HARDCODED_SLUG:-}" != "$NEW_SLUG" ] && say "  ${GRN}replace${NC}  repo slug ${YLW}$HARDCODED_SLUG${NC} → ${BLD}$NEW_SLUG${NC}  (README.md, dev-docs/.vitepress/config.mts)"
[ -n "${OLD_DOMAIN:-}" ] && [ -n "$NEW_DOMAIN" ] && [ "$OLD_DOMAIN" != "$NEW_DOMAIN" ] && say "  ${GRN}replace${NC}  docs domain ${YLW}$OLD_DOMAIN${NC} → ${BLD}$NEW_DOMAIN${NC}"
[ ${#PRUNE[@]} -gt 0 ] && say "  ${GRN}remove${NC}   skills: ${PRUNE[*]}"
say "  ${DIM}defer to agent: CLAUDE.md prose, README intro, roles/permissions, seed accounts, screens${NC}"
say ""

if [ "$APPLY" != true ]; then
  say "${YLW}Dry-run.${NC} Re-run with ${BLD}--apply${NC} to make these changes."
else
  yesno "Apply the above now?" || { say "Aborted."; exit 0; }
  # APP_NAME default (replace the || "..." fallback in branding.ts)
  perl -0pi -e "s/(\|\|\s*)\"[^\"]+\"/\$1\"$NEW_NAME\"/" "$BRANDING"
  # repo slug + docs domain (scoped to the live identity files)
  FILES=(README.md dev-docs/.vitepress/config.mts dev-docs/index.md)
  for f in "${FILES[@]}"; do [ -f "$f" ] || continue
    [ -n "${HARDCODED_SLUG:-}" ] && perl -pi -e "s{\Q$HARDCODED_SLUG\E}{$NEW_SLUG}g" "$f"
    [ -n "${OLD_DOMAIN:-}" ] && [ -n "$NEW_DOMAIN" ] && perl -pi -e "s{\Q$OLD_DOMAIN\E}{$NEW_DOMAIN}g" "$f"
  done
  for s in "${PRUNE[@]}"; do rm -rf ".claude/skills/$s"; done
  say "${GRN}Applied.${NC}"
fi

# ── 4. Leftover audit + next steps (always) ───────────────────────────────────
say ""; say "${BLD}━━ Brand-staleness check (audit Step 6b) ━━${NC}"
say "${DIM}Scanning live identity files for old template references...${NC}"
grep -rn "ai-coding-nexjs-template\|AI App Template" . \
  --include="*.md" --include="*.ts" --include="*.json" \
  --exclude-dir=".git" --exclude-dir="node_modules" --exclude-dir=".next" \
  2>/dev/null | head -20 || true

say ""; say "${BLD}━━ Next (agent-driven — not done by this script) ━━${NC}"
cat <<NEXT
  1. /athena:new-project "$NEW_NAME"   — rewrite CLAUDE.md identity + README intro to your product
  2. Reset roles: next-app/lib/permissions.ts (admin/editor/viewer → your roles)
  3. Reset seed accounts: next-app/drizzle/seed.ts (admin@example.com etc → your demo accounts)
  4. make new-project          — archive template epics, start from E1
  5. /athena:audit             — confirm zero brand/identity/doc↔code drift
  6. bash scripts/pre-merge-check.sh && (cd dev-docs && pnpm build)   — hand the fork a green tree
NEXT
say ""
