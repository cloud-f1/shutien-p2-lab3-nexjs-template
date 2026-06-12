#!/usr/bin/env bash
# scripts/confidence/qa.sh — Confidence scorer for QA step (E164).
# Reads E162 review_loop event for <epic>; outputs float [0,1] to stdout.
# Hard-fail (0.0) if HIGH findings > 0; else round_factor * tqs.
# Env: AUDIT_FILE, QA_ROUNDS, QA_HIGH_FINDINGS, QA_TEST_QUALITY_SCORE (override).
set -uo pipefail
EPIC="${1:-}"; AUDIT_FILE="${AUDIT_FILE:-.claude/audit.jsonl}"
[[ -z "$EPIC" ]] && { echo "0.0"; exit 0; }
rounds="${QA_ROUNDS:-}"; high="${QA_HIGH_FINDINGS:-}"; tqs="${QA_TEST_QUALITY_SCORE:-}"
if [[ -z "$rounds$high$tqs" && -f "$AUDIT_FILE" ]] && command -v jq >/dev/null 2>&1; then
  audit=$(jq -s --arg e "$EPIC" '[.[]|select((.epic//"")==$e and .event=="review_loop")]|last' "$AUDIT_FILE" 2>/dev/null)
  if [[ -n "$audit" && "$audit" != "null" ]]; then
    [[ -z "$rounds" ]] && rounds=$(echo "$audit"|jq -r '.rounds // empty')
    [[ -z "$high"   ]] && high=$(echo "$audit"|jq -r '.high_findings // .final_issues // empty')
    [[ -z "$tqs"    ]] && tqs=$(echo "$audit"|jq -r '.test_quality_score // empty')
  fi
fi
# If rounds is still unset (no audit event found), query the log directly before
# falling back to a safe default of 0 (not 99 — 99 permanently deflates the score).
if [[ -z "$rounds" && -f "$AUDIT_FILE" ]] && command -v jq >/dev/null 2>&1; then
  rounds=$(jq -r '[.[] | select(.event=="review_loop" and (.epic//"")==$e)] | last | .rounds // empty' \
    --arg e "$EPIC" "$AUDIT_FILE" 2>/dev/null || echo "")
fi
rounds="${rounds:-0}"; high="${high:-0}"; tqs="${tqs:-0.0}"
[[ "$high" =~ ^[0-9]+$ ]] && (( high > 0 )) && { echo "0.0"; exit 0; }
awk -v r="$rounds" -v t="$tqs" 'BEGIN{
  r+=0; t+=0; if(t<0)t=0; if(t>1)t=1
  rf=(r<=2)?1.0:(r==3)?0.7:0.4
  s=rf*t; if(s<0)s=0; if(s>1)s=1; printf "%.2f\n",s }'
