#!/bin/bash
# Stop Hook Verifier — blocks completion if rule violations found in changed files.
# Exit 2 = block (Claude must fix), Exit 0 = pass.
# This is the "retry verifier" pattern: even at 70% accuracy, 4 retries → 99% success.
#
# Next.js stack (post-migration). Rules enforce the CLAUDE.md "NEVER DEVIATE" invariants
# against next-app/. Per-file rules (1-3) iterate changed files; global rules (4-6, 18, 23)
# run once. The old FastAPI/Vite rules (client/src localStorage, MSW, pytest, OpenAPI
# codegen, alembic review, App.tsx routeMap, styles/common) were removed with that stack.
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
RULE_FIRED_EPIC=$(git branch --show-current 2>/dev/null | sed -n 's/.*\(E[0-9]\{1,\}\).*/\1/Ip')
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

# ── Per-file rules (1-3) ───────────────────────────────────────────────────
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
RULE_5_NEW_UI=$(git diff --cached --name-only --diff-filter=A 2>/dev/null \
  | grep -E '^next-app/components/ui/.*\.tsx$' || true)
if [ -n "$RULE_5_NEW_UI" ]; then
  LARGE_WARNINGS="${LARGE_WARNINGS}\n⚠️  Rule 5: new file(s) under next-app/components/ui/:\n$(echo "$RULE_5_NEW_UI" | sed 's/^/  - /')\n   These should be generated via \`npx shadcn@latest add <name>\`, not hand-authored. App-specific components belong in components/ (not components/ui/).\n"
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
      RULE_23_CUTOFF=$(python3 -c \
        "import datetime; print((datetime.datetime.utcnow() - datetime.timedelta(minutes=${RULE_23_WINDOW})).strftime('%Y-%m-%dT%H:%M:%SZ'))" \
        2>/dev/null || echo "")
      if [ -n "$RULE_23_CUTOFF" ]; then
        RULE_23_GREEN=$(jq -r \
          --arg cutoff "$RULE_23_CUTOFF" \
          'select(.event=="verification_check" and .exit==0 and .ts >= $cutoff) | .ts' \
          "$RULE_23_AUDIT_LOG" 2>/dev/null | tail -1)
      else
        RULE_23_GREEN=$(jq -r \
          'select(.event=="verification_check" and .exit==0) | .ts' \
          "$RULE_23_AUDIT_LOG" 2>/dev/null | tail -1)
      fi
    fi
    if [ -z "$RULE_23_GREEN" ]; then
      VIOLATIONS="${VIOLATIONS}\n❌ Rule 23: commit \"${RULE_23_MSG}\" uses a completion verb but no verification_check event (exit=0) found in the last ${RULE_23_WINDOW} min.\n   Fix: run /athena:qa (or the relevant test suite) then emit the event:\n   scripts/hooks/audit-emit-verification.sh <check-name> 0\n   Skill reference: .claude/skills/verification-discipline.md\n"
      emit_rule_fired 23 block
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
  exit 2
fi

exit 0
