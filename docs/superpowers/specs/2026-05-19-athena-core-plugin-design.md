# Athena Core — Claude Code Plugin Design

> Spec for porting the universal meta-workflow of the AI Coding Template's Athena system to a distributable Claude Code plugin.
> Author: brainstormed 2026-05-19 with @qwedsazxc78. Phase 1 only — Phase 2 (profile extraction) deferred.

---

## 1. Goal

Package Athena's universal meta-workflow — memory tiers, planning, autopilot, review-loop, stop-verifier framework, agent roster — as a single Claude Code plugin (`athena-core`) installable in **any** project (not only forks of this template).

Out of scope for Phase 1: FastAPI/React/openapi/Zeabur-specific rules, agents, and commands. Those are deferred to Phase 2 as `athena-saas-profile`, a separate plugin that extends `athena-core`.

## 2. Scope decision matrix

| Question | Decision |
|---|---|
| Plugin scope | **Universal meta-workflow only** (Option 1). FastAPI/React/Zeabur deferred to Phase 2. |
| Phase 2 endpoint | **Two-plugin split** (Option 3): `athena-core` + `athena-saas-profile`. Profile extends core via documented extension points. |
| Tier 0 memory location | `~/.claude/athena-memory/` — **truly global**, shared across all projects on the user's machine. |
| Tier 1 memory location | `<project>/docs/context/` — per-project, matches current Athena convention (zero migration for template forks). |
| Plugin internal layout | **Athena-native conventions** (`commands/athena/`, flat `agents/`, `scripts/hooks/` + `scripts/memory/` separate). The `.claude-plugin/` wrapper is required by Claude Code, but internals stay familiar. |
| Auto-trigger strategy | **Gateway + description-driven**. SessionStart auto-loads one ~50-line `using-athena` skill; other skills trigger via Claude Code's native description matching. |
| Seed memory strategy | **Curated + sanitized**. 8 of 15 current Tier 0 files ship in core (template specifics stripped). 5 remain for Phase 2 profile pack. |
| Distribution channel (v1) | **Git URL install only**. Marketplace deferred to v2 after stability. |
| Test rigor | **3 fixtures + smoke tests** (~20 tests, <60s runtime). |
| Forward-compat for Phase 2 | **Designed in now**. Plugin manifest exposes a `profiles` extension registry so the future profile pack drops in without modifying core. |

## 3. Architecture

### 3.1 Plugin layout

```
athena-core/
  .claude-plugin/
    plugin.json           # manifest: name, version, hooks, extension points
    marketplace.json      # metadata for future marketplace submission
  skills/                 # 6 universal skills (description-driven auto-trigger)
    using-athena.md         # NEW — ~50-line gateway, auto-loaded SessionStart
    tdd-workflow.md
    verification-discipline.md
    systematic-debugging.md
    launch-checklist.md
    reviewer-convergence.md # NEW — distilled from scripts/reviewer-loop.sh
  agents/                 # 11 universal agents (flat)
    orchestrator.md  strategist.md  reviewer.md  qa.md  evaluator.md
    debugger.md  best-practice.md  memory-curator.md
    spec-writer.md   deployer.md    designer.md
  commands/athena/        # 17 universal commands
    plan.md  loop.md  cycle.md  autopilot.md  batch.md
    save.md  load.md
    learn.md  promote.md  forget.md  metrics.md  dashboard.md
    spec.md  implement.md  qa.md  ship.md  pr.md
  hooks/
    hooks.json              # registers SessionStart, PreToolUse, PostToolUse, Stop
  scripts/
    lib/common.sh           # two-root resolution, shared helpers
    memory/
      score.sh              # get/reinforce/decay/decay-all/flag-weak
      match.sh              # selective injection scorer
      inject.sh             # SessionStart inject orchestrator
      half-life-resolve.sh
      half-life-defaults.json
    hooks/
      session-start.sh
      stop-verifier.sh
      audit-emit-verification.sh
      user-prompt-submit.sh
      pre-bash-guard.sh
      subagent-stop-writeback.sh
    stop-rules/             # 10 universal rules as discrete scripts
      console-log-residue.sh   large-file-warning.sh
      test-file-size.sh        internal-mock-assertions.sh
      parametrize-nudge.sh     mock-depth-limit.sh
      verification-discipline.sh   qa-gate-enforcement.sh
      migration-review.sh      reviewer-convergence.sh
  seed-memory/            # 8 sanitized files — installed once on first run
    NEW_PROJECT_PRIMER.md  testing-patterns.md     anti-patterns.md
    failure-patterns.md    debugging-patterns.md   dx-patterns.md
    security-learnings.md  workflow-patterns.md
  tests/
    fixtures/
      empty-project/  nodejs-mini/  python-mini/
    test-install.sh    test-hooks.sh    test-memory-loop.sh
    test-match-inject.sh   test-commands.sh   run-all.sh
  install.sh              # idempotent first-run seeder
  package.json            # plugin metadata
  README.md               # user-facing intro + install
  INSTALL.md              # detailed install + uninstall guide
  MIGRATION.md            # for users porting from this template
  CLAUDE.md               # plugin's own session identity
```

