#!/bin/bash
# Stop Hook Verifier — blocks completion if rule violations found in changed files.
# Exit 2 = block (Claude must fix), Exit 0 = pass.
# This is the "retry verifier" pattern: even at 70% accuracy, 4 retries → 99% success.
#
# Next.js stack (post-migration). Rules enforce the CLAUDE.md "NEVER DEVIATE" invariants
# against next-app/. Per-file rules (1-3, 25) iterate changed files; global rules
# (4-6, 18, 23, 24) run once. The old FastAPI/Vite rules (client/src localStorage, MSW,
# pytest, OpenAPI codegen, alembic review, App.tsx routeMap, styles/common) were removed
# with that stack.
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")" || exit 0

# Collect all files changed (staged + unstaged + untracked).
# CHANGED_OVERRIDE: test-injection hook (newline-separated paths) used by the
# fixtures in scripts/hooks/tests/ to drive the per-file rules deterministically.
CHANGED="${CHANGED_OVERRIDE:-$(
  git diff --name-only 2>/dev/null
  git diff --name-only --cached 2>/dev/null
  git ls-files --others --exclude-standard 2>/dev/null
)}"
CHANGED=$(echo "$CHANGED" | sort -u | grep -v '^\s*$')

# Note: do NOT early-exit on empty $CHANGED. Global rules (18, 23) check repo-level
# state (epic-progress.md, audit log) independent of the working tree. The per-file
# loop harmlessly iterates 0 times when $CHANGED is empty. Found via E157 QA — an
# early-exit silently disabled Rule 18 on clean feat branches.

VIOLATIONS=""
LARGE_WARNINGS=""

# E180: emit `rule_fired` event when a stop-verifier rule blocks/warns. Each call
# appends one JSON line to .claude/audit.jsonl. Lesson cross-reference is best-effort
# via scripts/hooks/rule-to-lesson.json; rules without a mapping record `rule_id` only.
RULE_FIRED_AUDIT_LOG="${AUDIT_LOG_PATH:-.claude/audit.jsonl}"
RULE_FIRED_LESSON_MAP="${RULE_TO_LESSON_PATH:-scripts/hooks/rule-to-lesson.json}"
RULE_FIRED_EPIC=$(git branch --show-current 2>/dev/null | grep -oiE '(^|[/_-])E[0-9]+' | head -1 | sed 's/^[/_-]//' | tr '[:lower:]' '[:upper:]')
[ -z "$RULE_FIRED_EPIC" ] && RULE_FIRED_EPIC="none"
RULE_FIRED_EPIC=$(echo "$RULE_FIRED_EPIC" | tr '[:lower:]' '[:upper:]')

emit_rule_fired() {
  # $1 = rule_id (string or int), $2 = severity (block|warn)
  local rule_id="$1"
  local severity="${2:-block}"
  local lesson=""
  command -v jq >/dev/null 2>&1 || return 0
  mkdir -p "$(dirname "$RULE_FIRED_AUDIT_LOG")" 2>/dev/null
  if [ -f "$RULE_FIRED_LESSON_MAP" ]; then
    lesson=$(jq -r --arg id "$rule_id" '.[$id] // ""' "$RULE_FIRED_LESSON_MAP" 2>/dev/null)
    [ "$lesson" = "null" ] && lesson=""
  fi
  local ts
  ts=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  jq -n -c \
    --arg ts "$ts" \
    --arg event "rule_fired" \
    --arg rule_id "$rule_id" \
    --arg severity "$severity" \
    --arg lesson "$lesson" \
    --arg epic "$RULE_FIRED_EPIC" \
    '{ts:$ts,event:$event,rule_id:($rule_id|tonumber? // $rule_id),severity:$severity,lesson:$lesson,epic:$epic}' \
    >> "$RULE_FIRED_AUDIT_LOG" 2>/dev/null || true

  # E181: chain a strength reinforcement bump for the cited lesson (if any).
  # Best-effort — failure here must NEVER block the verifier's core role.
  if [ -n "$lesson" ]; then
    local tier0_dir="${TEMPLATE_MEMORY_DIR:-$HOME/.claude/template-memory}"
    local lesson_path="$tier0_dir/$lesson"
    local score_sh
    score_sh="$(git rev-parse --show-toplevel 2>/dev/null)/scripts/memory/score.sh"
    if [ -x "$score_sh" ] && [ -f "$lesson_path" ]; then
      AUDIT_LOG_PATH="$RULE_FIRED_AUDIT_LOG" \
        "$score_sh" reinforce "$lesson_path" rule_fired >/dev/null 2>&1 || true
    fi
  fi
}

