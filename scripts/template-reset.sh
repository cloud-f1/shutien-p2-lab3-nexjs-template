#!/usr/bin/env bash
set -euo pipefail

# ─── Template Reset Script ──────────────────────────────────
# One-time post-clone cleanup: removes project-specific history,
# resets context docs, and prepares a clean template state.
# Idempotent — safe to run multiple times.
#
# Template source of truth: docs/templates/context/ and
# docs/templates/epics/ — edit those files to change defaults.
# ─────────────────────────────────────────────────────────────

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE_CONTEXT="$ROOT/docs/templates/context"
TEMPLATE_EPICS="$ROOT/docs/templates/epics"
TEMPLATE_SCAFFOLD="$ROOT/docs/templates/scaffold"
DELETED=()
RESET=()
SKIPPED=()

# ─── Colors ─────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ─── Parse Flags ──────────────────────────────────────────────
AUTO_YES=false
ARCHIVE_EPICS=false
for arg in "$@"; do
    case "$arg" in
        -y|--yes) AUTO_YES=true ;;
        --archive|--archive-epics) ARCHIVE_EPICS=true ;;
    esac
done

# ─── Confirmation Prompt ────────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║          AI-Coding-Template — Reset Script              ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "This will:"
if [[ "$ARCHIVE_EPICS" == "true" ]]; then
echo "  • Archive existing epic specs + EPIC_INDEX to docs/epics/_archive/<date>/"
else
echo "  • Delete project-specific epic archives and specs"
fi
echo "  • Reset all context docs to empty templates"
echo "  • Remove project-specific skills and backward-compat shims"
echo ""
if [[ "$AUTO_YES" != "true" ]]; then
    echo -e "${YELLOW}⚠  This action is destructive and cannot be undone.${NC}"
    echo ""
    read -r -p "Continue? [y/N] " response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
fi

echo ""

# ─── Helpers ─────────────────────────────────────────────────
delete_if_exists() {
    local target="$1"
    local label="${2:-$1}"
    if [[ -e "$target" ]]; then
        rm -rf "$target"
        DELETED+=("$label")
        echo -e "  ${RED}✕${NC} Deleted: $label"
    else
        SKIPPED+=("$label (not found)")
    fi
}

copy_template() {
    local src="$1"
    local dest="$2"
    local label="${3:-$(basename "$dest")}"
    if [[ ! -f "$src" ]]; then
        echo -e "  ${RED}✕${NC} ERROR: Template missing: $src"
        exit 1
    fi
    cp "$src" "$dest"
    RESET+=("$label")
    echo -e "  ${GREEN}↺${NC} Reset:   $label"
}

# ─── S1a: Handle legacy archive directories ────────────────────
if [[ "$ARCHIVE_EPICS" == "true" ]]; then
    echo -e "${CYAN}Preserving legacy archive directories (no-op)...${NC}"
else
    echo -e "${CYAN}Cleaning archives...${NC}"
    delete_if_exists "$ROOT/docs/epics/archive" "docs/epics/archive/"
    delete_if_exists "$ROOT/docs/archive" "docs/archive/"
fi

# ─── S1b: Epic specs — archive or delete ────────────────────
if [[ "$ARCHIVE_EPICS" == "true" ]]; then
    stamp=$(date +%Y-%m-%d)
    archive_dir="$ROOT/docs/epics/_archive/$stamp-from-template"
    mkdir -p "$archive_dir"
    echo -e "${CYAN}Archiving epic specs → docs/epics/_archive/${stamp}-from-template/ ...${NC}"
    epic_count=0
    for f in "$ROOT"/docs/epics/e*-*.md "$ROOT"/docs/epics/phase-*-prd.md; do
        [[ -e "$f" ]] || continue
        mv "$f" "$archive_dir/"
        epic_count=$((epic_count + 1))
    done
    # Preserve current EPIC_INDEX as history before template overwrites it
    if [[ -f "$ROOT/docs/epics/EPIC_INDEX.md" ]]; then
        cp "$ROOT/docs/epics/EPIC_INDEX.md" "$archive_dir/EPIC_INDEX.md.snapshot"
    fi
    # README explaining the archive
    cat > "$archive_dir/README.md" <<EOF
# Template Heritage Archive — $stamp

