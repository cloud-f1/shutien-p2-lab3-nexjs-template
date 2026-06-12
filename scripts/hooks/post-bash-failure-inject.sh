#!/bin/bash
# E88 — PostToolUse(Bash) failure detection hook
# Detects non-zero exit codes on test/build commands and injects @debugger context
# with known-failure-pattern matching from docs/context/debug-log.md
#
# Input:  JSON on stdin (tool_input.command, tool_result.exit_code, tool_result.stdout)
# Output: stdout → additionalContext (non-blocking)
# Exit:   always 0 (informational only, never blocks)

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")" || exit 0

INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
EXIT_CODE=$(echo "$INPUT" | jq -r '.tool_result.exit_code // 0' 2>/dev/null)
STDOUT=$(echo "$INPUT" | jq -r '.tool_result.stdout // empty' 2>/dev/null)

# Only act on non-zero exit codes
[ "$EXIT_CODE" = "0" ] && exit 0
[ -z "$EXIT_CODE" ] && exit 0

# ── Scope filter: only trigger for test/build commands ──
# Skip benign commands: git, ls, cat, echo, cd, pwd, mkdir, cp, mv, rm, head, tail, grep, find, jq, date, which, type
BENIGN_PATTERN="^(git |ls |cat |echo |cd |pwd |mkdir |cp |mv |rm |head |tail |grep |find |jq |date |which |type |wc |sort |uniq |diff |sed |awk |tr |cut |touch |chmod |chown |ln |readlink |basename |dirname |realpath |test |\\[)"
if echo "$CMD" | grep -qE "$BENIGN_PATTERN"; then
  exit 0
fi

# Only trigger for commands that look like test/build/lint/migration operations
BUILD_PATTERN="(pytest|vitest|pnpm|npm|npx|uv |pip |make |alembic|uvicorn|python |node |tsc|eslint|ruff|mypy|cargo|go |docker)"
if ! echo "$CMD" | grep -qE "$BUILD_PATTERN"; then
  exit 0
fi

# ── Extract last 50 lines of output ──
TAIL_OUTPUT=$(echo "$STDOUT" | tail -50)

# ── Known-failure pattern matching ──
# Each pattern: regex to match against output → name + fix suggestion
MATCH=""

# Pattern 1: Wrong JWT library (python-jose)
if echo "$TAIL_OUTPUT" | grep -qiE "(from jose import|jose\.exceptions|JOSEError)"; then
  MATCH="Known pattern: Wrong JWT Library Import
