#!/bin/bash
# Stop Hook Verifier — blocks completion if rule violations found in changed files.
# Exit 2 = block (Claude must fix), Exit 0 = pass.
# This is the "retry verifier" pattern: even at 70% accuracy, 4 retries → 99% success.
# 23 rules total. Rules 1-5, 9-12, 14-16 iterate per changed file;
# rules 6-8, 13, 17-23 run once globally.
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ".")" || exit 0

# Collect all files changed (staged + unstaged + untracked)
CHANGED=$(
  git diff --name-only 2>/dev/null
  git diff --name-only --cached 2>/dev/null
  git ls-files --others --exclude-standard 2>/dev/null
)
CHANGED=$(echo "$CHANGED" | sort -u | grep -v '^\s*$')

# Note: do NOT early-exit on empty $CHANGED. Global rules (6, 7, 13, 17,
# 18, 19, 20) check repo-level state (epic-progress.md, audit log, etc.)
# that doesn't depend on working-tree files. The per-file loop below
# harmlessly iterates 0 times when $CHANGED is empty (see [ -f "$FILE" ]
# guard inside). Found via E157 QA — early-exit silently disabled
# Rules 18/19/20 on clean feat branches.

VIOLATIONS=""
LARGE_WARNINGS=""

# E180: emit `rule_fired` event when a stop-verifier rule blocks/warns. Each
# call appends one JSON line to .claude/audit.jsonl. Lesson cross-reference is
# best-effort via scripts/hooks/rule-to-lesson.json; rules without a mapping
# record `rule_id` only.
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
  # Best-effort — failure here must NEVER block the verifier from running its
  # core role (rule enforcement). Skip when the rule has no curated lesson.
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

