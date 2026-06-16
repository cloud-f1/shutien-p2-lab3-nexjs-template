# AI Dev Pipeline

> Consolidated into this single file (2026-03-07). Previously split across `docs/pipeline/` (7 files) which duplicated content from `.claude/agents/` and `.claude/commands/`. One source of truth is better than two.

## Pipeline Overview

```
SPEC             CODE             VALIDATE+TEST       DEPLOY
  |                |                    |                |
  v                v                    v                v
/athena:spec   /athena:implement    /athena:qa       /athena:deploy
@spec-writer   main Claude         @qa              @deployer
  |                |                    |                |
  v                v                    v                v
spec-log       PostToolUse         review-log +     deploy-log
               lint hook           test-status
```

## Architecture Layers

| Layer | Purpose | When it fires |
|---|---|---|
| `TECHSTACK.md` | Upload-once context restore | Any new session |
| `CLAUDE.md` | Session identity, core rules | Every session, always loaded |
| `docs/context/` | Agent write-backs | On Stop, on /athena:save |
| Skills | Domain knowledge per agent | Auto-matched by description |
| Slash Commands | User-triggered workflows | Explicit `/athena:<command>` |
| Hooks | Deterministic enforcement | Automatic on lifecycle events |
| Subagents | Specialized isolated work | Auto-delegated or `@agent` |

## 5 Dev Phases

### Phase 1 — SPEC
```
/athena:spec "add task comments"
  -> @spec-writer (opus) with parallel research
  -> Defines the API surface: Server Actions / Route Handlers + shared Zod
     schemas (lib/validations/*); plans any Drizzle schema change
  -> Creates docs/specs/FEATURE.md with RED test list
```

### Phase 2 — IMPLEMENT (TDD)
```
/athena:implement task-comments
  -> RED: write failing tests -> GREEN: minimum code -> REFACTOR
  -> PostToolUse hook: auto-lint on every file write
  -> Auto: @qa invoked (review + test)
```

### Phase 3 — QUALITY GATE
```
/athena:qa (auto or --review-only / --test-only)
  -> Phase 1: RED security -> YELLOW architecture -> GREEN quality
  -> Phase 2: pnpm typecheck -> pnpm lint -> pnpm test:coverage >= 80% -> pnpm test:e2e
  -> On failure: @debugger auto-invoked
```

### Phase 4 — DEPLOY
```
/athena:deploy production
  -> @deployer: gates (typecheck, lint, vitest >= 80%, e2e, git clean, branch)
  -> ALL pass: git push -> Zeabur (or GCP Cloud Run)
  -> Health check: curl /api/health -> 200
```

### Phase 5 — CHECKPOINT
```
/athena:save
  -> All agents write to docs/context/
  -> session-summary.md updated
  -> git commit for session resume
```

## Slash Commands (athena namespace)

| Command | Agent | Purpose |
|---|---|---|
| `/athena:spec <feature>` | @spec-writer | Design the feature spec (Server Actions / Route Handlers + Zod) |
| `/athena:implement` | main Claude | TDD: RED -> GREEN -> REFACTOR |
| `/athena:qa` | @qa | Code review + test suite + 80% gate |
| `/athena:pr` | — | Pre-PR pipeline (merge, build, test, lint, create PR) |
| `/athena:deploy [env]` | @deployer | Multi-gate Zeabur / Cloud Run deploy |
| `/athena:load` | — | Read all context docs, restore state |
| `/athena:save` | all agents | Checkpoint all write-backs |
| `/athena:promote` | @memory-curator | Extract wisdom -> template tier |

## Hook System

| Event | Can Block? | Action |
|---|---|---|
| `SessionStart` | No | Inject session-summary + template primer |
| `UserPromptSubmit` | No | Detect "update your document" -> inject write-back targets |
| `PreToolUse (Bash)` | Yes | Block destructive commands |
| `PostToolUse (Write/Edit)` | No | Auto lint/format every edited file |
| `PostToolUse (Bash)` | No | Log all commands to audit trail |
| `Stop` | No | Desktop notification |
| `SubagentStop` | No | Stamp agent doc + update session activity |

## Document Memory Protocol

### The Universal Command
```
"Update your document"
```
Say this to any agent. It writes current state to its designated doc in `docs/context/`.

### Agent -> Document Map

| Agent | Write-back Target |
|---|---|
| All agents | `docs/context/session-summary.md` |
| `@spec-writer` | `docs/context/spec-log.md` |
| `@qa` | `docs/context/review-log.md` + `docs/context/test-status.md` |
| `@best-practice` | `docs/context/decisions.md` + `TECHSTACK.md` |
| `@debugger` | `docs/context/debug-log.md` |
| `@deployer` | `docs/context/deploy-log.md` |
| `@memory-curator` | `~/.claude/template-memory/*.md` |

### Three Ways to Resume

**A — Claude Code (automatic):** SessionStart hook loads `session-summary.md` + template primer.

**B — Upload TECHSTACK.md:** Attach to any Claude session. Full context in one file.

**C — Targeted load:** `"Load docs/context/test-status.md — continue where @qa left off"`

## Decision Framework

```
New task arrives
  +-- "design / spec / plan"        -> /athena:spec -> @spec-writer
  +-- "implement / build / code"    -> /athena:implement -> TDD cycle
  +-- "review / audit / test"       -> /athena:qa -> @qa
  +-- "fix / debug / error"         -> @debugger (auto)
  +-- "deploy / release"            -> /athena:deploy -> @deployer
  +-- "architecture / pattern"      -> @best-practice
  +-- "update your document"        -> agent writes back
  +-- /athena:save (end of session) -> ALL agents write back
  +-- new session / context lost    -> upload TECHSTACK.md
```

## Rationale: Why This Structure?

**Single file instead of 7:** The previous `docs/pipeline/` directory (README, agents, commands, hooks, skills, phases, memory-protocol) duplicated information already defined in `.claude/agents/*.md` and `.claude/commands/*.md`. Two sources of truth means two things to update and two things that drift apart. This file provides a human-readable overview; the authoritative definitions live in `.claude/`.

**5 phases instead of 6:** Merged VALIDATE + TEST into a single QUALITY GATE phase, matching the @qa agent merger. Monitor phase removed — no production to monitor yet.

**Athena namespace:** All commands live under `/athena:*` to distinguish project-specific workflow commands from external plugins and built-in CLI commands.
