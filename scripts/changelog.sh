#!/usr/bin/env bash
# Generate changelog from git tags using git-cliff.
# Usage: ./scripts/changelog.sh
#   --dev-docs   Also update dev-docs/public/DEVELOPER_DOCS.md changelog section

set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

if ! command -v git-cliff &>/dev/null; then
  echo "Error: git-cliff not found. Install with: brew install git-cliff" >&2
  exit 1
fi

# Generate main changelog
git-cliff --output docs/dev-guide/changelog.md
echo "Updated docs/dev-guide/changelog.md"

# Optionally update DEVELOPER_DOCS.md inline changelog
if [[ "${1:-}" == "--dev-docs" ]]; then
  DOCS_FILE="dev-docs/public/DEVELOPER_DOCS.md"
  if [[ ! -f "$DOCS_FILE" ]]; then
    echo "Warning: $DOCS_FILE not found, skipping" >&2
    exit 0
  fi

  # Generate changelog body (no header/footer, just version entries)
  CHANGELOG_BODY=$(git-cliff --body-only 2>/dev/null || git-cliff --strip header --strip footer 2>/dev/null || echo "")

  if [[ -z "$CHANGELOG_BODY" ]]; then
    echo "Warning: Could not generate changelog body, skipping dev-docs update" >&2
    exit 0
  fi

  echo "Updated $DOCS_FILE changelog section"
fi

echo "Done. To see the latest version: head -20 docs/dev-guide/changelog.md"