### 3.2 Storage layout (per the memory model decision)

```
GLOBAL — accumulates across all projects:
~/.claude/athena-memory/
  <8 sanitized seed files>      # shipped, then user-editable
  <user-promoted lessons>.md    # accumulate via /athena:promote
  .installed                    # marker — install.sh skips on upgrade
  .meta/
    strengths.json              # per-file: strength, half_life_days,
                                # last_retrieved, retrieval_count, created
    lesson-tags.json            # sidecar keyword tags for match.sh
    promotion-log.jsonl         # audit trail of every promotion
    archive/                    # /athena:forget destination

PER-PROJECT — lives in user's repo:
<project>/docs/context/
  session-summary.md            # Tier 1 — what we did, what's next
  agent-write-back/             # per-agent checkpoints
  bugfix-log.md                 # debugger findings, QA-report fuel
  audit-log.md                  # human-readable extract
<project>/.claude/
  audit.jsonl                   # machine-readable event log
  athena.config.json            # per-project overrides (optional)
```

**Ownership rule:** `~/.claude/athena-memory/` is **owned by the user** after first-run seeding. Plugin upgrades never overwrite user content. User customizations to seed files survive upgrades.

### 3.3 Forward-compat extension registry

`plugin.json` includes a Claude Code–standard manifest plus an `athena` namespace consumed by core itself (NOT by the Claude Code plugin runtime — it ignores unknown fields):

```json
{
  "name": "athena-core",
  "version": "1.0.0",

  "// Claude Code standard fields below": "name, version, hooks, etc.",

  "// athena namespace — core reads this at runtime to enable extensions": "",
  "athena": {
    "extensionPoints": {
      "stop-rules": "scripts/stop-rules/",
      "commands": "commands/athena/",
      "agents": "agents/",
      "skills": "skills/",
      "spec-formats": ["openapi", "proto", "typespec", "freeform"]
    }
  }
}
```

A future `athena-saas-profile` plugin drops files into the same directory shapes; Claude Code naturally merges plugin contents (skills/agents/commands across plugins are all visible). Core never references the profile. The `athena.extensionPoints` registry exists so core's own scripts (e.g., `stop-verifier.sh`) can discover rules contributed by profile plugins without hardcoded paths.

## 4. Universal subset (the "what ships in core")

### 4.1 Commands — 17 in core, 6 deferred to Phase 2

| Ship in core | Defer to profile |
|---|---|
| plan, loop, cycle, autopilot, batch | deploy (Zeabur 7-gate) |
| save, load | dba (Alembic) |
| learn, promote, forget, metrics, dashboard | domain (FastAPI scaffolder) |
| spec*, implement, qa, ship, pr | audit (OpenAPI ↔ server ↔ client) |
| | design (couples to client/src/components/ui/) |
| | qa-report (bugfix-log.md convention) |

`* spec` is universalized — drops `openapi.yaml` hard requirement, pluggable via `plugin.json` `spec.format` (openapi | proto | typespec | freeform). Default = freeform markdown in `docs/specs/`.

### 4.2 Agents — 11 in core, 2 deferred

Ship: orchestrator, strategist, reviewer, qa, evaluator, debugger, best-practice, memory-curator, spec-writer*, deployer*, designer*.

Defer: dba (Alembic), domain-expert.tmpl (FastAPI scaffolder).

`*` Universalized agents read behavior keys (review checklists, deploy gates) from `plugin.json` + project `CLAUDE.md` instead of baking stack-specific knowledge into prompts.

### 4.3 Skills — 6 in core (4 ported + 2 NEW), 7 deferred

Ship: using-athena (NEW gateway), tdd-workflow, verification-discipline, systematic-debugging, launch-checklist, reviewer-convergence (NEW).

Defer: openapi-first, server-patterns, client-patterns, frontend-review, dba-migrations, deploy-gcr-zeabur, upgrade-stripe.

### 4.4 Stop-verifier rules — 10 universal of 23

Ship: console.log residue, large file warning, test file size, internal mock assertions, parametrize nudge, mock depth limit, verification discipline, QA gate enforcement, migration review (path-configurable), reviewer convergence.

Defer: localStorage ban, fireEvent ban, staleTime hardcoding, MSW handler location, folder names, OpenAPI drift, orphan route, CSS co-location, MSW factory, schema bridge, CSS var drift, design-system rules (x2), OpenAPI contract evidence.

### 4.5 Seed memory — 8 in core, 5 deferred

