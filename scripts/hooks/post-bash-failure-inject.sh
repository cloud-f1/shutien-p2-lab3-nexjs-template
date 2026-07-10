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
# (Next.js stack — no pytest/alembic/uvicorn/ruff/mypy; that FastAPI/Vite tooling
# was removed with the migration to next-app/.)
BUILD_PATTERN="(pnpm|npm|npx|next build|next dev|vitest|playwright|tsc|eslint|drizzle-kit|node |make |cargo|go |docker)"
if ! echo "$CMD" | grep -qE "$BUILD_PATTERN"; then
  exit 0
fi

# ── Extract last 50 lines of output ──
TAIL_OUTPUT=$(echo "$STDOUT" | tail -50)

# ── Known-failure pattern matching ──
# Each pattern: regex to match against output → name + fix suggestion
MATCH=""

# Pattern 1: Auth.js v5 Credentials login bounce-back (DrizzleAdapter defaults to
# DB sessions, but Credentials can't create one — auth() returns null next request).
if echo "$TAIL_OUTPUT" | grep -qiE "(redirected? to (the )?/login|CredentialsSignin|toHaveURL.*login|session\(\).*(null|undefined)|auth\(\).*returned null)"; then
  MATCH="Known pattern: Auth.js v5 Credentials Login Bounce-Back
Fix: Credentials provider CANNOT create a database session. Configure JWT sessions:
     session: { strategy: \"jwt\" } in lib/auth.ts, with jwt()/session() callbacks
     copying token.id/token.role. See nextjs-saas-patterns skill §1.
Reference: .claude/skills/nextjs-saas-patterns/SKILL.md"
fi

# Pattern 2: RBAC guard trusts the JWT-snapshotted role instead of re-reading the DB
if [ -z "$MATCH" ] && echo "$TAIL_OUTPUT" | grep -qiE "(403|Forbidden|Unauthorized).*role|role.*(stale|mismatch)|session\.user\.role"; then
  MATCH="Known pattern: Stale Role From JWT (RBAC privilege gap)
Fix: Server-side guards must re-read the LIVE role from the DB (getLiveRole()) —
     never trust session.user.role directly, since the JWT snapshots role at
     sign-in and a demotion won't apply until re-login. See lib/permissions.ts.
Reference: .claude/skills/nextjs-saas-patterns/SKILL.md §2"
fi

# Pattern 3: Server Action mutation not reflected in the UI (missing revalidatePath)
if [ -z "$MATCH" ] && echo "$TAIL_OUTPUT" | grep -qiE "(stale.*data|list.*not.*(refresh|update)|expected.*updated.*but.*(old|stale)|cache.*not.*invalidat)"; then
  MATCH="Known pattern: Stale UI After Server Action Mutation
Fix: Server Actions mutate then must call \`revalidatePath(...)\` server-side AND
     the dialog/client caller must call \`router.refresh()\` on success — both are
     required, neither alone is sufficient.
Reference: .claude/skills/nextjs-saas-patterns/SKILL.md (CRUD modals + list tables)"
fi

# Pattern 4: Hydration mismatch (Date/locale rendered differently server vs client)
if [ -z "$MATCH" ] && echo "$TAIL_OUTPUT" | grep -qiE "(Hydration failed|did not match.*server-rendered|Text content does not match|hydration.*mismatch)"; then
  MATCH="Known pattern: Hydration Mismatch
Fix: Usually a Date/locale/timezone value formatted differently on server vs
     client (e.g. new Date().toLocaleString() in a Server Component). Format
     dates deterministically (fixed locale/timezone) or move formatting to a
     Client Component with useEffect.
Reference: general"
fi

# Pattern 5: drizzle-kit schema drift
if [ -z "$MATCH" ] && echo "$TAIL_OUTPUT" | grep -qiE "(relation .* does not exist|column .* does not exist|drizzle-kit.*(check|migrate)|schema drift)"; then
  MATCH="Known pattern: Drizzle Schema Drift
Fix: Run \`pnpm db:generate\` to create a migration from the current
     lib/schema.ts, then \`pnpm db:migrate\` to apply it. Verify the journal
     (drizzle/migrations/meta/_journal.json) picked up the new file.
Reference: .claude/skills/nextjs-saas-patterns/SKILL.md §5"
fi

# Pattern 6: NEXT_PUBLIC_* env var change not taking effect
if [ -z "$MATCH" ] && echo "$TAIL_OUTPUT" | grep -qiE "NEXT_PUBLIC_[A-Z_]+.*(undefined|not defined|is not set)"; then
  MATCH="Known pattern: NEXT_PUBLIC_* Env Var Not Picked Up
Fix: NEXT_PUBLIC_* vars are baked into the JS bundle at BUILD time, not read at
     request time. Changing them in the host dashboard has no effect until the
     next build/deploy — pass as --build-arg (see CLAUDE.md Deployment section).
Reference: CLAUDE.md — Runtime-vs-build-time env (E322)"
fi

# Pattern 7: sidebar-01 TooltipProvider crash
if [ -z "$MATCH" ] && echo "$TAIL_OUTPUT" | grep -qiE "Tooltip.*must be used within.*TooltipProvider"; then
  MATCH="Known pattern: Missing TooltipProvider (sidebar-01 block)
Fix: SidebarMenuButton's tooltip prop renders a <Tooltip>, but SidebarProvider
     does not include a TooltipProvider. Wrap the dashboard subtree (or root)
     in <TooltipProvider>.
Reference: .claude/skills/nextjs-saas-patterns/SKILL.md §4"
fi

# Pattern 8: proxy.ts (Edge middleware) importing Node-only code
if [ -z "$MATCH" ] && echo "$TAIL_OUTPUT" | grep -qiE "(edge runtime does not support|Node\.js standard library.*edge runtime|UntrustedHost)"; then
  MATCH="Known pattern: proxy.ts Edge Runtime Import Crash
Fix: proxy.ts (Next.js 16's renamed middleware.ts) runs on the Edge runtime and
     must only import auth.config.ts — never lib/auth.ts (Node-only: postgres,
     DrizzleAdapter). Keep proxy.ts to a coarse logged-in check; do role checks
     server-side. Also set trustHost: true in auth.config.ts.
Reference: .claude/skills/nextjs-saas-patterns/SKILL.md §3"
fi

# Pattern 9: fireEvent in tests (should use userEvent)
if [ -z "$MATCH" ] && echo "$TAIL_OUTPUT" | grep -qiE "(fireEvent.*not.*function|fireEvent.*undefined)"; then
  MATCH="Known pattern: fireEvent Usage (should be userEvent)
Fix: Replace \`fireEvent\` with \`userEvent\` from \`@testing-library/user-event\`. Project convention forbids fireEvent.
Reference: CLAUDE.md Testing Rules"
fi

# Pattern 10: db.$count() misused (postgres-js row-count footgun)
if [ -z "$MATCH" ] && echo "$TAIL_OUTPUT" | grep -qiE "(Cannot destructure.*count|Cannot read propert(y|ies).*'count'|rowCount.*undefined)"; then
  MATCH="Known pattern: db.\$count() Misuse (postgres-js)
Fix: \`db.\$count(table, where)\` returns a Promise<number> directly — use it as
     is. Wrapping it in \`.select({count}).from(table)\` returns one row per
     matched row and yields [] (destructure crash) for zero-row results. A
     mutation's affected-row count is \`.count\`, not \`.rowCount\`, with
     postgres-js.
Reference: .claude/skills/nextjs-saas-patterns/SKILL.md §4"
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
