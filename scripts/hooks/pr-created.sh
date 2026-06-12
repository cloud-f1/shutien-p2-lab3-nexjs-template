#!/bin/bash
# PR Created Hook — auto-label, assign reviewers, add epic context comment
# Fires as PostToolUse(Bash) when `gh pr create` is detected in the command.
# Non-blocking: always exits 0.

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")" || exit 0

# ── Read hook input ──────────────────────────────────────────────────────
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# Only fire on `gh pr create` commands
echo "$CMD" | grep -q 'gh pr create' || exit 0

# Check if gh CLI is available
command -v gh >/dev/null 2>&1 || exit 0

# Extract PR URL from tool result stdout (gh pr create prints URL)
TOOL_STDOUT=$(echo "$INPUT" | jq -r '.tool_result.stdout // empty' 2>/dev/null)
PR_URL=$(echo "$TOOL_STDOUT" | grep -oE 'https://github.com/[^ ]+/pull/[0-9]+' | head -1)
if [ -z "$PR_URL" ]; then
  # Try extracting PR number from the output
  PR_NUM=$(echo "$TOOL_STDOUT" | grep -oE 'pull/[0-9]+' | head -1 | grep -oE '[0-9]+')
  if [ -z "$PR_NUM" ]; then
    echo "(pr-created) Could not extract PR URL or number from output"
    exit 0
  fi
else
  PR_NUM=$(echo "$PR_URL" | grep -oE '[0-9]+$')
fi

# ── Extract epic info from branch name ───────────────────────────────────
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
EPIC_ID=$(echo "$BRANCH" | sed -n 's/.*\(E[0-9]\{1,\}\).*/\1/p')
EPIC_NUM=$(echo "$EPIC_ID" | sed 's/E//')

# Detect agent source from branch pattern
if echo "$BRANCH" | grep -q 'batch'; then
  AGENT_LABEL="agent:batch"
elif echo "$BRANCH" | grep -q 'loop'; then
  AGENT_LABEL="agent:loop"
else
  AGENT_LABEL=""
fi

# ── Extract phase and size from epic-progress.md ─────────────────────────
PHASE=""
SIZE=""
EPIC_NAME=""

if [ -n "$EPIC_ID" ] && [ -f "docs/context/epic-progress.md" ]; then
  # Phase: find which phase contains this epic
  PHASE=$(grep -E "Phase [0-9]+" docs/context/epic-progress.md \
    | grep "$EPIC_ID" \
    | head -1 \
    | sed -n 's/.*Phase \([0-9]\{1,\}\).*/\1/p')
fi

if [ -n "$EPIC_ID" ] && [ -f "docs/epics/EPIC_INDEX.md" ]; then
  # Size: from the EPIC_INDEX table (column 4: Size)
  SIZE=$(grep "$EPIC_ID" docs/epics/EPIC_INDEX.md \
    | grep '|' \
    | head -1 \
    | awk -F'|' '{print $4}' \
    | tr -d ' ')

  # Epic name: from the EPIC_INDEX table (column 3: Name)
  EPIC_NAME=$(grep "$EPIC_ID" docs/epics/EPIC_INDEX.md \
    | grep '|' \
    | head -1 \
    | awk -F'|' '{print $3}' \
    | sed 's/^ *//;s/ *$//')
fi

# ── S2: Auto-Label ──────────────────────────────────────────────────────
LABELS=""

if [ -n "$PHASE" ]; then
  LABELS="${LABELS}phase:${PHASE},"
fi

if [ -n "$EPIC_ID" ]; then
  LABELS="${LABELS}epic:${EPIC_ID},"
fi

if [ -n "$SIZE" ]; then
  LABELS="${LABELS}size:${SIZE},"
fi

if [ -n "$AGENT_LABEL" ]; then
  LABELS="${LABELS}${AGENT_LABEL},"
fi

# Remove trailing comma
LABELS=$(echo "$LABELS" | sed 's/,$//')