# Rule 25 helper (E351): is $1's FIRST non-blank line a genuine top-level
# `"use server"` directive (vs. a file that merely mentions the string in a
# comment, e.g. lib/usage.ts, lib/sales/queries.ts)? Strips a leading UTF-8
# BOM defensively; tolerates an optional trailing semicolon.
RULE_25_AWK="${USE_SERVER_GUARD_AWK:-scripts/hooks/lib/use-server-guard-scan.awk}"
RULE_26_AWK="${ROWS_AFFECTED_AWK:-scripts/hooks/lib/rows-affected-scan.awk}"
is_real_use_server_file() {
  local first
  first=$(grep -m1 -v '^[[:space:]]*$' "$1" 2>/dev/null \
    | sed -e 's/^\xEF\xBB\xBF//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
  case "$first" in
    '"use server"'|"'use server'"|'"use server";'|"'use server';") return 0 ;;
    *) return 1 ;;
  esac
}

# ── Per-file rules (1-3, 25) ─────────────────────────────────────────────
while IFS= read -r FILE; do
  [ -f "$FILE" ] || continue

  # Skip documentation and config files
  case "$FILE" in
    *.md|*.json|*.yaml|*.yml|*.toml|*.cfg|*.ini) continue ;;
  esac

  # Rule 1: No inline `style=` colour overrides in app/components TSX.
  # CLAUDE.md: use Tailwind utilities + `dark:` variants, never inline colour styles.
  # Scope: next-app/{app,components} .tsx, excluding the generated components/ui/.
  if echo "$FILE" | grep -qE "^next-app/(app|components)/.*\.tsx$" \
     && ! echo "$FILE" | grep -q "^next-app/components/ui/"; then
    MATCH=$(grep -nE "style=\{\{[^}]*(color|background|fill|stroke|border[A-Za-z]*[Cc]olor)" "$FILE" 2>/dev/null \
      | grep -v '^\s*//' | grep -v '^\s*\*')
    if [ -n "$MATCH" ]; then
      VIOLATIONS="${VIOLATIONS}\n❌ Rule 1: inline style= colour override in $FILE:\n$MATCH\n   Fix: use Tailwind classes + dark: variants (and cn() for conditionals); tokens live in app/globals.css. No inline colour styles.\n"
      emit_rule_fired 1 block
    fi
  fi

  # Rule 2: Every mutating Server Action must be guarded (RBAC + defense-in-depth).
  # Server Actions are public POST endpoints; UI hiding is not a control. A file under
  # next-app/actions/ that writes the DB (insert/update/delete) MUST call a guard.
  # Recognised guards are a FAMILY, not one hardcoded name — today's lib/permissions.ts
  # exports requireAuth/requireEditor/requireAdmin; requireRole/requireFlag and a generic
  # guard() helper are recognised too so a future RBAC-convention rename doesn't silently
  # false-positive this rule (see scripts/hooks/CLAUDE.md, "convention-rename" lesson —
  # E319). E323 adds defineAction( — the Server-Action factory (lib/define-action.ts)
  # runs the guard (auth + live role + allow) as step 1 of its pipeline, so a file whose
  # mutations are ALL built through defineAction() is guarded even with no requireX() call.
  #
  # Exemption: files containing the marker comment
  #   // stop-verifier:public-action
  # are explicitly exempt from Rule 2. Use ONLY for genuine pre-auth endpoints
  # (login, password reset, invite-accept before a session exists) where an RBAC
  # guard would break the endpoint's purpose — not as a general escape hatch.
  # (Guardrail-widening discipline: every change to this rule ships with a regression
  # fixture in scripts/hooks/tests/ + explicit user sign-off — it gates the agent's own
  # completion.)
  if echo "$FILE" | grep -qE "^next-app/actions/.*\.ts$" \
     && ! echo "$FILE" | grep -qE "\.(test|spec)\.ts$"; then
    if grep -qE "db\.(insert|update|delete)\(" "$FILE" 2>/dev/null \
       && ! grep -qE "require(Auth|Editor|Admin|Role|Flag)\b|guard\(|defineAction\(" "$FILE" 2>/dev/null \
       && ! grep -qE "//\s*stop-verifier:public-action" "$FILE" 2>/dev/null; then
      VIOLATIONS="${VIOLATIONS}\n❌ Rule 2: mutating Server Action in $FILE has no RBAC guard.\n   Fix: call a guard as the first line — requireAuth()/requireEditor()/requireAdmin()/requireRole()/requireFlag() (lib/permissions.ts) or a guard() helper, or build the mutation with defineAction() (lib/define-action.ts, which guards in-pipeline). Server Actions are public POST endpoints.\n   (Exception: add '// stop-verifier:public-action' only for genuine pre-auth endpoints like login/password-reset.)\n"
      emit_rule_fired 2 block
    fi
  fi

  # Rule 3: No hand-rolled <table> in dashboard record-list pages (warn).
  # CLAUDE.md: list/table views use the reusable <DataTable> (components/data-table-generic.tsx).
  if echo "$FILE" | grep -qE "^next-app/app/.*\.tsx$" \
     && ! echo "$FILE" | grep -qE "\.(test|spec)\.tsx$"; then
    MATCH=$(grep -nE "<table[ >]" "$FILE" 2>/dev/null | grep -v '^\s*//' | grep -v '^\s*\*')
    if [ -n "$MATCH" ]; then
      LARGE_WARNINGS="${LARGE_WARNINGS}\n⚠️  Rule 3: raw <table> in $FILE:\n$MATCH\n   Consider the reusable <DataTable> (components/data-table-generic.tsx) for record lists — it ships filter + pagination + page-size.\n"
      emit_rule_fired 3 warn
    fi
  fi

  # Rule 25: every export in a `"use server"` file must hit a known guard (E351).
  # Root cause behind two real incidents (E346, E350): an internal-use function
  # living in a `"use server"` file, where every export is a public POST
  # endpoint and reachability is not decided by author intent. Unlike Rule 2
  # (file-scoped, only checked when the file also does db.insert/update/delete),
  # this is a PER-EXPORT check that fires on every export regardless of whether
  # it mutates — E350's `listSalesPages` was a plain SELECT, outside Rule 2's
  # scope entirely. See scripts/hooks/lib/use-server-guard-scan.awk for the
  # exact heuristic (grep-level, not a real parser — narrow by design).
  #
  # Exemption: the same file-level `// stop-verifier:public-action` marker
  # Rule 2 already recognizes (reused, not a second escape hatch).
  if echo "$FILE" | grep -qE "\.ts$" \
     && ! echo "$FILE" | grep -qE "\.(test|spec)\.ts$" \
     && is_real_use_server_file "$FILE" \
     && [ -f "$RULE_25_AWK" ]; then
    RULE_25_HITS=$(awk -f "$RULE_25_AWK" "$FILE" 2>/dev/null)
    if [ -n "$RULE_25_HITS" ]; then
      while IFS='|' read -r R25_LINE R25_NAME; do
        [ -z "$R25_NAME" ] && continue
        VIOLATIONS="${VIOLATIONS}\n❌ Rule 25: $FILE:$R25_LINE — export \`$R25_NAME\` in a \"use server\" file has no reachable guard.\n   Every export in a \"use server\" file is a public POST endpoint; a guard nested behind a conditional (e.g. an optional param) is not a guard. Fix with ONE of:\n     1. Call a guard as the first unconditional step — requireAuth()/requireEditor()/requireAdmin()/requireRole()/requireFlag() (lib/permissions.ts), or build it with defineAction() (lib/define-action.ts).\n     2. Mark it explicitly public — add '// stop-verifier:public-action' (genuine pre-auth endpoints only, e.g. login/password-reset).\n     3. Move it to lib/ as an internal (non-\"use server\") function, callable only from an already-authorized Server Component or Route Handler.\n"
        emit_rule_fired 25 block
      done <<< "$RULE_25_HITS"
    fi
  fi

  # Rule 26 (E368): a Server Action that performs an ownership-scoped
  # UPDATE/DELETE and writes an audit event MUST inspect the rows-affected
  # count. Server Actions are public POST endpoints: when the scoped WHERE
  # matches zero rows (someone else's id, or a nonexistent one) the write is a
  # no-op, but an unconditional logAudit() still fires — letting any
  # authenticated caller inject a forged entry naming a resource they cannot
  # touch, into the compliance surface E356/E359 hardened.
  #
  # actions/items.ts was already correct; eight other functions were not. The
  # fix had been applied per-case rather than to the pattern — this rule is what
  # makes the pattern hold.
  if echo "$FILE" | grep -qE "^next-app/actions/.*\.ts$" && [ -f "$RULE_26_AWK" ]; then
    RULE_26_HITS=$(awk -f "$RULE_26_AWK" "$FILE" 2>/dev/null)
    if [ -n "$RULE_26_HITS" ]; then
      while IFS='|' read -r R26_LINE R26_NAME; do
        [ -z "$R26_NAME" ] && continue
        VIOLATIONS="${VIOLATIONS}\n❌ Rule 26: $FILE:$R26_LINE — \`$R26_NAME\` writes an audit event after a scoped UPDATE/DELETE without checking rows-affected.\n   A scoped WHERE that matches zero rows is a no-op, but the audit write still fires — a forged entry attributed to the caller, naming a resource they cannot touch. Fix with ONE of:\n     1. Capture the result and bail before auditing: 'const result = await db.update(...); if (result.count === 0) return { error: ... }' (see actions/items.ts).\n     2. Use .returning() and test the returned row for null.\n     3. Prove existence first with a SELECT + missing-row guard, then write by the proven id (see actions/team.ts acceptInvitation).\n     4. If genuinely a no-op-tolerant bulk write, mark it '// stop-verifier:rows-affected-ok'.\n"
        emit_rule_fired 26 block
      done <<< "$RULE_26_HITS"
    fi
  fi

