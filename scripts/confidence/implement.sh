#!/usr/bin/env bash
# scripts/confidence/implement.sh — Confidence scorer for IMPLEMENT step (E164).
# Signals (env-overridable):
#   IMPL_TESTS_GREEN (1/0), IMPL_COVERAGE_DELTA (float), IMPL_NEW_VIOLATIONS (int).
# Fallback: scan recent audit `bash` events for pytest/vitest exit codes.
set -uo pipefail
EPIC="${1:-}"; AUDIT_FILE="${AUDIT_FILE:-.claude/audit.jsonl}"
[[ -z "$EPIC" ]] && { echo "0.0"; exit 0; }
green="${IMPL_TESTS_GREEN:-}"; delta="${IMPL_COVERAGE_DELTA:-}"; viols="${IMPL_NEW_VIOLATIONS:-}"
if [[ -z "$green" && -f "$AUDIT_FILE" ]] && command -v jq >/dev/null 2>&1; then
  failed=$(jq -s --arg e "$EPIC" '
    [.[]|select((.epic//"")==$e and .event=="bash" and (.exit//0)!=0
      and ((.cmd//"")|test("pytest|vitest|pnpm.*test")))]|length' "$AUDIT_FILE" 2>/dev/null)
  green=$([[ "${failed:-0}" -eq 0 ]] && echo 1 || echo 0)
fi
green="${green:-0}"; delta="${delta:-0}"; viols="${viols:-0}"
awk -v g="$green" -v d="$delta" -v v="$viols" 'BEGIN{
  s=0.05  # base completeness
  if(g+0==1) s+=0.55
  if(d+0>=0) s+=0.25
  if(v+0==0) s+=0.15
  if(s<0)s=0; if(s>1)s=1; printf "%.2f\n",s }'