if [ -n "$LABELS" ]; then
  # Ensure labels exist (create if missing, ignore errors)
  IFS=',' read -ra LABEL_ARRAY <<< "$LABELS"
  for LABEL in "${LABEL_ARRAY[@]}"; do
    # Pick color based on prefix
    case "$LABEL" in
      phase:*) COLOR="0E8A16" ;;
      epic:*)  COLOR="1D76DB" ;;
      size:*)  COLOR="D93F0B" ;;
      agent:*) COLOR="5319E7" ;;
      *)       COLOR="EDEDED" ;;
    esac
    gh label create "$LABEL" --color "$COLOR" --force 2>/dev/null || true
  done

  # Apply labels to PR
  gh pr edit "$PR_NUM" --add-label "$LABELS" 2>/dev/null || true
fi

# ── S3: Auto-Assign Reviewer ────────────────────────────────────────────
BACKEND_REVIEWER="${PR_REVIEWER_BACKEND:-}"
FRONTEND_REVIEWER="${PR_REVIEWER_FRONTEND:-}"

if [ -n "$BACKEND_REVIEWER" ] || [ -n "$FRONTEND_REVIEWER" ]; then
  # Determine changed file areas from the PR diff
  CHANGED_FILES=$(git diff --name-only origin/main...HEAD 2>/dev/null || echo "")

  HAS_SERVER=$(echo "$CHANGED_FILES" | grep -c '^server/' || true)
  HAS_CLIENT=$(echo "$CHANGED_FILES" | grep -c '^client/' || true)
  HAS_DOCS_ONLY=false

  # Check if changes are docs-only
  NON_DOC_FILES=$(echo "$CHANGED_FILES" | grep -cv '^docs/' || true)
  if [ "$NON_DOC_FILES" -eq 0 ] 2>/dev/null; then
    HAS_DOCS_ONLY=true
  fi

  REVIEWERS=""
  if [ "$HAS_DOCS_ONLY" = false ]; then
    if [ "$HAS_SERVER" -gt 0 ] && [ -n "$BACKEND_REVIEWER" ]; then
      REVIEWERS="${REVIEWERS}${BACKEND_REVIEWER},"
    fi
    if [ "$HAS_CLIENT" -gt 0 ] && [ -n "$FRONTEND_REVIEWER" ]; then
      REVIEWERS="${REVIEWERS}${FRONTEND_REVIEWER},"
    fi
  fi

  REVIEWERS=$(echo "$REVIEWERS" | sed 's/,$//')
  if [ -n "$REVIEWERS" ]; then
    gh pr edit "$PR_NUM" --add-reviewer "$REVIEWERS" 2>/dev/null || true
  fi
fi

# ── S5: Epic Context Comment ────────────────────────────────────────────
if [ -n "$EPIC_ID" ]; then
  SPEC_FILE=""
  if [ -n "$EPIC_NUM" ]; then
    SPEC_FILE=$(ls docs/epics/e${EPIC_NUM}-*.md 2>/dev/null | head -1)
  fi

  COMMENT_BODY="### Epic Context

| Field | Value |
|-------|-------|
| **Epic** | ${EPIC_ID} — ${EPIC_NAME:-unknown} |"

  if [ -n "$PHASE" ]; then
    COMMENT_BODY="${COMMENT_BODY}
| **Phase** | ${PHASE} |"
  fi

  if [ -n "$SIZE" ]; then
    COMMENT_BODY="${COMMENT_BODY}
| **Size** | ${SIZE} |"
  fi

  if [ -n "$SPEC_FILE" ]; then
    COMMENT_BODY="${COMMENT_BODY}
| **Spec** | \`${SPEC_FILE}\` |"
  fi

  # Add dependency info if available
  DEPS=""
  if [ -f "docs/context/epic-progress.md" ]; then
    DEPS=$(grep "^${EPIC_ID}:" docs/context/epic-progress.md \
      | head -1 \
      | sed 's/^[^:]*: *//')
  fi

  if [ -n "$DEPS" ] && [ "$DEPS" != "no deps" ]; then
    COMMENT_BODY="${COMMENT_BODY}
| **Dependencies** | ${DEPS} |"
  fi

  gh pr comment "$PR_NUM" --body "$COMMENT_BODY" 2>/dev/null || true
fi

echo "(pr-created) PR #${PR_NUM} — labels: ${LABELS:-none}, reviewers: ${REVIEWERS:-none}"
exit 0