while IFS= read -r FILE; do
  [ -f "$FILE" ] || continue

  # Skip documentation and config files
  case "$FILE" in
    *.md|*.json|*.yaml|*.yml|*.toml|*.cfg|*.ini) continue ;;
  esac

  # Rule 1: No localStorage in client/ code
  # Scope: shipped client SOURCE only. client/e2e/ Playwright helpers legitimately
  # seed browser UI state (e.g. the Zustand theme-persist key) before first paint —
  # that is test infrastructure, not the shipped auth-token path this rule guards
  # ("Use tokenCache.ts in-memory"). Exempt e2e the same way Rule 3 exempts cacheConfig.ts.
  if echo "$FILE" | grep -q "^client/" && ! echo "$FILE" | grep -q "^client/e2e/"; then
    MATCH=$(grep -n "localStorage" "$FILE" 2>/dev/null | grep -v '^\s*//' | grep -v '^\s*\*' | grep -v '^\s*#')
    if [ -n "$MATCH" ]; then
      VIOLATIONS="${VIOLATIONS}\n❌ localStorage detected in $FILE:\n$MATCH\n   Fix: Use tokenCache.ts (in-memory) instead of localStorage.\n"
      emit_rule_fired 1 block
    fi
  fi

  # Rule 2: No fireEvent in client test files
  if echo "$FILE" | grep -qE "^client/.*\.(test|spec)\.(ts|tsx)$"; then
    MATCH=$(grep -n "fireEvent" "$FILE" 2>/dev/null | grep -v '^\s*//' | grep -v '^\s*\*')
    if [ -n "$MATCH" ]; then
      VIOLATIONS="${VIOLATIONS}\n❌ fireEvent detected in $FILE:\n$MATCH\n   Fix: Use userEvent.setup() from @testing-library/user-event instead.\n"
      emit_rule_fired 2 block
    fi
  fi

  # Rule 3: No hardcoded staleTime in client/ (except cacheConfig.ts)
  if echo "$FILE" | grep -q "^client/" && ! echo "$FILE" | grep -q "cacheConfig"; then
    MATCH=$(grep -nE "staleTime:\s*[0-9]" "$FILE" 2>/dev/null | grep -v '^\s*//' | grep -v '^\s*\*')
    if [ -n "$MATCH" ]; then
      VIOLATIONS="${VIOLATIONS}\n❌ Hardcoded staleTime in $FILE:\n$MATCH\n   Fix: Import CACHE_TIERS from cacheConfig.ts instead.\n"
      emit_rule_fired 3 block
    fi
  fi

  # Rule 4: MSW handlers outside src/tests/handlers/
  if echo "$FILE" | grep -qE "^client/.*\.(test|spec)\.(ts|tsx)$"; then
    if ! echo "$FILE" | grep -q "src/tests/handlers/"; then
      MATCH=$(grep -nE "http\.(get|post|put|patch|delete)\(" "$FILE" 2>/dev/null | grep -v '^\s*//')
      if [ -n "$MATCH" ]; then
        VIOLATIONS="${VIOLATIONS}\n⚠️  Inline MSW handlers in $FILE:\n$MATCH\n   Fix: Move handlers to src/tests/handlers/ and import them.\n"
        emit_rule_fired 4 block
      fi
    fi
  fi

  # Rule 5: No files in backend/ or frontend/ directories
  if echo "$FILE" | grep -qE "(^|/)backend/|(^|/)frontend/"; then
    VIOLATIONS="${VIOLATIONS}\n❌ Wrong directory: $FILE\n   Fix: Use server/ and client/ — never backend/ or frontend/.\n"
    emit_rule_fired 5 block
  fi

  # Rule 9: No Internal Mock Assertions
  if echo "$FILE" | grep -qE "^server/.*test_.*\.py$"; then
    MATCH=$(grep -nE "(assert_called_once_with|assert_called_with|assert_any_call).*['\"](server/app/|app\.)" "$FILE" 2>/dev/null)
    if [ -n "$MATCH" ]; then
      LARGE_WARNINGS="${LARGE_WARNINGS}\n⚠️  Internal mock assertion in $FILE:\n$MATCH\n   Fix: Test behavior (inputs→outputs), not internal call wiring.\n"
      emit_rule_fired 9 warn
    fi
  fi

  # Rule 10: Parametrize Nudge
  if echo "$FILE" | grep -qE "^server/.*test_.*\.py$"; then
    TEST_COUNT=$(grep -cE "^\s*def test_" "$FILE" 2>/dev/null || echo 0)
    HAS_PARAMETRIZE=$(grep -c "parametrize" "$FILE" 2>/dev/null || echo 0)
    if [ "$TEST_COUNT" -ge 3 ] && [ "$HAS_PARAMETRIZE" -eq 0 ]; then
      LARGE_WARNINGS="${LARGE_WARNINGS}\n⚠️  $FILE has $TEST_COUNT test functions but no @pytest.mark.parametrize.\n   Consider: Combine similar tests with parametrize.\n"
      emit_rule_fired 10 warn
    fi
  fi
  if echo "$FILE" | grep -qE "^client/.*\.(test|spec)\.(ts|tsx)$"; then
    TEST_COUNT=$(grep -cE "^\s*(it|test)\(" "$FILE" 2>/dev/null || echo 0)
    HAS_EACH=$(grep -c "\.each" "$FILE" 2>/dev/null || echo 0)
    if [ "$TEST_COUNT" -ge 3 ] && [ "$HAS_EACH" -eq 0 ]; then
      LARGE_WARNINGS="${LARGE_WARNINGS}\n⚠️  $FILE has $TEST_COUNT test cases but no it.each/test.each.\n   Consider: Combine similar tests with it.each.\n"
      emit_rule_fired 10 warn
    fi
  fi

  # Rule 11: Mock Depth Limit
  if echo "$FILE" | grep -qE "^server/.*test_.*\.py$"; then
    PATCH_COUNT=$(grep -cE "(mock\.patch|@patch)" "$FILE" 2>/dev/null || echo 0)
    if [ "$PATCH_COUNT" -gt 5 ]; then
      LARGE_WARNINGS="${LARGE_WARNINGS}\n⚠️  $FILE has $PATCH_COUNT mock.patch/@patch usages (limit: 5).\n   Fix: Refactor to use DI fixtures instead of excessive patching.\n"
      emit_rule_fired 11 warn
    fi
  fi

  # Rule 12: Test File Size
  if echo "$FILE" | grep -qE "(^server/.*test_.*\.py$|^client/.*\.(test|spec)\.(ts|tsx)$)"; then
    TEST_LINES=$(wc -l < "$FILE" 2>/dev/null | tr -d ' ')
    if [ "$TEST_LINES" -gt 200 ] 2>/dev/null; then
      LARGE_WARNINGS="${LARGE_WARNINGS}\n⚠️  Test file $FILE is $TEST_LINES lines (limit: 200).\n   Fix: Split into focused test modules.\n"
      emit_rule_fired 12 warn
    fi
  fi

  # Rule 14: CSS Co-location Check — warn if co-located .css exists but isn't imported
  if echo "$FILE" | grep -qE "^client/src/(components|pages)/.*\.tsx$"; then
    if ! echo "$FILE" | grep -qE "\.(test|spec)\.tsx$"; then
      CSS_BASENAME=$(echo "$FILE" | sed 's/\.tsx$/.css/')
      if [ -f "$CSS_BASENAME" ]; then
        CSS_FILENAME=$(basename "$CSS_BASENAME")
        IMPORT_HIT=$(grep -n "import.*['\"].*${CSS_FILENAME}['\"]" "$FILE" 2>/dev/null || true)
        if [ -z "$IMPORT_HIT" ]; then
          LARGE_WARNINGS="${LARGE_WARNINGS}\n⚠️  $FILE has co-located CSS ($CSS_FILENAME) but doesn't import it.\n   Fix: Add \`import './${CSS_FILENAME}'\` or remove the unused CSS file.\n"
          emit_rule_fired 14 warn
        fi
      fi
    fi
  fi

  # Rule 15: MSW Factory Check — warn on inline HttpResponse.json({ object literals
  if echo "$FILE" | grep -qE "^client/src/tests/handlers/"; then
    MATCH=$(grep -nE "HttpResponse\.json\(\{" "$FILE" 2>/dev/null | grep -v '^\s*//' | grep -v '^\s*\*')
    if [ -n "$MATCH" ]; then
      LARGE_WARNINGS="${LARGE_WARNINGS}\n⚠️  Inline HttpResponse.json({ in $FILE:\n$MATCH\n   Fix: Use createMockFromSchema or a factory function instead of inline object literals.\n"
      emit_rule_fired 15 warn
    fi
  fi

  # Rule 16: Schema Bridge Check — Zod response schemas should use satisfies z.ZodType<ApiType>
  if echo "$FILE" | grep -qE "^client/src/schemas/.*\.ts$"; then
    if ! echo "$FILE" | grep -qE "\.(test|spec)\.ts$"; then
      ZOBJECT_COUNT=$(grep -c "z\.object({" "$FILE" 2>/dev/null || echo 0)
      SATISFIES_COUNT=$(grep -c "satisfies z\.ZodType<" "$FILE" 2>/dev/null || echo 0)
      UNBRIDGED=$((ZOBJECT_COUNT - SATISFIES_COUNT))
      if [ "$UNBRIDGED" -gt 0 ]; then
        LARGE_WARNINGS="${LARGE_WARNINGS}\n⚠️  $FILE has $ZOBJECT_COUNT z.object() schemas but only $SATISFIES_COUNT satisfies bridges ($UNBRIDGED unbridged).\n   Consider: Add \`satisfies z.ZodType<ApiType>\` to response schemas for compile-time drift detection.\n"
        emit_rule_fired 16 warn
      fi
    fi
  fi