Ship (sanitized): NEW_PROJECT_PRIMER, testing-patterns, anti-patterns, failure-patterns, debugging-patterns, dx-patterns, security-learnings, workflow-patterns.

Defer to profile: architecture-patterns, architecture-lessons, integration-gotchas, performance-insights, mockup-contract.

Sanitization rule: strip all references to FastAPI, React, openapi.yaml, Zeabur, GUID TypeDecorator, fastapi-users, MSW, Alembic. Keep only the principle that survives a stack swap.

## 5. Memory subsystem

### 5.1 Scoring + Ebbinghaus loop

Direct port of `scripts/memory/score.sh` (already universal):

```
score.sh get <file>         reads strength, decays since last access
score.sh reinforce <file>   strength += boost, resets last_retrieved
score.sh decay <file>       strength *= exp(-days_since/half_life)
score.sh decay-all          batch decay (runs on /athena:save)
score.sh flag-weak          lists files with strength < 0.3
```

**Half-life defaults** (per-file rubric from `half-life-defaults.json`):

- Universal principles (NEW_PROJECT_PRIMER, anti-patterns): 365 days
- Stack-specific lessons: 90 days
- Promoted from incidents: 60 days
- User override via frontmatter `half_life_days: 180`

### 5.2 Inject pipeline (SessionStart)

```
1. install.sh check         idempotent first-run seed
2. inject using-athena.md   gateway, always (~50 lines)
3. match.sh                 reads project CLAUDE.md keywords, git status,
                            recent commits → returns top-N relevant Tier 0
4. inject matched files     only if relevance > threshold
                            default top-3, max 800 lines combined
5. score.sh reinforce       boost strength of injected files
6. audit emit               {event:"tier0_loaded", files:[...], context:"session_start"}
```

### 5.3 Cold-start protection

`install.sh` initializes `.meta/session-count` to `0`. SessionStart hook increments it. While `session-count < 3` AND total retrieval events across all seed files is `< 10`, `match.sh` runs in **breadth mode**: inject all 8 seed files (~600 lines once per session). Once either threshold is crossed, `match.sh` switches to **selective mode** (top-N relevance scoring). Gives the Ebbinghaus loop enough seed events to start reinforcing accurately instead of starting cold.

### 5.4 Promote / forget loop

- `/athena:promote` — curator agent extracts [GENERALIZABLE] lessons from `session-summary.md` + audit log, drafts a new lesson file, user approves, writes to `~/.claude/athena-memory/`.
- `/athena:forget` — runs `flag-weak`, lists files with strength < 0.3 AND retrieval_count < 5 over 30 days, user approves archival, atomic move to `.meta/archive/`.
- `/athena:learn --batch` — detects drift in MEMORY.md + suggests promotions when repeated patterns appear (e.g., "same test setup written 5 times this epic — promote?").

### 5.5 Cross-project compounding

The point of global Tier 0. Lesson learned on project-A appears on project-B via match.sh, gets reinforced, becomes durable knowledge across stacks.

## 6. Hooks

### 6.1 Two-root resolution

Every hook script resolves two roots:

```bash
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:?must be set by Claude Code}"
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

source "$PLUGIN_ROOT/scripts/lib/common.sh"
AUDIT_LOG="$PROJECT_ROOT/.claude/audit.jsonl"
CONTEXT_DIR="$PROJECT_ROOT/docs/context"
```

Plugin scripts come from `${CLAUDE_PLUGIN_ROOT}`. Project state writes go to the user's repo via `$PROJECT_ROOT`.

### 6.2 Hook registration (`hooks/hooks.json`)

Registers: SessionStart, UserPromptSubmit, PreToolUse (Bash), PostToolUse (Edit|Write, Bash), Stop, SubagentStop. Pattern matches current `.claude/settings.json` but with `${CLAUDE_PLUGIN_ROOT}` paths. Structure:

```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/session-start.sh",
        "timeout": 10
      }]
    }],
    "PreToolUse": [{
      "matcher": "Bash",
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/pre-bash-guard.sh"
      }]
    }],
    "Stop": [{
      "hooks": [{
        "type": "command",
        "command": "${CLAUDE_PLUGIN_ROOT}/scripts/hooks/stop-verifier.sh",
        "timeout": 15
      }]
    }]
    // ... UserPromptSubmit, PostToolUse, SubagentStop registered similarly
  }
}
```

## 7. Auto-trigger flow

Three layers, ordered by aggressiveness:

1. **SessionStart (always)** — inject `using-athena.md` gateway (~50 lines) + match.sh-selected Tier 0 lessons.
2. **Description-driven (mid-conversation)** — Claude Code matches user task against each skill's `description:` frontmatter. Well-written descriptions = automatic Skill invocation. Examples:
   - "add a new endpoint" → `Skill(spec-writer)` + `Skill(tdd-workflow)`
   - "this test is flaky" → `Skill(systematic-debugging)`
   - "i think we're done" → `Skill(verification-discipline)`
