# scripts/hooks/ — Claude Code Lifecycle Hooks

Shell scripts executed automatically by Claude Code at specific lifecycle events.

## Hook Input/Output Contract

- **Input**: JSON on stdin via `cat` — contains `tool_input` and optionally `tool_result`
- **Output**: stdout text becomes `additionalContext` injected into the conversation
- **Exit 0**: Allow the action (hook is informational)
- **Exit 2**: **Block the action** (PreToolUse hooks only — prevents tool execution)
- **Timeout**: Hooks must complete quickly (~5s). Never run the test suite (`pnpm test` / vitest) in a hook.

## Parsing Pattern

```bash
INPUT=$(cat)
CMD=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
FILE=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null)
```

## Shared Helper (`lib/audit-common.sh`)

`scripts/hooks/lib/audit-common.sh` (E-batch1) is a sourced-not-executed
library of three functions, targeting macOS default bash 3.2:

- `repo_root()` — git toplevel, falls back to `$PWD`.
- `epic_from_branch [branch]` — case-**insensitive** `E{n}` extraction
  (`feat/e191-x`, `feat/E191-x`, `MH/feat/e12-x` all match), uppercase-
  normalized output (`"E191"`), `"none"` fallback.
- `emit_jsonl <log_path> <event> [key=value ...]` — `jq -n`-based JSONL
  append, mirrors `audit-emit-pipeline.sh`'s bash-3.2-safe empty-array guard.

`post-bash-log.sh`, `subagent-stop-writeback.sh`, `task-completed.sh`, and
`session-start.sh` source it **for epic extraction only** (their prior logic
used a case-sensitive `E[0-9]` sed pattern — a lowercase branch like
`feat/e320-x` silently fell back to `"none"`). Each caller sources it
best-effort (`. "$LIB" 2>/dev/null || true`) and keeps an inline fallback if
the source fails, so a missing/broken lib file degrades gracefully rather
than breaking the hook. `stop-verifier.sh` and `audit-emit-verification.sh`
already implemented their own case-insensitive matching independently and are
NOT migrated to source this file (out of scope — minimal diffs).

## Hook Registry (see .claude/settings.json)

| Event | Script | Purpose |
|---|---|---|
| SessionStart | `session-start.sh` | Inject branch, session-summary, active epic phase (~30 lines), recent git, **two-block Tier 0 inject** (E182): Block A always-on PRIMER + Block B cued category excerpts (delegates to `scripts/memory/inject.sh`). Also (E-batch1): writes the `.claude/.session-anchor` line-count snapshot and rotates `.claude/audit.jsonl` past 5MB — see "Session-Scoped Context Health + Log Rotation" below. |
| UserPromptSubmit | `user-prompt-submit.sh` | Detect write-back phrases |
| PreToolUse(Bash) | `pre-bash-guard.sh` | Block destructive commands, wrong folder names |
| PostToolUse(Write,Edit) | `post-edit-lint.sh` | Auto-format Python/TypeScript |
| PostToolUse(Edit,Write) | `auto-promote-check.sh` | E158 `[GENERALIZABLE]` auto-trigger — watches the three Tier-1 context logs, drafts a promotion proposal once 3+ new tags land since the last-promote watermark |
| Stop | `stop-verifier.sh` | **Block completion** if rule violations in changed files (8 Next.js rules, retry verifier) |
| Stop | `archive-context.sh --auto` | (`scripts/archive-context.sh`, not `scripts/hooks/`) Archive stale/oversized Tier 1 context docs |
| Stop | `check-drift.sh` (`\|\| true`, non-blocking) | (`scripts/state/check-drift.sh`) E196 drift detector — compares `EPIC_INDEX.md` vs `epic-progress.md`; emits one summary `state_drift` event per run (E-batch1 fix — see below) |
| Stop | `stop-notify.sh` | macOS notification (runs after verifier passes) |
| SubagentStop | `subagent-stop-writeback.sh` | Timestamp agent docs |
| PostToolUse(Bash) | `post-bash-dispatch.sh` | **Dispatcher** (see "Dispatcher" section below) — single stdin read + jq parse, then prefilters into the 4 sub-hooks below |
| ↳ dispatched by `post-bash-dispatch.sh` | `post-bash-log.sh` | JSONL audit log (`.claude/audit.jsonl`) — always dispatched |
| ↳ dispatched by `post-bash-dispatch.sh` | `post-bash-failure-inject.sh` | Failure detection + @debugger context injection (E88) — dispatched on non-zero exit |
| ↳ dispatched by `post-bash-dispatch.sh` | `post-commit-bugfix-log.sh` | Auto-log `fix:` commits to `docs/context/bugfix-log.md` (E148) — dispatched on `git commit` |
| ↳ dispatched by `post-bash-dispatch.sh` | `pr-created.sh` | Auto-label, assign reviewers, add epic context on `gh pr create` — dispatched on `gh pr create` |
| PostToolUse(`.*`) | `context-health-monitor.sh` | Emit yellow/red context-health warnings from `.claude/audit.jsonl` (E145), session-scoped via `.claude/.session-anchor` (E-batch1) |
| TaskCompleted | `task-completed.sh` | Webhook notification (`$AI_CODING_WEBHOOK_URL`) |
| _(none — not auto-wired)_ | `worktree-setup.sh` | **Not a registered hook.** There is no `WorktreeCreate` lifecycle event in `.claude/settings.json` (E-batch1 fix — the registry previously claimed one). Copies `.env`/`next-app/.env`/`next-app/.env.local` + `docs/context/` into a new worktree. Must be invoked explicitly by batch worktree setup: `bash scripts/hooks/worktree-setup.sh <worktree-path>`. |

## Dispatcher (`post-bash-dispatch.sh`)

Every `Bash` tool call used to spawn 4 separate PostToolUse hook processes,
each re-reading stdin and re-parsing the same JSON with its own `jq` call.
`post-bash-dispatch.sh` is the single `.claude/settings.json` PostToolUse(Bash)
entry now — it reads stdin ONCE into `$INPUT`, extracts `CMD` (`tool_input.command`)
and `EXIT_CODE` (`tool_result.exit_code`, sanitized to post-bash-log.sh's `-1`
missing-result sentinel) with ONE `jq` pass, then dispatches to each sub-hook
via a cheap string prefilter — no sub-hook is invoked unless its prefilter
matches:

| Sub-hook | Prefilter |
|---|---|
| `post-bash-log.sh` | always (logs every command) |
| `pr-created.sh` | `$CMD` contains `gh pr create` |
| `post-commit-bugfix-log.sh` | `$CMD` contains `git commit` |
| `post-bash-failure-inject.sh` | `$EXIT_CODE != 0` AND `$EXIT_CODE != -1` (the missing-result sentinel — an absent `tool_result` isn't a known failure, so don't guess) |

Each sub-hook runs **unchanged** — the dispatcher re-feeds it the original
`$INPUT` via `printf '%s' "$INPUT" | bash <hook>`, so every sub-hook stays
standalone-runnable and its own fixture tests (`test-post-bash-log.sh`, etc.)
keep passing without modification. Every dispatch is `|| true` and the
dispatcher always `exit 0` — a crashing sub-hook must never block the
PostToolUse pipeline. Sub-hook stdout is forwarded through as-is (it becomes
`additionalContext`). Regression fixture: `tests/test-post-bash-dispatch.sh`.

## Agent-Scoped Hooks (in agent frontmatter, not settings.json)

- `post-test-coverage-gate.sh` — @qa: warn if coverage < 80%
- `debug-backup-pre-edit.sh` — @debugger: backup before edit
- `post-debug-verify.sh` — @debugger: log verify result
- `pre-deploy-guard.sh` — @deployer: block deploy if git dirty or wrong branch. (E280: the old Gates 7/7b — schemathesis contract test + alembic offline-SQL re-emit — were removed; Drizzle migration safety is now `pnpm db:test-migrate` + `drizzle-kit check`.)

## Stop Verifier Rules (`stop-verifier.sh`)