done <<< "$CHANGED"

# Rule 6: OpenAPI Drift Detection — canonical spec (docs/openapi.yaml) changed
# but client/src/api/types.ts has not been regenerated.
#
# The CANONICAL source is docs/openapi.yaml (31KB, the documented SSOT).
# docs/openapi/openapi.yaml is the unbundled entry-point; `pnpm openapi:bundle`
# assembles it into docs/openapi.yaml which is what generate:types consumes.
#
# VERIFIER IS READ-ONLY: this rule DETECTS drift; it does NOT run
# `pnpm generate:types` (which would mutate client/src/api/types.ts mid-Stop).
# Instead it compares the current types.ts mtime vs openapi.yaml mtime to flag
# when the spec is newer than the types file — a reliable, side-effect-free proxy.
if echo "$CHANGED" | grep -qE "^docs/openapi\.yaml$"; then
  if [ -f client/src/api/types.ts ]; then
    # Detect if types.ts predates openapi.yaml (spec was updated but types weren't)
    OPENAPI_MTIME=$(stat -f "%m" docs/openapi.yaml 2>/dev/null || stat -c "%Y" docs/openapi.yaml 2>/dev/null || echo "0")
    TYPES_MTIME=$(stat -f "%m" client/src/api/types.ts 2>/dev/null || stat -c "%Y" client/src/api/types.ts 2>/dev/null || echo "0")
    if [ "$OPENAPI_MTIME" -gt "$TYPES_MTIME" ] 2>/dev/null; then
      VIOLATIONS="${VIOLATIONS}\n❌ OpenAPI spec (docs/openapi.yaml) changed but client/src/api/types.ts has not been regenerated.\n   Fix: cd client && pnpm generate:types\n   Note: The canonical OpenAPI source is docs/openapi.yaml (31KB). docs/openapi/openapi.yaml is the unbundled entry-point.\n"
      emit_rule_fired 6 block
    fi
  fi
