#!/bin/bash
set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

REGISTRY="asia-east1-docker.pkg.dev/common-411213"
ENV="${1:-dev}"

if [[ "$ENV" == "prd" ]]; then
  REPO="prd-app"
  TAG="prd"
  VITE_API_URL="https://coding-template-api.zeabur.app"
else
  REPO="dev-app"
  TAG="dev"
  VITE_API_URL="https://dev-coding-template-api.zeabur.app"
fi

SERVER_IMAGE="$REGISTRY/$REPO/ai-coding-template-server:$TAG"
CLIENT_IMAGE="$REGISTRY/$REPO/ai-coding-template-client:$TAG"

echo "=== Building & pushing to $REPO ($TAG) ==="

# Auth
gcloud auth configure-docker asia-east1-docker.pkg.dev --quiet

# Server
echo "--- Building & pushing server (amd64) ---"
docker buildx build --platform linux/amd64 -t "$SERVER_IMAGE" --push ./server

# Client
echo "--- Building & pushing client (amd64) ---"
docker buildx build --platform linux/amd64 -t "$CLIENT_IMAGE" --build-arg VITE_API_URL="$VITE_API_URL" --push -f ./client/Dockerfile .

echo "=== Done ==="
echo "Server: $SERVER_IMAGE"
echo "Client: $CLIENT_IMAGE"
