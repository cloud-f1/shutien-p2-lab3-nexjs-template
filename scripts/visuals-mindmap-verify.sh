#!/usr/bin/env bash
# ─── Verify live data in docs/visuals/agent-team-mindmap.html ──────────────
# Compares the hardcoded stats (agents / commands / hooks / stop rules)
# in the mindmap HTML against what's actually in the repo.
#
# Usage:
#   ./scripts/visuals-mindmap-verify.sh          # verify; exit 1 on drift
#   ./scripts/visuals-mindmap-verify.sh --fix    # auto-patch the HTML
# ────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HTML="$ROOT/docs/visuals/agent-team-mindmap.html"

[[ -f "$HTML" ]] || { echo "Error: $HTML not found"; exit 1; }

FIX=0
case "${1:-}" in
  --fix) FIX=1 ;;
esac

# ─── Live counts ─────────────────────────────────────────────────────────────
AGENTS=$(ls "$ROOT"/.claude/agents/*.md 2>/dev/null | grep -v '\.tmpl$' | wc -l | tr -d ' ')
COMMANDS=$(ls "$ROOT"/.claude/commands/athena/*.md 2>/dev/null | wc -l | tr -d ' ')
# Runnable command count = total minus the 1 pattern/lesson doc (qa-enforcement-pattern)
if [[ -f "$ROOT/.claude/commands/athena/qa-enforcement-pattern.md" ]]; then
  RUNNABLE_COMMANDS=$((COMMANDS - 1))
else
  RUNNABLE_COMMANDS=$COMMANDS
fi
HOOKS=$(ls "$ROOT"/scripts/hooks/*.sh 2>/dev/null | wc -l | tr -d ' ')
STOP_RULES=$(grep -cE '^# Rule [0-9]+' "$ROOT/scripts/hooks/stop-verifier.sh" 2>/dev/null || echo 0)
# Stop rules inside functions may use different format — count unique Rule # references
STOP_RULES_ALT=$(grep -oE 'Rule [0-9]+:' "$ROOT/scripts/hooks/stop-verifier.sh" 2>/dev/null | sort -u | wc -l | tr -d ' ')
# Use the larger of the two as the canonical count
if (( STOP_RULES_ALT > STOP_RULES )); then STOP_RULES=$STOP_RULES_ALT; fi

echo "Live repo counts:"
echo "  agents:    $AGENTS"
echo "  commands:  $COMMANDS (runnable: $RUNNABLE_COMMANDS)"
echo "  hooks:     $HOOKS"
echo "  stop-rules: $STOP_RULES"
echo ""

# ─── Parse current HTML values ───────────────────────────────────────────────
get_stat() {
  local id="$1"
  grep -oE "id=\"stat-$id\">[0-9]+" "$HTML" | grep -oE '[0-9]+' | head -1
}

HTML_AGENTS=$(get_stat agents)
HTML_COMMANDS=$(get_stat commands)
HTML_HOOKS=$(get_stat hooks)
HTML_RULES=$(get_stat rules)

echo "HTML stats:"
echo "  agents:    $HTML_AGENTS"
echo "  commands:  $HTML_COMMANDS"
echo "  hooks:     $HTML_HOOKS"
echo "  stop-rules: $HTML_RULES"
echo ""

# ─── Compare ─────────────────────────────────────────────────────────────────
DRIFT=0
cmp_stat() {
  local name="$1" live="$2" html="$3"
  if [[ "$live" != "$html" ]]; then
    echo "  ⚠  $name: HTML=$html  live=$live"
    DRIFT=1
  fi
}

cmp_stat "agents"     "$AGENTS"            "$HTML_AGENTS"
cmp_stat "commands"   "$RUNNABLE_COMMANDS" "$HTML_COMMANDS"
cmp_stat "hooks"      "$HOOKS"             "$HTML_HOOKS"
cmp_stat "stop-rules" "$STOP_RULES"        "$HTML_RULES"

if (( DRIFT == 0 )); then
  echo "✅ All stats in sync."
  exit 0
fi

if (( FIX == 0 )); then
  echo ""
  echo "Drift detected. Run with --fix to auto-patch."
  exit 1
fi

# ─── Auto-fix ────────────────────────────────────────────────────────────────
echo ""
echo "Patching $HTML..."

sedi() {
  if [[ "$(uname)" == "Darwin" ]]; then sed -i '' "$@"
  else sed -i "$@"
  fi
}

sedi -E "s|(id=\"stat-agents\">)[0-9]+|\1${AGENTS}|"           "$HTML"
sedi -E "s|(id=\"stat-commands\">)[0-9]+|\1${RUNNABLE_COMMANDS}|" "$HTML"
sedi -E "s|(id=\"stat-hooks\">)[0-9]+|\1${HOOKS}|"             "$HTML"
sedi -E "s|(id=\"stat-rules\">)[0-9]+|\1${STOP_RULES}|"        "$HTML"

# Also fix the subtitle line (e.g. "10 AGENTS · 20 COMMANDS · 18 STOP RULES")
sedi -E "s|[0-9]+ AGENTS · [0-9]+ COMMANDS · [0-9]+ STOP RULES|${AGENTS} AGENTS · ${RUNNABLE_COMMANDS} COMMANDS · ${STOP_RULES} STOP RULES|" "$HTML"

echo "✅ Patched. Verify with: git diff $HTML"
