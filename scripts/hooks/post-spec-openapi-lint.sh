#!/bin/bash
# Validates openapi.yaml after @spec-writer edits it.
# Scoped to spec-writer agent via frontmatter hooks.
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")" || exit 0

INPUT=$(cat)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)

# Only lint if the edited file is openapi.yaml
[[ "$FILE" == *openapi.yaml ]] || exit 0

if command -v npx >/dev/null 2>&1; then
  npx @redocly/cli lint docs/openapi.yaml --format=stylish 2>&1 || echo "Warning: redocly lint failed"
else
  echo "Warning: npx not found, skipping openapi lint"
fi
exit 0
