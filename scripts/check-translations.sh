#!/usr/bin/env bash
# Validates that en and zh-TW have identical key sets per namespace.
# Exit code 0 = all match, 1 = mismatch found.

set -euo pipefail

LOCALES_DIR="client/src/locales"
NAMESPACES=("common" "auth" "dashboard" "landing" "billing" "errors")
exit_code=0

for ns in "${NAMESPACES[@]}"; do
  en_keys=$(jq -r 'keys[]' "$LOCALES_DIR/en/$ns.json" | sort)
  zh_keys=$(jq -r 'keys[]' "$LOCALES_DIR/zh-TW/$ns.json" | sort)

  if diff <(echo "$en_keys") <(echo "$zh_keys") > /dev/null 2>&1; then
    echo "OK: $ns"
  else
    echo "MISMATCH: $ns"
    diff <(echo "$en_keys") <(echo "$zh_keys") || true
    exit_code=1
  fi
done

exit $exit_code
