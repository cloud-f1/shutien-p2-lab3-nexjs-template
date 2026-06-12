#!/usr/bin/env bash
# Deploy a preview environment for a PR
# Usage: deploy-preview.sh <pr-number>
# Env:   DEPLOY_PLATFORM=zeabur|cloudrun (default: zeabur)
set -euo pipefail

PR_NUM="${1:?Usage: deploy-preview.sh <pr-number>}"
PLATFORM="${DEPLOY_PLATFORM:-zeabur}"

echo "=== Preview Deploy: PR #${PR_NUM} ==="
echo "Platform: ${PLATFORM}"

case "$PLATFORM" in
  zeabur)
    echo "TODO: zbcli deploy --env preview-pr-${PR_NUM}"
    ;;
  cloudrun)
    echo "TODO: gcloud run deploy preview-pr-${PR_NUM} --tag pr-${PR_NUM}"
    ;;
  *)
    echo "Unknown platform: ${PLATFORM}"
    exit 1
    ;;
esac