fi

# Rule 7: Console.log Residue Check — no console.log in production client code
CONSOLE_LOG_HITS=$(grep -rn "console\.log" client/src/ \
  --include="*.ts" --include="*.tsx" \
  --exclude="*.test.*" --exclude="*.spec.*" \
  2>/dev/null | grep -v "client/src/tests/" | grep -v '^\s*//' | grep -v '^\s*\*')
if [ -n "$CONSOLE_LOG_HITS" ]; then
  VIOLATIONS="${VIOLATIONS}\n❌ console.log found in production code:\n$CONSOLE_LOG_HITS\n   Fix: Remove console.log before shipping.\n"
  emit_rule_fired 7 block
fi

# Rule 8: Large File Warning — files > 500 lines (non-blocking)
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
      emit_rule_fired 8 warn
    fi
  done <<< "$MODIFIED_FILES"
fi
# Rule 13: Orphan Route Check — every ROUTE_MAP key must have a route in App.tsx
if echo "$CHANGED" | grep -q "routeMap\.ts"; then
  ROUTEMAP_FILE="client/src/config/routeMap.ts"
  APP_FILE="client/src/App.tsx"
  if [ -f "$ROUTEMAP_FILE" ] && [ -f "$APP_FILE" ]; then
    ROUTE_KEYS=$(grep -oE '^\s+[a-zA-Z_]+:' "$ROUTEMAP_FILE" 2>/dev/null | sed 's/[: ]//g' | grep -v '^$')
    ORPHANS=""
    while IFS= read -r KEY; do
      [ -z "$KEY" ] && continue
      ROUTE_PATH=$(grep -A5 "^[[:space:]]*${KEY}:" "$ROUTEMAP_FILE" 2>/dev/null | grep -oE 'path:\s*"[^"]*"' | head -1 | sed 's/path:[[:space:]]*"//;s/"//')
      if [ -n "$ROUTE_PATH" ]; then
        if ! grep -qE "(path=.*['\"]${ROUTE_PATH}['\"]|path=\{.*\.path\}|entry\.path)" "$APP_FILE" 2>/dev/null; then
          ORPHANS="${ORPHANS}  - ${KEY} (path: ${ROUTE_PATH})\n"
        fi
      fi
    done <<< "$ROUTE_KEYS"
    if [ -n "$ORPHANS" ]; then
      VIOLATIONS="${VIOLATIONS}\n❌ Orphan ROUTE_MAP entries with no corresponding route in App.tsx:\n${ORPHANS}   Fix: Add a <Route> for each entry or remove the orphan from ROUTE_MAP.\n"
      emit_rule_fired 13 block
    fi
  fi
fi

# Rule 17: CSS Variable Drift — warn on undefined CSS custom property references
if echo "$CHANGED" | grep -qE "^client/.*\.css$"; then
  CSS_VAR_SCRIPT="scripts/checks/css-var-check.sh"
  if [ -x "$CSS_VAR_SCRIPT" ]; then
    CSS_VAR_OUTPUT=$("$CSS_VAR_SCRIPT" 2>&1) || true
    if echo "$CSS_VAR_OUTPUT" | grep -q "undefined reference"; then
      LARGE_WARNINGS="${LARGE_WARNINGS}\n⚠️  CSS variable drift detected:\n$CSS_VAR_OUTPUT\n"
      emit_rule_fired 17 warn
    fi
  fi