8 rules total (Next.js stack, post-migration — E282). The old 23-rule FastAPI/Vite
set (`client/src` localStorage, MSW handlers, pytest mock depth, OpenAPI codegen drift,
alembic migration review, `App.tsx` routeMap, `styles/common` design-system) was removed
with that stack. The rules now enforce the CLAUDE.md "NEVER DEVIATE" invariants against
`next-app/`. Per-file rules (1-3) iterate changed files; global rules (4-6, 18, 23) run once.

| # | Rule | Scope | Blocking |
|---|------|-------|----------|
| 1 | No inline `style=` colour overrides in `next-app/{app,components}/**.tsx` (excludes the generated `next-app/components/ui/`). Detection: `style={{ ... color\|background\|fill\|stroke\|borderColor ... }}`. Fix: Tailwind classes + `dark:` variants + `cn()` for conditionals; tokens live in `app/globals.css`. | Per file | exit 2 |
| 2 | RBAC guard on mutating Server Actions — a non-test file under `next-app/actions/*.ts` that calls `db.insert/update/delete(` MUST also call a guard from the recognized family (`requireAuth`/`requireEditor`/`requireAdmin`/`requireRole`/`requireFlag`, or a `guard(...)` helper — see `lib/permissions.ts`), **or** be built entirely through `defineAction(` (`lib/define-action.ts`, E323 — the Server-Action factory that runs the guard as step 1 of its pipeline). Server Actions are public POST endpoints; UI hiding is not a control. Exempt if the file carries the `// stop-verifier:public-action` marker comment (genuine pre-auth endpoints only, e.g. login/password-reset). E319. | Per file | exit 2 |
| 3 | No raw `<table>` in `next-app/app/**.tsx` pages — use the reusable `<DataTable>` (`components/data-table-generic.tsx`), which ships filter + pagination + page-size. | Per file | warning only |
| 4 | No `console.log` in next-app RUNTIME code (`next-app/{app,components,hooks,actions,lib}`). Excludes tests AND the CLI tooling dirs `lib/registry` + `lib/openapi` (generators/validators that legitimately print to stdout via `package.json` scripts, not in the browser or a request path). Fix: remove `console.log` before shipping (use a real logger for server logs). | Global | exit 2 |
| 5 | No new hand-authored files added under `next-app/components/ui/` — shadcn components are generated via `npx shadcn@latest add <name>`; app-specific components belong in `components/` (not `components/ui/`). Sees both staged additions (`git diff --cached --diff-filter=A`) AND untracked new files (`git ls-files --others --exclude-standard`, E-batch1 fix — a file added but never `git add`-ed previously slipped past this rule entirely). | Global | warning only |
| 6 | Large file warning — modified files > 500 lines. | Global | warning only |
| 18 | QA Gate Enforcement — on an epic branch (`is_epic_branch`), refuse Stop when `epic-progress.md` shows `impl=✅` but `qa≠✅` (mechanizes the batch.md Mandatory Pipeline Order contract). UNCHANGED. | Global | exit 2 |
| 23 | Verification Discipline (E188) — block completion-verb commits (`feat:`, `fix:`, `refactor:`, `perf:`, `test:`, `style:`) when no `verification_check` event with `exit=0` exists in `.claude/audit.jsonl` within the last 10 min. Whitelisted prefixes bypass: `wip:`, `chore(state):`, `docs:`, `chore:`, `chore(memory):`, `chore(roadmap):`, `build:`, `ci:`. Pilot mode: gated behind `STOP_RULE_23_ENABLED=1` env var. Emit: `scripts/hooks/audit-emit-verification.sh <check> 0`. Skill: `.claude/skills/verification-discipline/SKILL.md`. Portable N-minutes-ago cutoff (E-batch1 fix): BSD `date -v` → GNU `date -d` → `python3` last resort → if all fail, emit a degraded-window warning and fall back to unbounded lookback (previously: silent python3-only, accept-any-history on failure). | Global | exit 2 |

> **E204 — epic-branch detection + fail-open canary.** Rule 18 (the only remaining
> epic-safety gate — old Rules 19/20 were removed with the FastAPI/Vite stack) uses the
> shared `is_epic_branch()` matcher in `stop-verifier.sh` (`(^|/)feat/[Ee][0-9]+-`) —
> matches `feat/e1-`, `feat/E191-`, `claude/feat/E12-`, etc. It replaced divergent per-rule
> regexes that silently **failed open** on the real `feat/E{n}` convention (capital `E` +
> `MH/` prefix), disabling the epic-safety gate. The fail-open class is guarded by
> `scripts/hooks/tests/test-stop-verifier-canary.sh` (run via `make guard-selftest`), which
> asserts the verifier still BLOCKS (exit 2) on every epic-branch spelling.
> _A gate that can't prove it still blocks is indistinguishable from a disabled one._
>
> **Test injection (E282):** the per-file rules (1/2/4) honour `CHANGED_OVERRIDE` (a
> newline-separated path list) so fixtures can drive them deterministically. New fixture
> `scripts/hooks/tests/test-rule-nextjs-invariants.sh` covers Rules 1/2/4; Rule 18 has
> `test-rule-18-qa-gate.sh` + the canary; Rule 23 has `test-rule-23.sh`. The obsolete
> `test-rule-21-22-design-system.sh` was deleted.

## Exit Validation Rules

