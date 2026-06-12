#!/usr/bin/env bash
# E21 — Thin wrapper to launch the Interactive Site Builder CLI
# Usage: ./scripts/new-site.sh [--dry-run]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"
exec npx tsx scripts/new-site/index.ts "$@"