fi

# is_epic_branch (E204) — single source of truth for epic-branch detection used by
# Rules 18/19/20. Matches any prefix path + feat/ + E|e + digits + dash, e.g.
# feat/e1-x, feat/E191-x, MH/feat/E191-x, claude/feat/E12-x. On match, sets
# EPIC_BRANCH_NUM to the epic number. Fixes the fail-open bug where the old
# per-rule regexes (^feat/e... / ^(MH/)?feat/e...) missed the real MH/feat/E{n}
# convention, silently disabling all three epic-safety gates.
# Canary: scripts/hooks/tests/test-stop-verifier-canary.sh (run via `make guard-selftest`).
is_epic_branch() {
  if echo "$1" | grep -qE "(^|/)feat/[Ee][0-9]+-"; then
    EPIC_BRANCH_NUM=$(echo "$1" | sed -nE 's|.*feat/[Ee]([0-9]+)-.*|\1|p')
    return 0
  fi
  EPIC_BRANCH_NUM=""
  return 1
}

# Rule 18: QA Gate Enforcement — epic branches cannot Stop with impl=✅ but qa=⬜
# Mechanizes the Mandatory Pipeline Order contract from
# .claude/commands/athena/batch.md: forbids implement→commit without qa.
# Fires on any epic branch (see is_epic_branch). Test injection via BRANCH_OVERRIDE +
# EPIC_PROGRESS_PATH env vars (see tests/test-rule-18-qa-gate.sh).
RULE_18_BRANCH="${BRANCH_OVERRIDE:-$(git branch --show-current 2>/dev/null || echo "")}"
if is_epic_branch "$RULE_18_BRANCH"; then
  RULE_18_EPIC_NUM="$EPIC_BRANCH_NUM"
  if [ -n "$RULE_18_EPIC_NUM" ]; then
    RULE_18_EPIC_ID="E${RULE_18_EPIC_NUM}"
    RULE_18_PROGRESS="${EPIC_PROGRESS_PATH:-docs/context/epic-progress.md}"
    if [ -f "$RULE_18_PROGRESS" ]; then
      # Step matrix row format: | E{n} | Spec | Impl | QA | Commit | Merge | Notes |
      # awk -F'|' field indexes: $2=E{n}, $3=Spec, $4=Impl, $5=QA, $6=Commit, $7=Merge
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

# Rule 19: Migration Review SQL (E157) — on feat/E{n}-* branches, if the
# PR added or modified any server/alembic/versions/*.py file, require a
# corresponding `<rev>-*-upgrade.sql` artifact in
# docs/context/migration-review/. Mechanizes the @qa Phase 2.6 gate at the
# Stop boundary so a migration can't reach merge without offline SQL emit.
RULE_19_BRANCH="${BRANCH_OVERRIDE:-$(git branch --show-current 2>/dev/null || echo "")}"
if is_epic_branch "$RULE_19_BRANCH"; then
  RULE_19_MIGRATIONS=$(git diff --name-only origin/main...HEAD -- 'server/alembic/versions/*.py' 2>/dev/null)
  if [ -n "$RULE_19_MIGRATIONS" ]; then
    RULE_19_MISSING=""
    while IFS= read -r RULE_19_FILE; do
      [ -z "$RULE_19_FILE" ] && continue
      RULE_19_REV=$(basename "$RULE_19_FILE" .py | cut -d_ -f1)
      [ -z "$RULE_19_REV" ] && continue
      if ! compgen -G "docs/context/migration-review/${RULE_19_REV}-*-upgrade.sql" > /dev/null 2>&1; then
        RULE_19_MISSING="${RULE_19_MISSING}  - ${RULE_19_REV} (from ${RULE_19_FILE})\n"
      fi
    done <<< "$RULE_19_MIGRATIONS"
    if [ -n "$RULE_19_MISSING" ]; then
      VIOLATIONS="${VIOLATIONS}\n❌ Rule 19: alembic migration(s) added/modified on branch ${RULE_19_BRANCH} but no review SQL in docs/context/migration-review/:\n${RULE_19_MISSING}   Fix: scripts/migration-review.sh <rev>\n   (Mechanizes the E157 @qa Phase 2.6 migration-safety gate at the Stop boundary.)\n"
      emit_rule_fired 19 block
    fi
  fi
