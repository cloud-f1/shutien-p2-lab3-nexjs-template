# Agent Team — 9 Subagents

> 9 AI agents (8 real + 1 domain-expert template). See [Rationale](#rationale) below.

## Team Map

| Agent | Model | Trigger | Designated Doc | Role |
|---|---|---|---|---|
| `@spec-writer` | opus | `/athena:spec` | spec-log.md | Feature spec (Server Actions / Route Handlers + Zod) |
| `@reviewer` | sonnet | `/athena:qa --review-only` | review-log.md | Read-only code review + security audit |
| `@qa` | sonnet | `/athena:qa --test-only`, auto | test-status.md | Test execution + 80% coverage gate |
| `@best-practice` | opus | Architecture questions | decisions.md + TECHSTACK.md | Deep architecture advice |
| `@debugger` | sonnet | Auto on errors | debug-log.md | Root cause analysis |
| `@deployer` | sonnet | `/athena:deploy` | deploy-log.md | Multi-gate Zeabur / Cloud Run deploy |
| `@memory-curator` | opus | `/athena:promote` | template-memory/ | Cross-project wisdom |
| `@strategist` | opus | `/athena:plan` | strategy-log.md | Strategic planning, epic proposals |
| `@orchestrator` | sonnet | `/athena:batch` | epic-progress.md | Parallel epic coordination, dependency waves |

## Agent Details

### @spec-writer
- Reads spec-log before starting — knows what's already specced
- Spawns parallel research (codebase scan + @best-practice)
- Defines the API surface (Server Actions / Route Handlers + shared Zod schemas)
  and any Drizzle schema change -> create spec doc
- Write-back: feature name, actions/routes added, RED tests pending

### @qa (merged from @code-reviewer + @test-runner)
- **Phase 1 — Review:** git diff, RED/YELLOW/GREEN security checks
- **Phase 2 — Test:** pnpm typecheck -> pnpm lint -> vitest >= 80% -> playwright e2e
- Same issue twice -> becomes a lint rule or test
- Never lowers thresholds, never comments out tests

### @best-practice
- Uses opus for deep reasoning on trade-offs
- Every decision documented with evidence, alternatives, risk
- Reads decisions history — never repeats a decision already made

### @debugger
- Reads debug-log — detects if this is a known pattern
- Hypothesis -> evidence -> fix -> verify loop
- Tags lessons `[GENERALIZABLE]` for template promotion
- 3 failed attempts -> escalate

### @deployer
- Reads deploy-log for previous migration version and production state
- All gates must pass (typecheck, lint, vitest, e2e, git clean, branch) — exit 2 on any failure
- Monitors pipeline, provides rollback target

### @memory-curator
- Reads all docs/context/ files
- Extracts `[GENERALIZABLE]` items
- Writes to `~/.claude/template-memory/`
- Regenerates `NEW_PROJECT_PRIMER.md` for all future projects

## Collaboration Patterns

### Standard Feature Cycle
```
/athena:spec -> @spec-writer -> spec-log updated
/athena:implement -> TDD loop -> code written
@qa auto -> review-log + test-status updated
@debugger if needed -> debug-log updated
/athena:deploy -> @deployer -> deploy-log updated
/athena:save -> ALL -> session-summary -> git commit
```

### Mid-Session Checkpoint
```
"@qa update your document"
-> review-log.md + test-status.md written
-> Another team member can /athena:load immediately
```

## Rationale

### Why 6 agents instead of 8?

**Merged: @code-reviewer + @test-runner -> @qa**
- Both triggered after code changes with overlapping concerns (coverage checks, test existence)
- A single agent with two phases (review -> test) eliminates the duplicate coverage gate
- Reduces context overhead — one agent reads both logs instead of two agents reading their own
- Model: sonnet is sufficient for both review and test orchestration

**Shelved: @devops-monitor**
- Checks production health (API, DB, migration drift, response time)
- No production deployment exists yet — the agent has nothing to monitor
- Will be reinstated when Track 1 deploys to Zeabur
- Its designated doc (`health-log.md`) is preserved for future use

**Kept unchanged:** @spec-writer, @best-practice, @debugger, @deployer, @memory-curator — each has a unique, non-overlapping role that justifies its existence.