done <<< "$CHANGED"

# ── Global rules ────────────────────────────────────────────────────────────

# Rule 4: No console.log residue in next-app RUNTIME code (excludes tests + CLI tooling).
# Scope is the shipped app surface (app/components/hooks/actions + runtime lib). CLI
# generators/validators (lib/registry, lib/openapi) legitimately print to stdout — they
# run via package.json scripts (module:validate, openapi:generate), not in the browser
# or a request path — so they're excluded.
CONSOLE_LOG_HITS=$(grep -rn "console\.log" \
  next-app/app next-app/components next-app/lib next-app/actions next-app/hooks 2>/dev/null \
  --include="*.ts" --include="*.tsx" \
  --exclude="*.test.*" --exclude="*.spec.*" \
  | grep -vE '^next-app/lib/(registry|openapi)/' \
  | grep -v '^\s*//' | grep -v '^\s*\*')
if [ -n "$CONSOLE_LOG_HITS" ]; then
  VIOLATIONS="${VIOLATIONS}\n❌ Rule 4: console.log found in next-app production code:\n$CONSOLE_LOG_HITS\n   Fix: remove console.log before shipping (use a real logger if you need server logs).\n"
  emit_rule_fired 4 block
fi

# Rule 5: No hand-authored files added under next-app/components/ui/ (warn).
# CLAUDE.md: shadcn/ui components are generated — add via `npx shadcn@latest add`.
# Sees both staged additions AND untracked new files — a file sitting untracked
# (added but never `git add`-ed) previously slipped past this rule entirely.
RULE_5_NEW_UI=$(git diff --cached --name-only --diff-filter=A 2>/dev/null \
  | grep -E '^next-app/components/ui/.*\.tsx$' || true)