fi

# Rule 20: OpenAPI Contract Evidence (E156) — on feat/E{n}-* branches, if
# the PR touched docs/openapi.yaml, require a green `qa_contract` audit
# event on the current branch before allowing Stop. Mechanizes the E156
# contract-conformance gate at the Stop boundary so @qa can't be skipped
# when the spec changes.
RULE_20_BRANCH="${BRANCH_OVERRIDE:-$(git branch --show-current 2>/dev/null || echo "")}"
if is_epic_branch "$RULE_20_BRANCH"; then
  # Did the PR (vs origin/main) touch openapi.yaml?
  RULE_20_OPENAPI_CHANGED=$(git diff --name-only origin/main...HEAD 2>/dev/null | grep -c '^docs/openapi\.yaml$' || echo 0)
  # Also count unstaged/staged edits in the working tree (common mid-epic).
  RULE_20_OPENAPI_DIRTY=$(echo "$CHANGED" | grep -c '^docs/openapi\.yaml$' || echo 0)
  if [ "$RULE_20_OPENAPI_CHANGED" -gt 0 ] || [ "$RULE_20_OPENAPI_DIRTY" -gt 0 ]; then
    RULE_20_AUDIT_LOG="${AUDIT_LOG_PATH:-.claude/audit.jsonl}"
    RULE_20_GREEN_RUN=""
    if [ -f "$RULE_20_AUDIT_LOG" ] && command -v jq >/dev/null 2>&1; then
      RULE_20_GREEN_RUN=$(jq -r 'select(.event=="qa_contract" and .result=="pass") | .ts' \
        "$RULE_20_AUDIT_LOG" 2>/dev/null | tail -1)
    fi
    if [ -z "$RULE_20_GREEN_RUN" ]; then
      VIOLATIONS="${VIOLATIONS}\n❌ Rule 20: docs/openapi.yaml changed on branch ${RULE_20_BRANCH} but no green qa_contract audit event found.\n   Fix: /athena:qa --contract-only (runs tests/contract/test_schemathesis_conformance.py).\n   (Mechanizes the E156 contract-conformance gate at the Stop boundary.)\n"
      emit_rule_fired 20 block
    fi
  fi
fi

# Rule 21: No new page-co-located CSS (E176) — pages must compose
# components/ui/ primitives + Preset/Theme axes; new files matching
# client/src/pages/**/*.css are forbidden. Modifying or removing existing
# page CSS is fine — only file ADDITIONS are blocked. Bypass via the
# DESIGN_SYSTEM_LEGACY_CSS_OK=1 env var (e.g. for explicit legacy promotion
# work in E170).
if [ "${DESIGN_SYSTEM_LEGACY_CSS_OK:-0}" != "1" ]; then
  RULE_21_NEW_CSS=$(git diff --cached --name-only --diff-filter=A 2>/dev/null \
    | grep -E '^client/src/pages/.*\.css$' || true)
  if [ -n "$RULE_21_NEW_CSS" ]; then
    VIOLATIONS="${VIOLATIONS}\n❌ Rule 21: new page-co-located CSS file(s) staged:\n$(echo "$RULE_21_NEW_CSS" | sed 's/^/  - /')\n   Fix: pages must compose primitives from client/src/components/ui/ —\n   visual styling rides on the Preset axis (components/ui/preset.ts) +\n   the Theme axis (client/src/styles/themes.css). No new page CSS.\n   See docs/design/design.md § 6 (Conventions & Bans).\n"
    emit_rule_fired 21 block
  fi
fi

