#!/usr/bin/env bash
# brainstorm-emit.sh — atomic writes for /athena:plan brainstorm.
# Subcommands:
#   strategy-log <json-file>   Append brainstorm row to strategy-log.md
#   render-epic   <json-file>  Write enriched epic file at docs/epics/e{n}-*.md
#
# Env vars (test injection):
#   AUDIT_LOG_PATH       override .claude/audit.jsonl
#   STRATEGY_LOG_PATH    override docs/context/strategy-log.md
#   EPICS_DIR            override docs/epics
#   CLOCK_DATE           override date -u +%Y-%m-%d (date-only, for strategy-log row header)
#   CLOCK_TS             override timestamp ISO 8601 (for audit events)

set -euo pipefail

SUBCMD="${1:-}"
INPUT_JSON="${2:-}"

if [ -z "$SUBCMD" ] || [ -z "$INPUT_JSON" ]; then
  echo "usage: brainstorm-emit.sh {strategy-log|render-epic} <json-file>" >&2
  exit 64
fi

if [ ! -f "$INPUT_JSON" ]; then
  echo "error: input json not found: $INPUT_JSON" >&2
  exit 65
fi

emit_audit() {
  local epic="$1"
  local status="$2"
  local phase_count="$3"
  local audit_log="${AUDIT_LOG_PATH:-.claude/audit.jsonl}"
  local ts="${CLOCK_TS:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}"

  mkdir -p "$(dirname "$audit_log")" 2>/dev/null || return 0
  if command -v jq >/dev/null 2>&1; then
    jq -n -c \
      --arg ts "$ts" \
      --arg event "plan_brainstorm" \
      --arg epic "$epic" \
      --arg status "$status" \
      --argjson phase_count "$phase_count" \
      '{ts:$ts,event:$event,epic:$epic,status:$status,phase_count:$phase_count}' \
      >> "$audit_log" 2>/dev/null || true
  fi
}

validate_required_fields() {
  local input="$1"
  for field in epic slug name; do
    val=$(jq -r ".$field // empty" "$input")
    if [ -z "$val" ]; then
      echo "error: missing required field: $field" >&2
      return 65
    fi
  done
}

strategy_log_subcmd() {
  local input="$1"
  local strategy_log="${STRATEGY_LOG_PATH:-docs/context/strategy-log.md}"
  local ts="${CLOCK_DATE:-$(date -u +%Y-%m-%d)}"

  validate_required_fields "$input"

  if [ ! -f "$strategy_log" ]; then
    echo "error: strategy log not found: $strategy_log" >&2
    return 66
  fi

  local epic name priority size sp rationale deps risks test_strategy
  epic=$(jq -r '.epic' "$input")
  name=$(jq -r '.name' "$input")
  priority=$(jq -r '.priority' "$input")
  size=$(jq -r '.size' "$input")
  sp=$(jq -r '.sp' "$input")
  rationale=$(jq -r '.rationale' "$input")
  deps=$(jq -r '.dependencies | join(", ")' "$input")
  risks=$(jq -r '.risks | join("; ")' "$input")
  test_strategy=$(jq -r '.test_strategy' "$input")

  {
    echo ""
    echo "### $epic — $name — $ts (brainstorm)"
    echo ""
    echo "| Field | Value |"
    echo "|---|---|"
    echo "| Priority | $priority |"
    echo "| Size | $size |"
    echo "| SP | $sp |"
    echo "| Rationale | $rationale |"
    echo "| Dependencies | $deps |"
    echo ""
    echo "**Phases:**"
    jq -r '.phases[] | "\(.id). \(.name) — \(.tasks | join("; "))"' "$input"
    echo ""
    echo "**Checkpoints:**"
    jq -r '.checkpoints[] | "- Phase \(.phase): \(.verify)"' "$input"
    echo ""
    echo "**Test Strategy:** $test_strategy"
    echo ""
    echo "**Risks:** $risks"
    echo ""
    echo "⏸️ AWAITING HUMAN APPROVAL — run \`/athena:plan approve $epic\` to render \`docs/epics/$(echo "$epic" | tr 'A-Z' 'a-z')-$(jq -r '.slug' "$input").md\`"
  } >> "$strategy_log"

  emit_audit "$epic" "proposed" "$(jq '.phases | length' "$input")"
}

render_epic_subcmd() {
  local input="$1"
  local epics_dir="${EPICS_DIR:-docs/epics}"

  validate_required_fields "$input"

  if [ ! -d "$epics_dir" ]; then
    echo "error: epics dir not found: $epics_dir" >&2
    return 66
  fi

  local epic slug name size sp deps rationale risks test_strategy
  epic=$(jq -r '.epic' "$input")
  slug=$(jq -r '.slug' "$input")
  name=$(jq -r '.name' "$input")
  size=$(jq -r '.size' "$input")
  sp=$(jq -r '.sp' "$input")
  deps=$(jq -r '.dependencies | join(", ")' "$input")
  rationale=$(jq -r '.rationale' "$input")
  risks=$(jq -r '.risks | map("- " + .) | join("\n")' "$input")
  test_strategy=$(jq -r '.test_strategy' "$input")

  local lower_epic
  lower_epic=$(echo "$epic" | tr 'A-Z' 'a-z')
  local out="$epics_dir/${lower_epic}-${slug}.md"

  if [ -f "$out" ]; then
    echo "error: epic file already exists: $out" >&2
    return 68
  fi

  {
    echo "# $epic — $name"
    echo ""
    echo "> Phase 46 — Workflow Discipline + Memory-Aware Planning | Size: $size ($sp SP) | Deps: $deps"
    echo ""
    echo "## Problem"
    echo ""
    echo "$rationale"
    echo ""
    echo "## Implementation Phases"

    local phase_count
    phase_count=$(jq '.phases | length' "$input")
    local i=0
    while [ "$i" -lt "$phase_count" ]; do
      local pid pname tasks verify
      pid=$(jq -r ".phases[$i].id" "$input")
      pname=$(jq -r ".phases[$i].name" "$input")
      tasks=$(jq -r ".phases[$i].tasks | map(\"- \" + .) | join(\"\n\")" "$input")
      verify=$(jq -r ".checkpoints[] | select(.phase == $pid) | .verify" "$input")
      echo ""
      echo "### Phase $pid — $pname"
      echo ""
      echo "$tasks"
      echo ""
      echo "**Checkpoint:** $verify"
      i=$((i+1))
    done

    echo ""
    echo "## Test Strategy"
    echo ""
    echo "$test_strategy"
    echo ""
    echo "## Risks"
    echo ""
    echo "$risks"
    echo ""
    echo "## Acceptance Criteria"
    echo ""
    echo "- [ ] All phase checkpoints pass"
    echo "- [ ] Test strategy implemented"
    echo "- [ ] Coverage gate ≥80% in modified domains"
    echo "- [ ] No new Stop Verifier violations"
  } > "$out"

  emit_audit "$epic" "approved" "$(jq '.phases | length' "$input")"

  echo "$out"
}

case "$SUBCMD" in
  strategy-log) strategy_log_subcmd "$INPUT_JSON" ;;
  render-epic)  render_epic_subcmd "$INPUT_JSON" ;;
  *)
    echo "unknown subcommand: $SUBCMD" >&2
    exit 67
    ;;
esac