These are the epics that landed in the ai-coding-template before this project
forked it. Preserved for reference — see patterns, lessons, and implementations
worth dogfooding. They are **not tracked** by \`/athena:loop\` on this project.

To start fresh, your own epics live in \`docs/epics/\` starting at E1.
EOF
    if [[ $epic_count -gt 0 ]]; then
        RESET+=("$epic_count epic specs → $archive_dir")
        echo -e "  ${GREEN}↺${NC} Archived: $epic_count epic specs + PRD snapshots"
    else
        SKIPPED+=("epic spec files (none found)")
    fi
else
    echo -e "${CYAN}Cleaning epic specs...${NC}"
    epic_count=0
    for f in "$ROOT"/docs/epics/e*-*.md; do
        [[ -e "$f" ]] || continue
        rm -f "$f"
        epic_count=$((epic_count + 1))
    done
    if [[ $epic_count -gt 0 ]]; then
        DELETED+=("$epic_count epic spec files")
        echo -e "  ${RED}✕${NC} Deleted: $epic_count epic spec files"
    else
        SKIPPED+=("epic spec files (none found)")
    fi
fi

# ─── S1c: Reset context docs from templates ──────────────────
echo -e "${CYAN}Resetting context docs (from docs/templates/context/)...${NC}"

copy_template "$TEMPLATE_CONTEXT/epic-progress.md"  "$ROOT/docs/context/epic-progress.md"  "epic-progress.md"
copy_template "$TEMPLATE_CONTEXT/strategy-log.md"   "$ROOT/docs/context/strategy-log.md"   "strategy-log.md"
copy_template "$TEMPLATE_CONTEXT/session-summary.md" "$ROOT/docs/context/session-summary.md" "session-summary.md"
copy_template "$TEMPLATE_CONTEXT/spec-log.md"        "$ROOT/docs/context/spec-log.md"        "spec-log.md"
copy_template "$TEMPLATE_CONTEXT/review-log.md"      "$ROOT/docs/context/review-log.md"      "review-log.md"
copy_template "$TEMPLATE_CONTEXT/debug-log.md"       "$ROOT/docs/context/debug-log.md"       "debug-log.md"
copy_template "$TEMPLATE_CONTEXT/test-status.md"     "$ROOT/docs/context/test-status.md"     "test-status.md"
copy_template "$TEMPLATE_CONTEXT/deploy-log.md"      "$ROOT/docs/context/deploy-log.md"      "deploy-log.md"
copy_template "$TEMPLATE_CONTEXT/decisions.md"       "$ROOT/docs/context/decisions.md"       "decisions.md"
copy_template "$TEMPLATE_CONTEXT/qa-patterns.md"     "$ROOT/docs/context/qa-patterns.md"     "qa-patterns.md"

# ─── S1d: Reset EPIC_INDEX from template ─────────────────────
echo -e "${CYAN}Resetting EPIC_INDEX (from docs/templates/epics/)...${NC}"

copy_template "$TEMPLATE_EPICS/EPIC_INDEX.md" "$ROOT/docs/epics/EPIC_INDEX.md" "EPIC_INDEX.md"

# ─── S1d2: Reset roadmap from template ─────────────────────────
echo -e "${CYAN}Resetting roadmap (from docs/templates/scaffold/)...${NC}"

copy_template "$TEMPLATE_SCAFFOLD/roadmap.md.tmpl" "$ROOT/docs/roadmap.md" "roadmap.md"

# ─── S1e: Delete project-specific skill ──────────────────────
echo -e "${CYAN}Cleaning project-specific files...${NC}"
delete_if_exists "$ROOT/.claude/skills/upgrade-stripe.md" ".claude/skills/upgrade-stripe.md"

# ─── S1f: Remove backward-compat shims ──────────────────────
delete_if_exists "$ROOT/server/app/models/portfolio.py" "server/app/models/portfolio.py"
delete_if_exists "$ROOT/server/app/schemas/portfolio.py" "server/app/schemas/portfolio.py"
delete_if_exists "$ROOT/server/app/api/v1/endpoints/portfolios.py" "server/app/api/v1/endpoints/portfolios.py"

# ─── Summary ────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    Reset Complete                        ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${RED}Deleted:${NC}  ${#DELETED[@]} items"
if [[ ${#DELETED[@]} -gt 0 ]]; then
    for item in "${DELETED[@]}"; do
        echo "    • $item"
    done
fi
echo -e "  ${GREEN}Reset:${NC}    ${#RESET[@]} files (from templates)"
if [[ ${#RESET[@]} -gt 0 ]]; then
    for item in "${RESET[@]}"; do
        echo "    • $item"
    done
fi
if [[ ${#SKIPPED[@]} -gt 0 ]]; then
    echo -e "  ${YELLOW}Skipped:${NC}  ${#SKIPPED[@]} items (already clean)"
    for item in "${SKIPPED[@]}"; do
        echo "    • $item"
    done
fi
echo ""
echo -e "${GREEN}Template is ready for a new project. Happy building!${NC}"
echo ""