RULE_5_UNTRACKED_UI=$(git ls-files --others --exclude-standard next-app/components/ui/ 2>/dev/null \
  | grep -E '\.tsx$' || true)
RULE_5_ALL=$(printf '%s\n%s\n' "$RULE_5_NEW_UI" "$RULE_5_UNTRACKED_UI" | sort -u | grep -v '^\s*$')
if [ -n "$RULE_5_ALL" ]; then
  LARGE_WARNINGS="${LARGE_WARNINGS}\n⚠️  Rule 5: new file(s) under next-app/components/ui/:\n$(echo "$RULE_5_ALL" | sed 's/^/  - /')\n   These should be generated via \`npx shadcn@latest add <name>\`, not hand-authored. App-specific components belong in components/ (not components/ui/).\n"
  emit_rule_fired 5 warn
fi

# Rule 6: Large File Warning — modified files > 500 lines (non-blocking).
MODIFIED_FILES=$(git diff --name-only --diff-filter=AM 2>/dev/null; git diff --name-only --cached --diff-filter=AM 2>/dev/null)
MODIFIED_FILES=$(echo "$MODIFIED_FILES" | sort -u | grep -v '^\s*$')
if [ -n "$MODIFIED_FILES" ]; then
  while IFS= read -r MFILE; do
    [ -f "$MFILE" ] || continue
    case "$MFILE" in
      *.lock|*.json|*.md|*.yaml|*.yml) continue ;;
    esac
    LINES=$(wc -l < "$MFILE" 2>/dev/null | tr -d ' ')
    if [ "$LINES" -gt 500 ] 2>/dev/null; then
      LARGE_WARNINGS="${LARGE_WARNINGS}\n⚠️  Warning: $MFILE is $LINES lines. Consider splitting."
      emit_rule_fired 6 warn
    fi
  done <<< "$MODIFIED_FILES"