# Rule 22: No new rules in styles/common/ (E176) — the legacy-trim shelf
# at client/src/styles/common/ is frozen. New CSS rules belong in
# components/ui/<Name>.tsx Preset slots. Trimming/removing rules is fine;
# only added selector openings are blocked. Heuristic: lines added that
# start a CSS rule (selector ending in `{`). Body lines (`+  color: red;`)
# do not trip. Bypass via DESIGN_SYSTEM_COMMON_RULES_OK=1.
if [ "${DESIGN_SYSTEM_COMMON_RULES_OK:-0}" != "1" ]; then
  # Scan staged additions in styles/common/*.css for new selector openings.
  # `git diff --cached -U0` keeps context tight so only true additions match.
  # Selector heuristic: lines starting with `+` (but not `+++`), optional
  # whitespace, then a selector token (`.foo`, `#bar`, `&`, tag, `*`,
  # `[attr]`, `:pseudo`, `@media` etc.), then anything up to a `{`
  # (selector body opens). Matches both single-line rules
  # (`+.foo { color: red; }`) and multi-line ones (`+.foo {`).
  # False-positive guards:
  #   - lines starting with `+++` (file headers) are excluded
  #   - lines that are pure CSS body declarations (`+  color: red;`) have
  #     no `{` so the inner regex misses them
  RULE_22_HITS=$(git diff --cached -U0 -- 'client/src/styles/common/*.css' 2>/dev/null \
    | grep -E '^\+[^+]' \
    | grep -E '^\+[[:space:]]*[\.\#\&\*\[\:@a-zA-Z_-][^{}]*\{' \
    || true)
  if [ -n "$RULE_22_HITS" ]; then
    VIOLATIONS="${VIOLATIONS}\n❌ Rule 22: new CSS rule(s) added to client/src/styles/common/:\n$(echo "$RULE_22_HITS" | sed 's/^/  /')\n   Fix: New CSS rules belong in components/ui/<Name>.tsx Preset slots\n   (client/src/components/ui/preset.ts). The styles/common/ shelf is\n   frozen — only trimming/removing rules is allowed. See E176 + E173/E178.\n"
    emit_rule_fired 22 block
  fi
fi

# Rule 23: Verification Discipline (E188) — completion-verb commits require a
# `verification_check` audit event with exit=0 emitted within the last 10 min.
# Pilot mode: gated behind STOP_RULE_23_ENABLED=1 for the first 5 days post-merge.
# Whitelisted prefixes (no verification required): wip:, chore(state):, docs:,
# chore:, chore(memory):, chore(roadmap):, build:, ci:
# Blocked prefixes: feat:, fix:, refactor:, perf:, test:, style:
# Test injection: RULE_23_COMMIT_MSG (override commit message), RULE_23_WINDOW_MIN
# (override 10-min window), AUDIT_LOG_PATH (shared with other rules).
if [ "${STOP_RULE_23_ENABLED:-0}" = "1" ]; then
  # Resolve the latest commit message (or use injection override for tests)
  RULE_23_MSG="${RULE_23_COMMIT_MSG:-$(git log -1 --pretty=%s 2>/dev/null || echo "")}"
  # Check if the message starts with a blocked completion verb
  RULE_23_BLOCKED=0
  case "$RULE_23_MSG" in
    feat:*|feat\(*|fix:*|fix\(*|refactor:*|refactor\(*|perf:*|perf\(*|test:*|test\(*|style:*|style\(*)
      RULE_23_BLOCKED=1
      ;;
  esac
  # Check whitelist — these prefixes bypass the rule entirely
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
      # Compute cutoff timestamp: now minus window minutes
      # Use Python for portable date arithmetic (macOS + Linux)
      RULE_23_CUTOFF=$(python3 -c \
        "import datetime; print((datetime.datetime.utcnow() - datetime.timedelta(minutes=${RULE_23_WINDOW})).strftime('%Y-%m-%dT%H:%M:%SZ'))" \
        2>/dev/null || echo "")
      if [ -n "$RULE_23_CUTOFF" ]; then
        RULE_23_GREEN=$(jq -r \
          --arg cutoff "$RULE_23_CUTOFF" \
          'select(.event=="verification_check" and .exit==0 and .ts >= $cutoff) | .ts' \
          "$RULE_23_AUDIT_LOG" 2>/dev/null | tail -1)
      else
        # Fallback if python3 unavailable: accept any verification_check with exit=0
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