3. **Explicit (`/athena:*` commands)** — user-typed, always available.

The gateway skill teaches Claude what's available; description matching surfaces skills as needed; explicit commands provide the deterministic on-ramp.

## 8. Install + lifecycle

### 8.1 First install

```bash
claude code plugin install github.com/<github-username>/athena-core
```

Plugin manifest registers hooks, skills, command namespace. First SessionStart fires `install.sh`:

```bash
if [ ! -f ~/.claude/athena-memory/.installed ]; then
  cp -rn $PLUGIN_ROOT/seed-memory/* ~/.claude/athena-memory/
  $PLUGIN_ROOT/scripts/memory/score.sh init
  touch ~/.claude/athena-memory/.installed
fi
```

### 8.2 Per-project bootstrap

```
user: /athena:load --init
→ creates <project>/docs/context/{session-summary.md, agent-write-back/}
→ creates <project>/.claude/audit.jsonl (touch)
→ optionally writes <project>/.claude/athena.config.json
```

### 8.3 Plugin upgrade

`install.sh` detects `.installed` marker and SKIPS seed copy. Only the framework (scripts, hooks, commands, skills, agents) updates. User-accumulated Tier 0 stays untouched. New seed files (if shipped in upgrade) require explicit `/athena:promote --pull-seed`.

### 8.4 Uninstall

`claude code plugin uninstall athena-core` removes the plugin only. `~/.claude/athena-memory/` is preserved (user owns it). User can manually delete if desired. Per-project `docs/context/` and `.claude/audit.jsonl` stay too.

## 9. Distribution

**Phase 1: Git URL install only.**

```bash
claude code plugin install github.com/<github-username>/athena-core
```

`marketplace.json` ships from day 1 (cheap to maintain), but no marketplace submission until v1.0 stable. Marketplace submission becomes a future epic.

## 10. Testing strategy

```
athena-core/tests/
  fixtures/
    empty-project/        # bare git repo, nothing else
    nodejs-mini/          # package.json + 1 src file
    python-mini/          # pyproject.toml + 1 src file
  test-install.sh         # asserts seed copy works, marker created
  test-hooks.sh           # invokes hooks against fixtures, asserts behavior
  test-memory-loop.sh     # seed → reinforce → decay → flag-weak full cycle
  test-match-inject.sh    # match.sh picks expected files for given context
  test-commands.sh        # smoke-test each /athena:* command on each fixture
  run-all.sh              # runs all above; CI entry point
```

Target: <60s total runtime, ~20 tests, fixtures total <5MB.

## 11. Phase 1 deliverables

| Deliverable | Count / Detail |
|---|---|
| Commands (port + universalize) | 17 |
| Agents (port + universalize) | 11 |
| Skills (port + sanitize, plus 1 NEW gateway, 1 NEW reviewer-convergence) | 6 |
| Stop-verifier rules (port to discrete scripts) | 10 |
| Memory scripts (direct port) | score.sh, match.sh, inject.sh, half-life-resolve.sh, half-life-defaults.json |
| Hook scripts (port with two-root resolution) | 6 + hooks.json |
| Seed memory (port + sanitize) | 8 files |
| Install + manifest | install.sh, plugin.json, marketplace.json |
| Docs | README, INSTALL, MIGRATION, plugin CLAUDE.md |
| Tests | 3 fixtures, ~20 fixture-based tests, run-all.sh |

Sanitization editing budget: ~16-24 hours across the 8 seed files.

## 12. Open questions (resolve during implementation, not blockers)

- Exact threshold for `match.sh` relevance score (current default: top-3 + min score 0.4 — may need tuning per stack).
- Whether `/athena:cycle` ships in Phase 1 or waits for profile pack (depends on how stack-bound its current implementation is — needs implementation-time audit).
- Whether the universalized `@deployer` framework alone is useful without a profile pack's concrete gates (alternative: defer @deployer entirely to profile).

## 13. Out of scope (explicitly Phase 2 or later)

- `athena-saas-profile` plugin (the 6 deferred commands, 2 agents, 7 skills, 13 stop-rules, 5 seed files).
- Marketplace submission.
- Migration of this template repo to consume the plugin (this repo stays as the reference + Phase 2 profile source until cleanup epic).
- MCP server bundling.
- Cross-platform shell portability beyond bash (zsh/fish later).

## 14. Roadmap recap

**Phase 1 (this spec):** `athena-core` plugin, Git URL distribution, 3-fixture test harness.

**Phase 2 (future, not designed):** Extract `athena-saas-profile` plugin from this template's leftover assets. Phase 2 spec written separately. Phase 1 designs the extension points; Phase 2 fills them.