fi

# is_epic_branch (E204) — single source of truth for epic-branch detection used by
# Rule 18. Matches any prefix path + feat/ + E|e + digits + dash, e.g. feat/e1-x,
# feat/E191-x, MH/feat/E191-x, claude/feat/E12-x. On match, sets EPIC_BRANCH_NUM.
# Canary: scripts/hooks/tests/test-stop-verifier-canary.sh (run via `make guard-selftest`).
is_epic_branch() {
  if echo "$1" | grep -qE "(^|/)feat/[Ee][0-9]+-"; then
    EPIC_BRANCH_NUM=$(echo "$1" | sed -nE 's|.*feat/[Ee]([0-9]+)-.*|\1|p')
    return 0
  fi
  EPIC_BRANCH_NUM=""
  return 1
}

# Rule 18: QA Gate Enforcement — epic branches cannot Stop with impl=✅ but qa=⬜.
# Mechanizes the Mandatory Pipeline Order contract from .claude/commands/athena/batch.md:
# forbids implement→commit without qa. Fires on any epic branch (see is_epic_branch).
# Test injection via BRANCH_OVERRIDE + EPIC_PROGRESS_PATH env (tests/test-rule-18-qa-gate.sh).
RULE_18_BRANCH="${BRANCH_OVERRIDE:-$(git branch --show-current 2>/dev/null || echo "")}"
if is_epic_branch "$RULE_18_BRANCH"; then
  RULE_18_EPIC_NUM="$EPIC_BRANCH_NUM"
  if [ -n "$RULE_18_EPIC_NUM" ]; then
    RULE_18_EPIC_ID="E${RULE_18_EPIC_NUM}"
    RULE_18_PROGRESS="${EPIC_PROGRESS_PATH:-docs/context/epic-progress.md}"
    if [ -f "$RULE_18_PROGRESS" ]; then
      # Step matrix row: | E{n} | Spec | Impl | QA | Commit | Merge | Notes |
      RULE_18_ROW=$(grep -E "^\| *${RULE_18_EPIC_ID} " "$RULE_18_PROGRESS" | head -1)
      if [ -n "$RULE_18_ROW" ]; then
        RULE_18_IMPL=$(echo "$RULE_18_ROW" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $4); print $4}')
        RULE_18_QA=$(echo "$RULE_18_ROW" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $5); print $5}')
        if [ "$RULE_18_IMPL" = "✅" ] && [ "$RULE_18_QA" != "✅" ]; then
          VIOLATIONS="${VIOLATIONS}\n❌ Rule 18: Epic ${RULE_18_EPIC_ID} has impl=✅ but qa=${RULE_18_QA}.\n   Fix: Run /athena:qa for ${RULE_18_EPIC_ID} before committing/shipping.\n   (Mechanizes Mandatory Pipeline Order contract from .claude/commands/athena/batch.md)\n"
          emit_rule_fired 18 block
        fi
      fi
    fi
  fi
