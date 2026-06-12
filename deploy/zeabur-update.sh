#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE="$SCRIPT_DIR/zeabur-template.yaml"
ID=N8Y5Q5

# First time:
#   zeabur template create -f "$TEMPLATE"
# Then replace __TEMPLATE_ID__ above with the returned ID.

npx zeabur template update -c $ID -f "$TEMPLATE"