- Always `exit 0` unless intentionally blocking (exit 2)
- Validate parsed input before acting — if `jq` returns empty, warn and exit 0 (don't silently skip)
- Guard file operations: check `[ -z "$FILE" ]` and `[ -f "$FILE" ]` before linting/formatting
- Surface tool failures: use `cmd 2>&1 || echo "Warning: ..."` instead of `cmd 2>/dev/null`
- Log parse failures: if input can't be parsed, log `(parse error)` instead of empty string
- Use `2>/dev/null` only on optional commands (notifications, non-critical lookups)
- Never run long processes (tests, builds) — delegate to agents instead

## Environment Variables (Hooks)

| Variable | Used By | Purpose |
|---|---|---|
| `AI_CODING_WEBHOOK_URL` | `task-completed.sh` | Webhook endpoint. Adapter is auto-detected from URL host. Unset = skip silently. |
| `NOTIFY_LEVEL` | `task-completed.sh` | `silent` \| `boundaries` (default) \| `verbose`. Controls which TaskCompleted events fire. |
| `TELEGRAM_CHAT_ID` | `task-completed.sh` | Required when `AI_CODING_WEBHOOK_URL` points at `api.telegram.org`. Otherwise ignored. |
| `NOTIFY_DRY_RUN` | `task-completed.sh` | Test-only. When set, prints the formatted payload to stdout instead of POSTing. |
| `CLAUDE_AGENT` | `post-bash-log.sh` | Agent name for audit attribution (default: `unknown`) |
| `PR_REVIEWER_BACKEND` | `pr-created.sh` | GitHub username for a reviewer. Both reviewer vars are optional; the old `server/`→backend, `client/`→frontend path split no longer applies (single Next.js app under `next-app/`). Unset = skip. |
| `PR_REVIEWER_FRONTEND` | `pr-created.sh` | GitHub username for a reviewer. See note above — path-based split is moot in a single-app repo. Unset = skip. |

## Webhook Payload (`task-completed.sh`)

Sends a POST request to `$AI_CODING_WEBHOOK_URL` on task completion. The
payload shape is selected from the URL host so raw Slack/Telegram/Discord
webhooks render correctly without an n8n/Zapier middleman.

| URL contains | Adapter | Payload shape |
|---|---|---|
| `hooks.slack.com` | Slack | `{text, blocks: [section, context]}` |
| `api.telegram.org` | Telegram | `{chat_id, text, parse_mode: "Markdown"}` (requires `TELEGRAM_CHAT_ID`) |
| `discord.com/api/webhooks` | Discord | `{content, embeds: [{description}]}` |
| anything else | Generic | flat JSON (n8n / Zapier / Antenna — back-compat) |

Generic payload (unchanged for back-compat):

```json
{
  "event": "task_completed",
  "epic_id": "E82",
  "step": "implement",
  "status": "completed",
  "duration_seconds": 42,
  "branch": "feat/E82-webhook-jsonl-audit",
  "timestamp": "2026-03-28T12:00:00Z"
}
```

### `NOTIFY_LEVEL` filter

Default is `boundaries` — only fires for "I need to look now" moments to
prevent notification fatigue. Per-step pings (every subagent dispatch) train
you to ignore the channel within a week.

| Level | Fires when |
|---|---|
| `silent` | Never. Hook exits 0 immediately. |
| `boundaries` (default) | `step` is one of `merge`, `deploy`, `start` **OR** `status` is one of `failed`, `blocked`, `needs_human`, `merged`. |
| `verbose` | Every TaskCompleted event. |

- **Timeout**: 5 seconds (`--max-time 5`), fire-and-forget
- **No retry**: if the webhook fails, it is silently ignored
- **Epic detection**: extracted from hook input or branch name (`feat/E{n}-*` / `claude/*-E{n}-*`)
- **Tests**: `scripts/hooks/tests/test-task-completed.sh` (12 cases, drives the hook with `NOTIFY_DRY_RUN=1`)

## JSONL Audit Log (`post-bash-log.sh`)

Every bash command is appended as a single JSON line to `.claude/audit.jsonl`:

```json
{"ts":"2026-03-28T12:00:00Z","event":"bash","cmd":"git status","exit":0,"agent":"qa","epic":"E82","duration_ms":120}
```

### Example `jq` Queries

```bash
# Show all failed commands
jq 'select(.exit != 0)' .claude/audit.jsonl

# Count commands per agent
jq -s 'group_by(.agent) | map({agent: .[0].agent, count: length})' .claude/audit.jsonl

# Filter by epic
jq 'select(.epic == "E82")' .claude/audit.jsonl

# Show slow commands (>5s)
jq 'select(.duration_ms > 5000)' .claude/audit.jsonl
```

### `agent_complete` Event (E146)

`subagent-stop-writeback.sh` emits one `agent_complete` JSON line on every
`SubagentStop` for which the agent name is known. The event is consumed by
`/athena:metrics` to compute per-agent reliability (runs, success %, avg
duration, total retries).

```json
{"ts":"2026-04-09T12:00:00Z","event":"agent_complete","agent":"debugger","epic":"E145","status":"success","duration_s":180,"retries":0}
```

| Field | Type | Meaning |
|-------|------|---------|
| `ts` | ISO 8601 | UTC timestamp of the SubagentStop event |
| `event` | string | Always `"agent_complete"` |
| `agent` | string | Agent name (e.g. `debugger`, `qa`, `spec-writer`). Empty-name agents are skipped. |
| `epic` | string | Epic ID parsed from branch name (`E{n}`), or `"none"` |
| `status` | enum | `success` (default), `failure` (stop-verifier blocked this run), or `partial` (one or more bash retries) |
| `duration_s` | int | Seconds from earliest bash entry for this agent since the last `agent_complete` to the current `ts`. `0` if no start anchor is found. |
| `retries` | int | Count of `bash` events with `exit != 0` in the same window |

#### Status derivation

The hook determines `status` in this precedence order:

1. **`failure`** — the file at `$STOP_VERIFIER_BLOCK_FLAG` (default
   `.claude/.stop-verifier-blocked`) exists and is newer than the window's
   start. The hook consumes (deletes) the flag on read so it never leaks into
   the next agent. `stop-verifier.sh` writes this flag itself on any blocking
   violation (`exit 2`) — regression-covered by
   `scripts/hooks/tests/test-block-flag.sh` (E-batch1), which drives a real
   Rule 1 violation and asserts the flag file is created, then asserts a
   clean run leaves none.
2. **`partial`** — otherwise, if `retries > 0` for the window.
3. **`success`** — otherwise.

#### Duration derivation

`agent_start` is implicit: the hook re-reads `.claude/audit.jsonl` and finds
the earliest `bash` event whose `.agent` matches the current agent and whose
`.ts` is newer than the most recent `agent_complete` row for that agent. That
timestamp becomes the start anchor; `duration_s` is the difference to the
current `ts` in seconds. If no such anchor is found (e.g. the agent ran no
bash commands), `duration_s` defaults to `0`.

#### Test injection

The hook honours these env vars for fixture-driven tests:

| Variable | Purpose |
|----------|---------|
| `AUDIT_LOG_PATH` | Override `.claude/audit.jsonl` path |
| `STOP_VERIFIER_BLOCK_FLAG` | Override `.claude/.stop-verifier-blocked` path |

### Example `jq` Queries (agent_complete)

```bash
# All agent runs
jq 'select(.event == "agent_complete")' .claude/audit.jsonl

# Per-agent success rate (raw JSON — /athena:metrics formats as a table)
jq -s '
  map(select(.event == "agent_complete"))
  | group_by(.agent)
  | map({
      agent: .[0].agent,
      runs: length,
      success_pct: ((map(select(.status == "success")) | length) * 100 / length)
    })
' .claude/audit.jsonl

# Filter by epic
jq 'select(.event == "agent_complete" and .epic == "E146")' .claude/audit.jsonl
```

### Memory Retrieval Events (E180)

Three event types log Tier 0 (`~/.claude/template-memory/`) memory retrieval
into the same `.claude/audit.jsonl` so every Phase 45 mechanism (E181 strength
scoring, E182 selective injection, E183 promotion follow-through, E184 forget,
E186 metrics) reads from one shared surface. The log is gitignored — it never
leaves the local machine.

```json
{"ts":"2026-05-05T10:23:00Z","event":"tier0_loaded","lesson":"NEW_PROJECT_PRIMER.md","agent":"session-start","epic":"E180"}
{"ts":"2026-05-05T10:25:11Z","event":"rule_fired","rule_id":21,"severity":"block","lesson":"anti-patterns.md","epic":"E180"}
{"ts":"2026-05-05T10:30:42Z","event":"agent_cited","agent":"reviewer","lesson":"workflow-patterns.md","epic":"E180"}
```

| Event | Emitted by | Trigger |
|-------|------------|---------|
| `tier0_loaded` | `session-start.sh` | One event per Tier 0 file actually `cat`-ed into context. Today: `NEW_PROJECT_PRIMER.md`. Post-E182 (selective injection): one event per selected file. |
| `rule_fired` | `stop-verifier.sh` | One event per rule trip. `severity` is `block` (`exit 2`) or `warn` (warning-only rule). `lesson` is filled from `scripts/hooks/rule-to-lesson.json` when the rule has a curated mapping; empty otherwise. |
| `agent_cited` | `subagent-stop-writeback.sh` | After timestamping the agent's write-back doc, scans the file for `template-memory/<slug>.md` references and emits one event per unique lesson basename. |

Schema fields:

| Field | Type | Notes |
|-------|------|-------|
| `ts` | ISO 8601 UTC | All three events |
| `event` | enum | `tier0_loaded` / `rule_fired` / `agent_cited` |
| `lesson` | string | File basename relative to `~/.claude/template-memory/` (or empty for unmapped rules) |
| `agent` | string | `tier0_loaded`/`agent_cited` only — the SubagentStop agent name or `session-start` |
| `epic` | string | `E{n}` from current branch, or `none` |
| `rule_id` | int\|string | `rule_fired` only — the verifier's rule index (Next.js set: 1-6, 18, 23) |
| `severity` | enum | `rule_fired` only — `block` or `warn` |
| `context` | string | Optional — `"brainstorm"` on brainstorm retrievals (E189); absent on SessionStart Block A/B injects (E180/E182) |

#### Rule → lesson curation

`scripts/hooks/rule-to-lesson.json` is a manually curated `{rule_id: lesson_basename}` map (see Out-of-Scope in `docs/epics/e180-memory-retrieval-logging.md`). Rules without an entry record `rule_id` only — downstream consumers can fall back to text grep. Update this file when a new rule lands or its underlying lesson is renamed/promoted.

#### Test injection

The hooks honour these env vars for fixture-driven tests:

| Variable | Used By | Purpose |
|----------|---------|---------|
| `AUDIT_LOG_PATH` | all three hooks | Override `.claude/audit.jsonl` path |
| `RULE_TO_LESSON_PATH` | `stop-verifier.sh` | Override `scripts/hooks/rule-to-lesson.json` path |

#### Example `jq` queries

```bash
# All retrieval events (E180 surface)
jq 'select(.event == "tier0_loaded" or .event == "rule_fired" or .event == "agent_cited")' .claude/audit.jsonl

# Most-cited lessons (per E183 follow-through use case)
jq -s 'map(select(.event == "agent_cited")) | group_by(.lesson) | map({lesson: .[0].lesson, count: length}) | sort_by(-.count)' .claude/audit.jsonl

# Which rules trip most (E186 dashboard fodder)
jq -s 'map(select(.event == "rule_fired")) | group_by(.rule_id) | map({rule_id: .[0].rule_id, lesson: .[0].lesson, hits: length}) | sort_by(-.hits)' .claude/audit.jsonl
```

### Lesson Strength Score Events (E181)

`scripts/memory/score.sh` emits two event types into the same `.claude/audit.jsonl` whenever a Tier 0 lesson is reinforced (retrieval signal) or decayed (nightly amortization on `/athena:save`):

```json
{"ts":"2026-05-07T10:25:11Z","event":"strength_reinforced","lesson":"anti-patterns.md","signal":"agent_cited","strength":0.65,"epic":"E181"}
{"ts":"2026-05-07T23:00:00Z","event":"strength_decayed","lesson":"anti-patterns.md","strength":0.6489,"epic":"none"}
```

| Event | Emitted by | Trigger |
|-------|------------|---------|
| `strength_reinforced` | `score.sh reinforce` | Chained from `session-start.sh` (after `tier0_loaded`), `stop-verifier.sh` (after `rule_fired` for mapped rules), and `subagent-stop-writeback.sh` (after `agent_cited`). Per-session dedup means at most one bump per (lesson, signal) per session. |
| `strength_decayed` | `score.sh decay` | One per file per `/athena:save` invocation (via `score.sh decay-all`). Decay math: `S = S * 0.5 ^ (days_since_last_retrieved / half_life_days)` where half-life is resolved by `scripts/memory/half-life-resolve.sh` (E185). |

| Field | Type | Notes |
|-------|------|-------|
| `ts` | ISO 8601 UTC | Both events |
| `event` | enum | `strength_reinforced` / `strength_decayed` |
| `lesson` | string | Tier 0 file basename |
| `signal` | enum | `strength_reinforced` only — `tier0_loaded` (+0.05), `rule_fired` (+0.10), or `agent_cited` (+0.15) |
| `strength` | float | New score in `[0, 1]` after the operation |
| `epic` | string | Current branch's `E{n}` or `none` |

The score is stored in YAML frontmatter on each Tier 0 file (`strength`, `last_retrieved`, `retrieval_count`, plus `created` from `migrate-strength.sh`). Hooks call `score.sh reinforce` best-effort: a failing call NEVER blocks the hook.

### Lesson Archive / Revive Events (E184)

`scripts/memory/forget.sh` emits two event types into the same `.claude/audit.jsonl` whenever `/athena:forget` archives a weak lesson (S < threshold) or a `revive` round-trip restores one:

```json
{"ts":"2026-05-07T08:01:00Z","event":"lesson_archived","lesson":"failure-patterns.md","strength":0.05,"threshold":0.10,"epic":"E184"}
{"ts":"2026-05-07T08:05:00Z","event":"lesson_revived","lesson":"failure-patterns.md","epic":"E184"}
```

| Event | Emitted by | Trigger |
|-------|------------|---------|
| `lesson_archived` | `forget.sh apply` | One per file moved from `~/.claude/template-memory/` → `~/.claude/template-memory/_archive/`. Frontmatter `archived_at` + `archived_strength` fields set on the destination file. |
| `lesson_revived` | `forget.sh revive <basename>` | One per file moved back from `_archive/` → `template-memory/`. Frontmatter `archived_at` cleared. |

| Field | Type | Notes |
|-------|------|-------|
| `ts` | ISO 8601 UTC | Both events |
| `event` | enum | `lesson_archived` / `lesson_revived` |
| `lesson` | string | Tier 0 file basename (matches the `agent_cited`/`tier0_loaded` lesson field for cross-correlation) |
| `strength` | float | `lesson_archived` only — score at time of archival |
| `threshold` | float | `lesson_archived` only — the cutoff used (default 0.10) |
| `epic` | string | Current branch's `E{n}` or `none` |

These events feed `/athena:metrics --memory` (E186): the **Archive churn** section computes `archived / revived` ratio + average days between an archive and its matching revive (per-lesson last-archive lookup).

### Verification Check Events (E188)

`scripts/hooks/audit-emit-verification.sh` emits one `verification_check` event each time an agent completes a verification command before committing. Stop Rule #23 scans for this event (with `exit=0`, within the last 10 min) before allowing completion-verb commits.

```json
{"ts":"2026-05-20T10:00:00Z","event":"verification_check","check":"pnpm test","exit":0,"agent":"qa","epic":"E188"}
```

| Field | Type | Notes |
|-------|------|-------|
| `ts` | ISO 8601 UTC | Override via `CLOCK_TS` env var (test fixtures only) |
| `event` | string | Always `"verification_check"` |
| `check` | string | Name of the verification command (e.g. `pnpm test`, `pnpm typecheck`, `coverage-gate`) |
| `exit` | int | Exit code of the verification command. `0` = pass; non-zero = fail. Only `exit=0` clears Rule #23. |
| `agent` | string | Agent name from `$CLAUDE_AGENT` env var (default: `unknown`) |
| `epic` | string | `E{n}` from current branch, or `none` |

Emit via:

```bash
# After running the verification command, pass the name and exit code:
scripts/hooks/audit-emit-verification.sh "pnpm test" 0
scripts/hooks/audit-emit-verification.sh "pnpm typecheck" $?
```

Test injection env vars:

| Variable | Purpose |
|----------|---------|
| `AUDIT_LOG_PATH` | Override `.claude/audit.jsonl` path |
| `CLAUDE_AGENT` | Override agent name |
| `CLOCK_TS` | Override timestamp (ISO 8601) |
| `RULE_23_COMMIT_MSG` | Override commit message checked by Rule #23 |
| `RULE_23_WINDOW_MIN` | Override 10-min window for Rule #23 lookback |

#### Example `jq` queries

```bash
# All verification events
jq 'select(.event == "verification_check")' .claude/audit.jsonl

# Only passing verifications
jq 'select(.event == "verification_check" and .exit == 0)' .claude/audit.jsonl

# Verification events in the last 10 min
python3 -c "import datetime; print((datetime.datetime.utcnow() - datetime.timedelta(minutes=10)).strftime('%Y-%m-%dT%H:%M:%SZ'))" | \
  xargs -I{} jq --arg cutoff {} 'select(.event=="verification_check" and .exit==0 and .ts >= $cutoff)' .claude/audit.jsonl
```

### Pipeline Events (E193)

`scripts/hooks/audit-emit-pipeline.sh` is the canonical emit helper for all
pipeline-boundary events. It accepts `<event> [key=value ...]` and appends a
single JSONL line to `.claude/audit.jsonl`. Always close with `|| true` — the
helper must never block a pipeline step.

Six event types are wired at each boundary in the athena command pipeline:

```json
{"ts":"2026-06-01T10:00:00Z","event":"commit","epic":"E193","sha":"abc1234"}
{"ts":"2026-06-01T10:01:00Z","event":"merge","epic":"E193","pr":"176"}
{"ts":"2026-06-01T10:02:00Z","event":"qa_result","epic":"E193","coverage":"92.1","verdict":"pass"}
{"ts":"2026-06-01T10:03:00Z","event":"review_loop","epic":"E193","rounds":"2","final_issues":"0","verdict":"CONVERGED","budget":"50000","max_iterations":"4"}
{"ts":"2026-06-01T10:04:00Z","event":"autopilot_advance","epic":"E193","step":"implement","score":"0.87","threshold":"0.85","reason":"confidence 0.87 >= threshold 0.85"}
{"ts":"2026-06-01T10:05:00Z","event":"autopilot_pause","epic":"E193","step":"qa","score":"0.51","threshold":"0.85","reason":"confidence 0.51 < threshold 0.85"}
```

| Event | Emitted by | Call site | Key fields |
|-------|------------|-----------|------------|
| `commit` | `audit-emit-pipeline.sh` | `loop.md` + `batch.md` inline commit step | `epic`, `sha` |
| `merge` | `audit-emit-pipeline.sh` | `loop.md` + `batch.md` inline merge step | `epic`, `pr` |
| `qa_result` | `audit-emit-pipeline.sh` | `qa.md` after coverage gate | `epic`, `coverage`, `verdict` |
| `review_loop` | `scripts/reviewer-loop.sh` (via helper) | Round-close after convergence check | `epic`, `rounds`, `final_issues`, `verdict` |
| `autopilot_advance` | `scripts/autopilot.sh` (via helper) | Advance decision branch | `epic`, `step`, `score`, `threshold` |
| `autopilot_pause` | `scripts/autopilot.sh` (via helper) | Pause decision branch | `epic`, `step`, `score`, `threshold` |

#### Usage

```bash
# Emit from inline command steps (loop.md / batch.md):
bash scripts/hooks/audit-emit-pipeline.sh commit epic=E193 sha=$(git rev-parse --short HEAD) || true
bash scripts/hooks/audit-emit-pipeline.sh merge epic=E193 pr=$PR_NUMBER || true

# Emit from qa.md after coverage gate:
bash scripts/hooks/audit-emit-pipeline.sh qa_result epic=$EPIC coverage=$COV verdict=$VERDICT || true
```

#### Schema fields (common to all six events)

| Field | Type | Notes |
|-------|------|-------|
| `ts` | ISO 8601 UTC | Override via `CLOCK_TS` env var (test fixtures only) |
| `event` | string | One of the six event names above |
| `epic` | string | `E{n}` from branch name or explicit argument |
| (event-specific) | string | See per-event schema rows in the table above |

#### PostToolUse(Bash) hook-firing limitation

The `post-bash-log.sh` hook is registered in `.claude/settings.json` as a
PostToolUse(Bash) handler. In the current Claude Code environment, the
PostToolUse layer does not consistently receive `tool_result`, so `bash` +
`agent_complete` events may be absent from the log even when commands run
successfully. This is a **platform constraint** (not a repo bug): the hook
is correctly wired but the harness may not fire it for every Bash invocation.

Workaround: rely on explicit `audit-emit-pipeline.sh` calls at pipeline
boundaries (E193) rather than passive PostToolUse instrumentation. These
calls use direct `>>` appends to `.claude/audit.jsonl` and are immune to
the PostToolUse firing gap.

#### Test injection env vars

| Variable | Purpose |
|----------|---------|
| `AUDIT_LOG_PATH` | Override `.claude/audit.jsonl` path |
| `CLOCK_TS` | Override timestamp (ISO 8601) |

#### Example `jq` queries

```bash
# All pipeline events
jq 'select(.event == "commit" or .event == "merge" or .event == "qa_result" or .event == "review_loop" or .event == "autopilot_advance" or .event == "autopilot_pause")' .claude/audit.jsonl

# Pipeline event counts
jq -s 'map(select(.event | test("commit|merge|qa_result|review_loop|autopilot_(advance|pause)"))) | group_by(.event) | map({event: .[0].event, count: length})' .claude/audit.jsonl

# QA pass rate
jq -s 'map(select(.event=="qa_result")) | {total: length, pass: map(select(.verdict=="pass")) | length}' .claude/audit.jsonl

# All commits with sha (E193 substrate)
jq 'select(.event=="commit")' .claude/audit.jsonl
```

### Lesson Consolidation Events (E190)

`scripts/memory/consolidation-detect.sh` emits one `consolidation_detected` event each time the detector is run (via `/athena:learn` Step 4.6 or manually). The event records how many near-duplicate clusters were found.

```json
{"ts":"2026-05-19T12:00:00Z","event":"consolidation_detected","clusters":2,"lessons_involved":5,"epic":"E190"}
```

| Event | Emitted by | Trigger |
|-------|------------|---------|
| `consolidation_detected` | `consolidation-detect.sh` | On every invocation of the consolidation detector — whether clusters are found or not (clusters=0 on clean run). |

| Field | Type | Notes |
|-------|------|-------|
| `ts` | ISO 8601 UTC | Override via `CLOCK_TS` env var (test fixtures only) |
| `event` | string | Always `"consolidation_detected"` |
| `clusters` | int | Number of near-duplicate clusters found (0 = all lessons distinct) |
| `lessons_involved` | int | Total unique lessons involved across all clusters (0 on clean run) |
| `epic` | string | `E{n}` from current branch, or `none` |

Test injection env vars:

| Variable | Purpose |
|----------|---------|
| `AUDIT_LOG_PATH` | Override `.claude/audit.jsonl` path |
| `TEMPLATE_MEMORY_DIR` | Override `~/.claude/template-memory` |
| `CONSOLIDATION_THRESHOLD` | Override 0.7 similarity threshold |
| `CLOCK_TS` | Override timestamp (ISO 8601) |
| `CLOCK_DATE` | Override date used in report filename (YYYY-MM-DD) |
| `REPORT_PATH` | Write markdown report to this path (optional) |

Tests live in `scripts/memory/tests/test-consolidation.sh` (12 cases).

#### Example `jq` queries

```bash
# All consolidation scan events
jq 'select(.event == "consolidation_detected")' .claude/audit.jsonl

# Scans that found clusters
jq 'select(.event == "consolidation_detected" and .clusters > 0)' .claude/audit.jsonl

# Total clusters detected over time
jq -s 'map(select(.event == "consolidation_detected")) | map(.clusters) | add // 0' .claude/audit.jsonl
```

### Plan Brainstorm Events (E187)

`scripts/plan/brainstorm-emit.sh` emits one `plan_brainstorm` event per subcommand invocation — one for the proposal write, one for the epic-file render on approve:

```json
{"ts":"2026-05-19T12:00:00Z","event":"plan_brainstorm","epic":"E300","status":"proposed","phase_count":3}
{"ts":"2026-05-19T13:00:00Z","event":"plan_brainstorm","epic":"E300","status":"approved","phase_count":3}
```

| Event | Emitted by | Trigger |
|-------|------------|---------|
| `plan_brainstorm` (status=proposed) | `brainstorm-emit.sh strategy-log` | After appending the brainstorm proposal row to `docs/context/strategy-log.md`. |
| `plan_brainstorm` (status=approved) | `brainstorm-emit.sh render-epic` | After rendering the enriched epic file at `docs/epics/e{n}-*.md` via `/athena:plan approve E{n}`. |

| Field | Type | Notes |
|-------|------|-------|
| `ts` | ISO 8601 UTC | Override via `CLOCK_TS` env var (test fixtures only) |
| `event` | string | Always `"plan_brainstorm"` |
| `epic` | string | `E{n}` of the brainstormed epic |
| `status` | enum | `proposed` (pre-approval) or `approved` (post-approval render) |
| `phase_count` | int | Number of Implementation Phases in the JSON (typically 3-5) |

Test injection env vars (mirrors E180–E184 convention):

| Variable | Purpose |
|----------|---------|
| `AUDIT_LOG_PATH` | Override `.claude/audit.jsonl` |
| `STRATEGY_LOG_PATH` | Override `docs/context/strategy-log.md` |
| `EPICS_DIR` | Override `docs/epics/` |
| `CLOCK_DATE` | Override `date -u +%Y-%m-%d` (date-only, for strategy-log row header) |
| `CLOCK_TS` | Override `date -u +%Y-%m-%dT%H:%M:%SZ` (ISO 8601, for audit event timestamp) |

Tests live in `scripts/plan/tests/test-brainstorm-emit.sh` (7 cases, runs in <2s).

#### Example `jq` queries

```bash
# All brainstorm events
jq 'select(.event == "plan_brainstorm")' .claude/audit.jsonl

# Per-status counts
jq -s 'map(select(.event == "plan_brainstorm")) | group_by(.status) | map({status: .[0].status, count: length})' .claude/audit.jsonl

# Brainstorm phase-count distribution
jq -s 'map(select(.event == "plan_brainstorm")) | group_by(.phase_count) | map({phase_count: .[0].phase_count, epics: length})' .claude/audit.jsonl
```

### Ultra Panel Events (E206)

`scripts/qa/verify-panel.sh` emits one `verify_panel_ultra` event when `$ATHENA_VERIFY_POSTURE` matches `judge-panel*` (the ultra tier). The event captures the double-evaluator agreement result and the N=3 judge panel outcome in a single record.

```json
{"ts":"2026-06-02T10:00:00Z","event":"verify_panel_ultra","epic":"E206","evaluator_a_verdict":"PASS","evaluator_b_verdict":"PASS","agreed":true,"judge_open_count":0,"final_verdict":"PASS"}
{"ts":"2026-06-02T10:05:00Z","event":"verify_panel_ultra","epic":"E206","evaluator_a_verdict":"PASS","evaluator_b_verdict":"FAIL","agreed":false,"judge_open_count":0,"final_verdict":"ESCALATE"}
{"ts":"2026-06-02T10:10:00Z","event":"verify_panel_ultra","epic":"E206","evaluator_a_verdict":"FAIL","evaluator_b_verdict":"FAIL","agreed":true,"judge_open_count":2,"final_verdict":"FAIL"}
```

| Event | Emitted by | Trigger |
|-------|------------|---------|
| `verify_panel_ultra` | `verify-panel.sh` Phase 6.5 | After the double-evaluator and N=3 judge panel complete (ultra posture only). Emitted once per `verify-panel.sh` invocation when `$ATHENA_VERIFY_POSTURE` starts with `judge-panel`. |

| Field | Type | Notes |
|-------|------|-------|
| `ts` | ISO 8601 UTC | Override via `CLOCK_TS` env var (test fixtures only) |
| `event` | string | Always `"verify_panel_ultra"` |
| `epic` | string | Epic ID passed to `verify-panel.sh` (e.g. `E206`) |
| `evaluator_a_verdict` | enum | `PASS` or `FAIL` — verdict from evaluator context A |
| `evaluator_b_verdict` | enum | `PASS` or `FAIL` — verdict from evaluator context B |
| `agreed` | boolean | `true` if both evaluators returned the same verdict; `false` on disagreement |
| `judge_open_count` | int | Number of judges (0–3) with at least one open finding. ≥2 → blocking. 1 → advisory. 0 → all clear. |
| `final_verdict` | enum | `PASS` / `FAIL` / `ESCALATE`. `ESCALATE` means evaluators disagreed — epic must NOT auto-advance; human review required. |

Agreement rules:
- **PASS/PASS** → `agreed=true`, judge panel runs; `final_verdict` depends on judge results (PASS if ≤1 judge open; FAIL if ≥2 judges open)
- **FAIL/FAIL** → `agreed=true`, `final_verdict=FAIL` (surviving evaluator findings union added to panel)
- **PASS/FAIL** → `agreed=false`, `final_verdict=ESCALATE` (do not auto-advance; `needs_human` emitted in report)

Test injection env vars:

| Variable | Purpose |
|----------|---------|
| `AUDIT_LOG_PATH` | Override `.claude/audit.jsonl` path |
| `CLOCK_TS` | Override timestamp (ISO 8601) |
| `CLAUDE_CMD` | Override `claude` binary (used for mock fixtures) |
| `ATHENA_ULTRA_MODEL` | Override opus model for evaluators and judges (default: `claude-opus-4-8`) |

Example `jq` queries:

```bash
# All ultra panel events
jq 'select(.event == "verify_panel_ultra")' .claude/audit.jsonl

# ESCALATE events (evaluator disagreements requiring human review)
jq 'select(.event == "verify_panel_ultra" and .final_verdict == "ESCALATE")' .claude/audit.jsonl

# Ultra panel pass rate
jq -s 'map(select(.event == "verify_panel_ultra")) | {total: length, pass: map(select(.final_verdict == "PASS")) | length, fail: map(select(.final_verdict == "FAIL")) | length, escalate: map(select(.final_verdict == "ESCALATE")) | length}' .claude/audit.jsonl
```

### Effort Resolved Events (E198 + E207)

`scripts/effort/resolve.sh` emits one `effort_resolved` event each time an effort tier is resolved.
Post-E207, the event carries the full cost profile: model map, concurrency ceiling, and verification posture.

```json
{"ts":"2026-06-01T10:00:00Z","event":"effort_resolved","tier":"ultra","source":"flag","model_map":"reviewer=opus,evaluator=opus","max_concurrent":8,"verify_posture":"judge-panel+adversarial+multimodal"}
{"ts":"2026-06-01T10:01:00Z","event":"effort_resolved","tier":"standard","source":"default","model_map":"reviewer=sonnet,evaluator=sonnet","max_concurrent":4,"verify_posture":"single-vote"}
```

| Field | Type | Notes |
|-------|------|-------|
| `ts` | ISO 8601 UTC | Override via `CLOCK_TS` env var (test fixtures only) |
| `event` | string | Always `"effort_resolved"` |
| `tier` | enum | `quick` / `standard` / `thorough` / `ultra` |
| `source` | enum | `flag` (from `--effort` arg) / `env` (from `$ATHENA_EFFORT`) / `default` (fallback) |
| `model_map` | string | Comma-separated `reviewer=<model>,evaluator=<model>` (E207). E.g. `"reviewer=opus,evaluator=opus"`. Pre-E207 events lack this field. |
| `max_concurrent` | int | Concurrency ceiling for this tier (E207). Ultra is cores-aware: `min(16, cores-2)`, floored at 1. Pre-E207 events lack this field. |
| `verify_posture` | string | Verification posture string (E207). E.g. `"single-vote"`, `"adversarial-3+perspective"`, `"judge-panel+adversarial+multimodal"`. Pre-E207 events lack this field. |

Per-tier values:

| Tier | model_map | max_concurrent | verify_posture |
|------|-----------|----------------|----------------|
| quick | reviewer=haiku,evaluator=sonnet | 1 | single-vote |
| standard | reviewer=sonnet,evaluator=sonnet | 4 | single-vote |
| thorough | reviewer=sonnet,evaluator=opus | 4 | adversarial-3+perspective |
| ultra | reviewer=opus,evaluator=opus | min(16,cores-2) | judge-panel+adversarial+multimodal |

Test injection env vars:

| Variable | Purpose |
|----------|---------|
| `AUDIT_LOG_PATH` | Override `.claude/audit.jsonl` path |
| `CLOCK_TS` | Override timestamp (ISO 8601) |

Example `jq` queries:

```bash
# All effort_resolved events
jq 'select(.event == "effort_resolved")' .claude/audit.jsonl

# Tier distribution
jq -s 'map(select(.event == "effort_resolved")) | group_by(.tier) | map({tier: .[0].tier, count: length})' .claude/audit.jsonl

# Post-E207 events with cost fields (exclude pre-E207)
jq 'select(.event == "effort_resolved" and .model_map != null)' .claude/audit.jsonl
```

### Coverage-Drop Events (E199)

`scripts/hooks/audit-emit-coverage-drop.sh` emits one `coverage_dropped` event each time
a hard cap is actually hit — making the truncation visible in the audit log. Callers must
append `|| true` so a missing `jq` or unwritable log never blocks the pipeline.

```json
{"ts":"2026-06-01T10:00:00Z","event":"coverage_dropped","what":"batch_concurrency","reason":"worktree_isolation_broken","tier":"orchestration"}
{"ts":"2026-06-01T10:05:00Z","event":"coverage_dropped","what":"reviewer_loop","reason":"MAX_ITERATIONS_reached","tier":"review"}
```

| Event | Emitted by | Trigger |
|-------|------------|---------|
| `coverage_dropped` | `audit-emit-coverage-drop.sh` | Called by any callsite that hits a hard cap: `batch.md` Step 3.5b `--max-concurrent 1` fallback, `reviewer-loop.sh` `MAX_ITERATIONS` / `MAX_REACHED` branch, or any future sampling gate. |

| Field | Type | Notes |
|-------|------|-------|
| `ts` | ISO 8601 UTC | Override via `CLOCK_TS` env var (test fixtures only) |
| `event` | string | Always `"coverage_dropped"` |
| `what` | string | What capability was capped (e.g. `batch_concurrency`, `reviewer_loop`, `metrics_top_n`) |
| `reason` | string | Why the cap was hit (e.g. `worktree_isolation_broken`, `MAX_ITERATIONS_reached`, `sample_cap_hit`) |
| `tier` | string | System tier where the cap occurred (`orchestration`, `review`, `memory`) |

Usage:

```bash
# From batch.md Step 3.5b fallback:
bash scripts/hooks/audit-emit-coverage-drop.sh batch_concurrency worktree_isolation_broken orchestration || true

# From reviewer-loop.sh MAX_REACHED branch:
bash scripts/hooks/audit-emit-coverage-drop.sh reviewer_loop MAX_ITERATIONS_reached review || true

# Future callsite pattern:
bash scripts/hooks/audit-emit-coverage-drop.sh metrics_top_n sample_cap_hit memory || true
```

Test injection env vars:

| Variable | Purpose |
|----------|---------|
| `AUDIT_LOG_PATH` | Override `.claude/audit.jsonl` path |
| `CLOCK_TS` | Override timestamp (ISO 8601) |

Tests live in `scripts/hooks/tests/test-coverage-drop.sh` (8 cases, runs in <2s).

Example `jq` queries:

```bash
# All coverage_dropped events
jq 'select(.event == "coverage_dropped")' .claude/audit.jsonl

# Coverage drops by tier (last 30 days)
jq -s 'map(select(.event == "coverage_dropped")) | group_by(.tier) | map({tier: .[0].tier, drops: length})' .claude/audit.jsonl

# Batch concurrency drops only
jq 'select(.event == "coverage_dropped" and .what == "batch_concurrency")' .claude/audit.jsonl
```

### State Drift Events (E196 / E-batch1 summary-event fix)

`scripts/state/check-drift.sh` (Stop hook, `|| true` — never blocks) compares
`docs/epics/EPIC_INDEX.md` against `docs/context/epic-progress.md` and emits a
`state_drift` event when they disagree. It used to emit **one event per
drifted row per run** — on a repo with real drift that was ~98% of the live
audit log. It now emits **exactly one summary event per run**:

```json
{"ts":"2026-06-01T10:00:00Z","event":"state_drift","source":"check-drift.sh","mismatches":6,"first":"Phase 1 ✅→⬜; E12 Impl:✅→⬜; E13 QA:⬜→🔄; ..."}
```

| Field | Type | Notes |
|-------|------|-------|
| `ts` | ISO 8601 UTC | |
| `event` | string | Always `"state_drift"` |
| `source` | string | Always `"check-drift.sh"` |
| `mismatches` | int | Total mismatch count across both the Phase Status and Epic Step Matrix sections |
| `first` | string | A `"; "`-joined digest of every mismatch (`<label> <expected>→<found>`), **capped to ~200 chars** (`...` suffix when truncated) |

The **full**, uncapped detail string is always printed to stdout/stderr (not
just the capped `first` field) — run `scripts/state/check-drift.sh` directly
to see every mismatch when triaging drift.

Built via `jq -n` (never `printf`/string-concat) — markdown table cells can
carry embedded quotes (e.g. a Notes column referencing `"foo"`) that would
otherwise produce invalid JSONL.

Test injection env vars (unchanged from pre-E-batch1):

| Variable | Purpose |
|----------|---------|
| `PROGRESS_FILE` | Override `docs/context/epic-progress.md` path |
| `INDEX_FILE` | Override `docs/epics/EPIC_INDEX.md` path |
| `AUDIT_LOG` | Override `.claude/audit.jsonl` path |

Tests live in `scripts/state/tests/test-check-drift.sh`.

### Selective SessionStart Inject (E182)

`session-start.sh` injects Tier 0 wisdom in **two blocks** instead of the
single always-on PRIMER:

| Block | Source | When |
|-------|--------|------|
| **A — always-on PRIMER** | `~/.claude/template-memory/NEW_PROJECT_PRIMER.md` | Every SessionStart (byte-identical to pre-E182) |
| **B — cued category excerpts** | The other Tier 0 lesson files, ranked by cue match | When the active branch's diff/status/branch-name produces any cue |

Block B delegates to `scripts/memory/inject.sh`, which:

1. Computes the cue: `git diff --name-only main` + `git status -s` + branch
   name. Each path-prefix cue maps to tags via
   `scripts/memory/lesson-tags.json` (`path_tag_cues`); branch-name regexes
   map to tags via `branch_tag_cues`.
2. For every lesson in `~/.claude/template-memory/`, calls
   `scripts/memory/match.sh` to compute
   `score = 3 × (lesson.domains ∩ cue.paths) + 2 × (lesson.tags ∩ cue.tags) + lesson.strength`.
   Strength is sourced via E181's `score.sh get` (NOT reimplemented).
   Lessons tagged `evergreen` (e.g. anti-patterns, security-learnings) get
   a `+100` floor so they always inject when any cue is present.
3. Ranks descending; prints the top N (capped at `E182_MAX_LESSONS=8` lessons
   and `E182_BUDGET_LINES=150` total Block B lines). Each lesson is preceded
   by `## <basename> — score=N.NN tags=[a,b]` and capped at `BUDGET_LINES/3`
   lines so a single lesson cannot blow the budget.
4. Emits one `tier0_loaded` event per selected lesson (E180 contract) and
   chains an `strength_reinforced` bump via E181's `score.sh reinforce`. The
   E181 per-session dedup ensures multiple SessionStart fires within a day
   count as one bump.

Empty cue (initial clone on `main`, no diff, no status, no matching branch
regex) → Block B is empty (zero output, zero events). Block A still fires.

Tag/domain assignment lives in `scripts/memory/lesson-tags.json` (file
basename → `{tags, domains, evergreen}`). File-level YAML frontmatter on a
lesson (`tags:`, `domains:`, `evergreen:`) **always wins** over the sidecar
— the sidecar only fills the gap for lessons not yet re-promoted with E182
frontmatter. `@memory-curator` adds these fields at promotion time
(`/athena:promote`).

Test injection env vars:

| Variable | Purpose |
|----------|---------|
| `TEMPLATE_MEMORY_DIR` | Override `~/.claude/template-memory` (test isolation) |
| `LESSON_TAGS_JSON` | Override sidecar map path |
| `E182_FORCE_BRANCH` | Inject this branch name (skip `git branch`) |
| `E182_FORCE_PATHS` | Inject these newline-sep paths (skip `git diff`) |
| `E182_BUDGET_LINES` | Override 150-line Block B budget |
| `E182_MAX_LESSONS` | Override 8-lesson hard cap |
| `E182_EVERGREEN_FLOOR` | Override the +100 floor for evergreen lessons |

Best-effort: a failing `inject.sh` invocation NEVER blocks SessionStart
(the hook output is injected as Claude's context — partial Block B with
just Block A is always preferable to no SessionStart context). The hook
calls `inject.sh ... || true`.

Tests live in `scripts/hooks/tests/test-e182-selective-inject.sh` (15 cases,
runs in ~10s — covers cue match, branch regex, evergreen bypass, budget cap,
strength tie-break, frontmatter override, dedup, fallback).

## PR Created Hook (`pr-created.sh`)

PostToolUse(Bash) hook that fires after any `gh pr create` command. Non-blocking (always exits 0).

### What it does

1. **Auto-Label** — adds labels to the PR via `gh pr edit --add-label`:
   - `phase:N` — from `epic-progress.md`
   - `epic:E{n}` — from branch name (`feat/E{n}-*`)
   - `size:S|M|L` — from `EPIC_INDEX.md`
   - `agent:batch` or `agent:loop` — from branch pattern
   - Creates labels if they don't exist (`gh label create --force`)

2. **Auto-Assign Reviewer** — based on changed files:
   - This is a single Next.js app (`next-app/`), so the old `server/`→backend,
     `client/`→frontend path split no longer applies. Both `$PR_REVIEWER_BACKEND` and
     `$PR_REVIEWER_FRONTEND` are optional; set either (or both) to add reviewers.
   - `docs/` only -> skip assignment
   - Skipped silently if env vars not set

3. **Epic Context Comment** — adds a markdown table comment with:
   - Epic ID + name, phase, size, spec file path, dependencies

### Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `PR_REVIEWER_BACKEND` | No | (unset) | GitHub username for a reviewer (single-app repo — see note in § Auto-Assign Reviewer; path split no longer applies) |
| `PR_REVIEWER_FRONTEND` | No | (unset) | GitHub username for a reviewer (optional; same single-app note) |

### Graceful Degradation

- No `gh` CLI -> exits silently
- No PR URL in output -> exits with warning
- No epic in branch name -> skips labels/comment
- No env vars for reviewers -> skips assignment
- Any `gh` API error -> ignored (stderr suppressed)

## Bugfix Audit Log (`post-commit-bugfix-log.sh`)

PostToolUse(Bash) hook that fires after any `git commit` command. When the latest commit message starts with `fix:` or `fix(`, appends a structured stub entry to `docs/context/bugfix-log.md`. Non-blocking (always exits 0).

### What it does

1. **Detects fix commits** — checks if the bash command contains `git commit` and the latest commit starts with `fix:`/`fix(`
2. **Idempotency check** — skips if the commit hash is already in the log file
3. **Auto-creates log file** — creates `docs/context/bugfix-log.md` with header on first fix commit
4. **Appends stub entry** — timestamp, short hash, message, changed files
5. **Deferred enrichment** — root cause and test fields default to `_(pending)_` for `/athena:save`

### Entry Format

```markdown
## 2026-04-07T12:00:00+08:00 — abc1234
**Message:** fix: resolve null pointer in auth flow
**Files:** next-app/actions/auth.ts, next-app/actions/__tests__/auth.test.ts
**Root Cause:** _(pending — enrich during /athena:save)_
**Test Added:** _(pending)_
```

### Graceful Degradation

- Command is not `git commit` -> exits silently
- Latest commit is not `fix:` -> exits silently
- Hash already logged -> exits silently (idempotent)
- `git log` fails -> exits silently

## Context Health Monitor (`context-health-monitor.sh`)

PostToolUse hook (matcher `.*`) that reads `.claude/audit.jsonl` after every
tool call and emits context-window warnings to stdout (injected as
`additionalContext`). Bash can't introspect Claude's real token count, so we
use two measurable proxies: cumulative tool-call count and total bytes read.
Non-blocking (always exits 0).

### Thresholds

| Tier | Trigger | Message |
|------|---------|---------|
| Yellow (~70% proxy) | `tool_calls >= 200` OR `bytes_read >= 500000` | `⚠️ Session context filling up ({calls} calls, {KB} KB read). Consider `/athena:save` to checkpoint.` |
| Red (~85% proxy) | `tool_calls >= 400` OR `bytes_read >= 1000000` | `🔴 Session context critical ({calls} calls, {KB} KB). Recommend `/athena:save` + fresh agent handoff.` |

- `tool_calls` = line count of `.claude/audit.jsonl`, **offset by the session
  anchor** (see below) — `current_line_count - anchor`, floored at 0. Falls
  back to the raw total when no anchor file exists (e.g. hook run standalone).
- `bytes_read` = sum of file sizes for `tool_input.file_path` values recorded
  in the audit log (only counted when the path still exists on disk; portable
  across GNU `stat -c %s` and BSD `stat -f %z`)

### Session-Scoped Context Health + Log Rotation (E-batch1)

`tool_calls` used to be the **lifetime** line count of `.claude/audit.jsonl` —
in a long-lived repo the monitor sticks at yellow/red permanently once enough
history accumulates, even in a brand-new session. Two fixes, both driven by
`session-start.sh` at the top of every session (before anything else appends
to the audit log):

1. **Session anchor.** `session-start.sh` snapshots the current line count of
   `.claude/audit.jsonl` into `.claude/.session-anchor` (just the number).
   `context-health-monitor.sh` then computes `tool_calls` as
   `current_line_count - anchor` instead of the raw total, so the yellow/red
   thresholds track **this session's** activity, not the repo's entire
   history. Override the anchor path with `SESSION_ANCHOR_PATH` (mirrors the
   `AUDIT_LOG_PATH` / `HEALTH_STATE_PATH` test-injection convention).
2. **Audit-log rotation.** If `.claude/audit.jsonl` exceeds 5MB at
   SessionStart, it's moved to `.claude/audit-<YYYYMM>.jsonl` and a fresh
   (empty) log is started. Rotation also resets `.claude/.health-state` to
   `none` (a fresh log has nothing to be red/yellow about) and the anchor to
   `0`.

Both are best-effort — a failure in either step never blocks SessionStart.

### Deduplication

Last-emitted tier is persisted in `.claude/.health-state` (`none` / `yellow` /
`red`). A warning only fires when the computed tier is strictly higher than
the stored tier, so:

- Staying in yellow across many calls emits exactly once
- Escalating from yellow to red emits on the red transition
- Emptying `.claude/audit.jsonl` resets the monitor on the next run because
  the hook exits silently on empty input (no state rewrite)

### Test Injection

Unit tests drive the hook with fixture audit logs via two env vars:

| Variable | Purpose |
|----------|---------|
| `AUDIT_LOG_PATH` | Override the default `.claude/audit.jsonl` path |
| `HEALTH_STATE_PATH` | Override the default `.claude/.health-state` path |
| `SESSION_ANCHOR_PATH` | Override the default `.claude/.session-anchor` path (E-batch1) |

Fixture-driven cases live in `scripts/hooks/tests/test-context-health-monitor.sh`
(9 cases, runs in ~0.4s). Run directly:

```bash
./scripts/hooks/tests/test-context-health-monitor.sh
```

### Graceful Degradation

- Missing `.claude/audit.jsonl` -> exits silently
- Empty audit log -> exits silently
- No `jq` installed -> `bytes_read` stays 0, tool-call threshold still fires
- Non-JSON stdin -> ignored (stdin is drained, not parsed)

## Lesson: Convention-rename → re-sync the verifier patterns (E319)

`stop-verifier.sh`'s Rule 2 (RBAC guard on mutating Server Actions) matches guard calls
by **name** (`requireAuth`/`requireEditor`/`requireAdmin`/…). Name-based rules are
correct on the day they're written and then **silently false-positive** the moment a
downstream fork renames or extends the RBAC convention (e.g. `requireEditor` →
`requireRole`/`requireFlag`, or a per-action `guard()` helper) — the rule keeps blocking
on files that ARE guarded, just under a name it doesn't recognize yet. There is no
compiler error for this; it just quietly starts rejecting legitimate work.

Three practices this epic (E319) encodes to prevent repeating that:

1. **Recognize a family, not one hardcoded name.** When a guardrail matches by
   identifier, list the *reasonable near-future variants* up front (Rule 2 now
   recognizes `requireAuth|requireEditor|requireAdmin|requireRole|requireFlag|guard(`)
   rather than waiting for the false-positive to happen and firefighting it.
2. **Editing a guardrail that gates the agent's own completion needs explicit user
   sign-off.** `stop-verifier.sh` runs on `Stop` — it decides whether *this session*
   is allowed to finish. Widening or narrowing what it blocks is not a routine
   refactor; get the user to confirm the new pattern before it ships (see the
   `// stop-verifier:public-action` exemption marker and the guard-family widening
   above — both required explicit review).
3. **Every guardrail change ships with a regression fixture.** A rule change with no
   fixture in `scripts/hooks/tests/` is unverifiable — you can't prove it still blocks
   what it should AND passes what it shouldn't. `test-rule-nextjs-invariants.sh` now
   carries three E319 cases: an unguarded action (still blocks), a `requireRole()`/
   `guard()`-guarded action (passes), and a `// stop-verifier:public-action`-marked
   pre-auth endpoint (passes despite no guard call).

**Guardrail-widening discipline, stated generally:** if you touch a stop-verifier rule,
ask "what convention will this look for tomorrow, not just today" — and don't skip the
fixture. A companion Tier-0 memory note (`guardrail-widening-discipline.md`, if present
under `~/.claude/template-memory/`) generalizes this beyond `stop-verifier.sh` to any
completion-gating check.