fi

# Rule 23: Verification Discipline (E188) — completion-verb commits require a
# `verification_check` audit event with exit=0 emitted within the last 10 min.
# Pilot mode: gated behind STOP_RULE_23_ENABLED=1.
# Whitelisted prefixes (no verification required): wip:, chore(state):, docs:,
# chore:, chore(memory):, chore(roadmap):, build:, ci:
# Blocked prefixes: feat:, fix:, refactor:, perf:, test:, style:
# Test injection: RULE_23_COMMIT_MSG, RULE_23_WINDOW_MIN, AUDIT_LOG_PATH.
if [ "${STOP_RULE_23_ENABLED:-0}" = "1" ]; then
  RULE_23_MSG="${RULE_23_COMMIT_MSG:-$(git log -1 --pretty=%s 2>/dev/null || echo "")}"
  RULE_23_BLOCKED=0
  case "$RULE_23_MSG" in
    feat:*|feat\(*|fix:*|fix\(*|refactor:*|refactor\(*|perf:*|perf\(*|test:*|test\(*|style:*|style\(*)
      RULE_23_BLOCKED=1
      ;;
  esac
  case "$RULE_23_MSG" in
    wip:*|"chore(state):"*|docs:*|chore:*|"chore(memory):"*|"chore(roadmap):"*|build:*|ci:*)
      RULE_23_BLOCKED=0
      ;;
  esac
  if [ "$RULE_23_BLOCKED" = "1" ]; then
    RULE_23_AUDIT_LOG="${AUDIT_LOG_PATH:-.claude/audit.jsonl}"
    RULE_23_WINDOW="${RULE_23_WINDOW_MIN:-10}"
    RULE_23_GREEN=""
    if [ -f "$RULE_23_AUDIT_LOG" ] && command -v jq >/dev/null 2>&1; then
      # Portable N-minutes-ago cutoff: BSD date (macOS, -v flag) first, then
      # GNU date (-d flag), then python3 as a last resort. Previously this used
      # ONLY python3 — when it was unavailable, RULE_23_CUTOFF silently stayed
      # empty and the fallback branch accepted ANY historical verification_check
      # ever logged, making the 10-min window meaningless (accept-all). Now the
      # window degradation itself is surfaced as a warning instead of silently
      # widening to "any time".
      RULE_23_CUTOFF=$(date -u -v-"${RULE_23_WINDOW}"M +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "")
      if [ -z "$RULE_23_CUTOFF" ]; then
        RULE_23_CUTOFF=$(date -u -d "-${RULE_23_WINDOW} min" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || echo "")
      fi
      if [ -z "$RULE_23_CUTOFF" ]; then
        RULE_23_CUTOFF=$(python3 -c \
          "import datetime; print((datetime.datetime.utcnow() - datetime.timedelta(minutes=${RULE_23_WINDOW})).strftime('%Y-%m-%dT%H:%M:%SZ'))" \
          2>/dev/null || echo "")
      fi
      if [ -n "$RULE_23_CUTOFF" ]; then
        RULE_23_GREEN=$(jq -r \
          --arg cutoff "$RULE_23_CUTOFF" \
          'select(.event=="verification_check" and .exit==0 and .ts >= $cutoff) | .ts' \
          "$RULE_23_AUDIT_LOG" 2>/dev/null | tail -1)
      else
        echo "⚠️  Rule 23: could not compute the ${RULE_23_WINDOW}-min lookback window (no BSD/GNU date, no python3) — window check degraded to unbounded lookback." >&2
        RULE_23_GREEN=$(jq -r \
          'select(.event=="verification_check" and .exit==0) | .ts' \
          "$RULE_23_AUDIT_LOG" 2>/dev/null | tail -1)
      fi
    fi
    if [ -z "$RULE_23_GREEN" ]; then
      VIOLATIONS="${VIOLATIONS}\n❌ Rule 23: commit \"${RULE_23_MSG}\" uses a completion verb but no verification_check event (exit=0) found in the last ${RULE_23_WINDOW} min.\n   Fix: run /athena:qa (or the relevant test suite) then emit the event:\n   scripts/hooks/audit-emit-verification.sh <check-name> 0\n   Skill reference: .claude/skills/verification-discipline/SKILL.md\n"
      emit_rule_fired 23 block
    fi
  fi
fi

# Rule 24: Phase-Completion Gate-Ledger Guard (E345) — a phase may not be
# marked ✅ Complete in epic-progress.md's Phase Status table while it carries
# an unreconciled `skipped` gate result (see scripts/gate-ledger.sh's own
# header for the exact "unreconciled" definition). Skipping a gate is a
# legitimate engineering decision; leaving it unreconciled at phase-close is
# what this rule blocks. The ONLY reconciliation path is a HUMAN explicitly
# running (a later pass elsewhere does NOT clear a recorded skip — see
# gate-ledger.sh's header for why):
#   scripts/gate-ledger.sh --phase N --accept-skips "reason"
#
# Real-path rationale (not hypothetical): every historical phase-complete
# transition in this repo is a hand-edit to epic-progress.md's Phase Status
# row landing in a "chore(state): Phase N complete" commit (see
# `git log --oneline --all | grep "chore(state)"`) — there is no dedicated
# "mark-phase-complete" script to hook. This rule checks the row's absolute
# current content (like Rule 18 does for the QA gate), not a diff, so it
# still catches the transition whether Stop fires before OR after that
# commit lands (the commit has often already happened by the time Stop
# fires, so a HEAD-diff-only check would silently miss the common case).
#
# Cost control: only pays the gate-ledger.sh subprocess cost when
# epic-progress.md was actually touched THIS session — currently dirty, OR
# part of the most recent commit. Otherwise this rule is a no-op fast-path,
# so it does not re-scan every historical ✅-Complete phase on every unrelated
# Stop.
#
# Test injection: EPIC_PROGRESS_PATH (shared with Rule 18), GATE_LEDGER_SH.
RULE_24_PROGRESS="${EPIC_PROGRESS_PATH:-docs/context/epic-progress.md}"
RULE_24_LEDGER_SH="${GATE_LEDGER_SH:-scripts/gate-ledger.sh}"
if [ -f "$RULE_24_PROGRESS" ] && [ -f "$RULE_24_LEDGER_SH" ]; then
  RULE_24_DIRTY=$(git status --porcelain -- "$RULE_24_PROGRESS" 2>/dev/null)
  RULE_24_IN_LAST_COMMIT=$(git diff --name-only HEAD~1 HEAD -- "$RULE_24_PROGRESS" 2>/dev/null)
  if [ -n "$RULE_24_DIRTY" ] || [ -n "$RULE_24_IN_LAST_COMMIT" ]; then
    if [ -n "$RULE_24_DIRTY" ]; then
      RULE_24_BEFORE=$(git show "HEAD:$RULE_24_PROGRESS" 2>/dev/null)
    else
      RULE_24_BEFORE=$(git show "HEAD~1:$RULE_24_PROGRESS" 2>/dev/null)
    fi
    RULE_24_AFTER=$(cat "$RULE_24_PROGRESS" 2>/dev/null)

    # Phases that read "✅ Complete" now but did NOT before this session's
    # change — i.e. a genuine transition, not an old already-complete phase.
    RULE_24_NEW_PHASES=$(echo "$RULE_24_AFTER" | grep -E '^\| Phase [0-9]+ ' | while IFS= read -r ROW; do
      NUM=$(echo "$ROW" | sed -nE 's/^\| Phase ([0-9]+) .*/\1/p')
      [ -z "$NUM" ] && continue
      STATUS_NOW=$(echo "$ROW" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $4); print $4}')
      echo "$STATUS_NOW" | grep -qF '✅ Complete' || continue
      STATUS_BEFORE_ROW=$(echo "$RULE_24_BEFORE" | grep -E "^\| Phase ${NUM} " | head -1)
      STATUS_BEFORE=$(echo "$STATUS_BEFORE_ROW" | awk -F'|' '{gsub(/^[[:space:]]+|[[:space:]]+$/, "", $4); print $4}')
      echo "$STATUS_BEFORE" | grep -qF '✅ Complete' && continue
      echo "$NUM"
    done)

    if [ -n "$RULE_24_NEW_PHASES" ]; then
      while IFS= read -r RULE_24_PHASE; do
        [ -z "$RULE_24_PHASE" ] && continue
        if ! bash "$RULE_24_LEDGER_SH" --phase "$RULE_24_PHASE" --check-only >/dev/null 2>&1; then
          RULE_24_DETAIL=$(bash "$RULE_24_LEDGER_SH" --phase "$RULE_24_PHASE" 2>/dev/null)
          VIOLATIONS="${VIOLATIONS}\n❌ Rule 24: Phase ${RULE_24_PHASE} is being marked ✅ Complete but has an unreconciled skipped gate:\n${RULE_24_DETAIL}\n   Fix: either get the skipped gate(s) to pass, or have a HUMAN explicitly run:\n   scripts/gate-ledger.sh --phase ${RULE_24_PHASE} --accept-skips \"<reason>\"\n   (--accept-skips is a human act — never invoke it from cron/loop/batch-auto or on your own initiative.)\n"
          emit_rule_fired 24 block
        fi
      done <<< "$RULE_24_NEW_PHASES"
    fi
  fi
fi

if [ -n "$LARGE_WARNINGS" ]; then
  echo "=== Stop Verifier — WARNINGS ===" >&2
  echo -e "$LARGE_WARNINGS" >&2
  echo "" >&2
fi

if [ -n "$VIOLATIONS" ]; then
  echo "=== Stop Verifier — VIOLATIONS FOUND ===" >&2
  echo -e "$VIOLATIONS" >&2
  echo "Fix all violations before completing." >&2
  # Write the block flag consumed by subagent-stop-writeback.sh so the
  # agent_complete event can report status="failure" (E146 contract — the
  # flag had no writer before, making `failure` unreachable).
  touch "${STOP_VERIFIER_BLOCK_FLAG:-.claude/.stop-verifier-blocked}" 2>/dev/null || true
  exit 2
fi

exit 0
