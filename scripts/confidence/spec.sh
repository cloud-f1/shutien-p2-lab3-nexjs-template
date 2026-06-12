#!/usr/bin/env bash
# scripts/confidence/spec.sh — Confidence scorer for SPEC step (E164).
# Counts ambiguity tokens (TBD/TODO/???/FIXME/WIP) in spec file.
# Bonus +0.10 if a green E156 qa_contract event exists for this epic.
# Env: AUDIT_FILE, SPEC_FILE (override).
set -uo pipefail
EPIC="${1:-}"; AUDIT_FILE="${AUDIT_FILE:-.claude/audit.jsonl}"; SPEC_FILE="${SPEC_FILE:-}"
[[ -z "$EPIC" ]] && { echo "0.0"; exit 0; }
if [[ -z "$SPEC_FILE" ]]; then
  num=$(echo "$EPIC" | tr -d 'Ee')
  SPEC_FILE=$(ls docs/epics/e"$num"-*.md 2>/dev/null | head -n 1)
fi
[[ -z "$SPEC_FILE" || ! -f "$SPEC_FILE" ]] && { echo "0.10"; exit 0; }
ambig=$(grep -ciE '\b(TBD|TODO|FIXME|\?\?\?|WIP)\b' "$SPEC_FILE" 2>/dev/null || echo 0)
base=$(awk -v a="$ambig" 'BEGIN{a+=0;
  if(a==0)s=0.85; else if(a<=2)s=0.70; else if(a<=5)s=0.50; else s=0.30; print s}')
bonus=0
if [[ -f "$AUDIT_FILE" ]] && command -v jq >/dev/null 2>&1; then
  hc=$(jq -s --arg e "$EPIC" '[.[]|select((.epic//"")==$e and .event=="qa_contract" and (.status//"pass")=="pass")]|length' "$AUDIT_FILE" 2>/dev/null)
  [[ "${hc:-0}" -gt 0 ]] && bonus="0.10"
fi
awk -v b="$base" -v x="$bonus" 'BEGIN{s=b+x; if(s>1)s=1; if(s<0)s=0; printf "%.2f\n",s}'