Fix: Replace \`from jose import jwt\` with \`import jwt\` (PyJWT).
     Replace \`from jose.exceptions import ...\` with \`from jwt.exceptions import ...\`
Reference: debug-log.md Pattern 1"
fi

# Pattern 2: asyncio event loop error
if [ -z "$MATCH" ] && echo "$TAIL_OUTPUT" | grep -qiE "(RuntimeError.*event loop|no running event loop|can.t run nested)"; then
  MATCH="Known pattern: asyncio Event Loop Error
Fix: Remove asyncio.run(), use \`await\` directly. Ensure asyncio_mode = 'auto' in pyproject.toml.
Reference: debug-log.md Pattern 2"
fi

# Pattern 3: Stale UI after mutation (React Query)
if [ -z "$MATCH" ] && echo "$TAIL_OUTPUT" | grep -qiE "(stale.*data|cache.*not.*invalidat|query.*not.*refetch)"; then
  MATCH="Known pattern: Stale UI After Mutation
Fix: Add \`queryClient.invalidateQueries({ queryKey: queryKeys.[resource] })\` to mutation's onSettled.
Reference: debug-log.md Pattern 3"
fi

# Pattern 4: MSW handler missing
if [ -z "$MATCH" ] && echo "$TAIL_OUTPUT" | grep -qiE "(\[MSW\].*Warning.*no.*handler|captured a request without a matching)"; then
  MATCH="Known pattern: MSW Handler Missing
Fix: Add handler to \`src/tests/handlers/\` for the missing endpoint.
Reference: debug-log.md Pattern 4"
fi

# Pattern 5: Alembic drift
if [ -z "$MATCH" ] && echo "$TAIL_OUTPUT" | grep -qiE "(Target database is not up to date|alembic.*not.*up.*to.*date|Can.t locate revision)"; then
  MATCH="Known pattern: Alembic Drift
Fix: Run \`alembic upgrade head\` to apply pending migrations, or generate missing with \`alembic revision --autogenerate\`.
Reference: debug-log.md Pattern 5"
fi

# Pattern 6: tokenCache always null
if [ -z "$MATCH" ] && echo "$TAIL_OUTPUT" | grep -qiE "(tokenCache.*null|token.*undefined|401.*loop|refresh.*loop)"; then
  MATCH="Known pattern: tokenCache Always Returns null
Fix: Ensure auth mutation's onSuccess calls \`tokenCache.set(accessToken)\`. Check login + refresh both set it.
Reference: debug-log.md Pattern 6"
fi

# Pattern 7: bcrypt import error
if [ -z "$MATCH" ] && echo "$TAIL_OUTPUT" | grep -qiE "(bcrypt.*AttributeError|bcrypt.*ImportError|CryptContext.*error|passlib.*error)"; then
  MATCH="Known pattern: bcrypt Import Error
Fix: Replace CryptContext usage with direct bcrypt: \`bcrypt.hashpw()\` / \`bcrypt.checkpw()\`.
Reference: debug-log.md Pattern 7"
fi

# Pattern 8: Pydantic v2 validator syntax
if [ -z "$MATCH" ] && echo "$TAIL_OUTPUT" | grep -qiE "(PydanticUserError|@validator.*deprecated|orm_mode.*removed|ConfigDict)"; then
  MATCH="Known pattern: Pydantic v2 Validator Syntax
Fix: Replace @validator → @field_validator, @root_validator → @model_validator, orm_mode=True → ConfigDict(from_attributes=True).
Reference: debug-log.md Pattern 8"
fi

# Pattern 9: fireEvent in tests (should use userEvent)
if [ -z "$MATCH" ] && echo "$TAIL_OUTPUT" | grep -qiE "(fireEvent.*not.*function|fireEvent.*undefined)"; then
  MATCH="Known pattern: fireEvent Usage (should be userEvent)
Fix: Replace \`fireEvent\` with \`userEvent\` from \`@testing-library/user-event\`. Project convention forbids fireEvent.
Reference: CLAUDE.md Testing Rules"
fi

# Pattern 10: localStorage in client (banned)
if [ -z "$MATCH" ] && echo "$TAIL_OUTPUT" | grep -qiE "(localStorage.*not.*defined|localStorage.*SecurityError)"; then
  MATCH="Known pattern: localStorage Usage (banned)
Fix: Use \`tokenCache.ts\` (in-memory) instead of localStorage. Project convention forbids localStorage.
Reference: CLAUDE.md Architecture Rules"
fi

# Pattern 11: Import/module not found
if [ -z "$MATCH" ] && echo "$TAIL_OUTPUT" | grep -qiE "(ModuleNotFoundError|Cannot find module|Module not found)"; then
  MATCH="Known pattern: Missing Module/Import
Fix: Check if the dependency is installed (\`uv add\` for Python, \`pnpm add\` for JS). Verify import path is correct.
Reference: general"
fi

# Pattern 12: Port already in use
if [ -z "$MATCH" ] && echo "$TAIL_OUTPUT" | grep -qiE "(EADDRINUSE|address already in use|port.*already.*in.*use)"; then
  MATCH="Known pattern: Port Already In Use
Fix: Kill the existing process on that port (\`lsof -ti:PORT | xargs kill\`) or use a different port.
Reference: general"
fi

# ── Emit context injection ──
echo "--- @debugger auto-context (E88) ---"
echo "Command failed with exit code $EXIT_CODE."
echo ""
echo "Failed command: $CMD"
echo ""

if [ -n "$MATCH" ]; then
  echo "$MATCH"
  echo ""
fi

echo "Last 50 lines of output:"
echo '```'
echo "$TAIL_OUTPUT"
echo '```'
echo ""
echo "Consult docs/context/debug-log.md for full pattern reference."
echo "--- end @debugger context ---"

exit 0
