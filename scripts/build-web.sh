#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Installing dependencies..."
pnpm install --frozen-lockfile

echo "==> Building all packages..."
pnpm -r build

echo "==> Merging dev-docs into client dist..."
mkdir -p client/dist/docs
cp -r dev-docs/dist/* client/dist/docs/

echo "==> Done! Output: client/dist/"
echo "    /       → client app"
echo "    /docs/  → dev-docs"
