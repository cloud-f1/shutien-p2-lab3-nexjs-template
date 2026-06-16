# AI Agent Team Guide

> How to use the AI agent team for development — serial and parallel modes.

---

## Quick Start

```bash
# Load project context
/athena:load

# Check current state
/athena:loop status

# Advance one epic step
/athena:loop

# Parallel execution for an entire phase
/athena:batch --phase 25 --dry-run    # preview first
/athena:batch --phase 25              # execute
```

---

## Agent Team Overview

| Agent | Command | Role |
|-------|---------|------|
| `@spec-writer` | `/athena:spec` | Spec-first feature design (shared Zod schema + spec) |
| `@qa` | `/athena:qa` | Code review + test execution + 80% coverage gate |
| `@best-practice` | auto-consulted | Architecture decisions, tech choices |
| `@debugger` | auto-delegated | Error diagnosis, root cause analysis |
| `@deployer` | `/athena:deploy` | 6-gate deployment protocol |
| `@memory-curator` | `/athena:promote` | Cross-project knowledge extraction |
| `@strategist` | `/athena:plan` | Strategy analysis, epic proposals (human gate) |

---

## Development Modes

### Mode 1: Serial (`/athena:loop`)

Best for: complex features, epics needing careful review.

```bash
# Manual (one step per invocation)
/athena:loop

# Auto-pilot (with /loop scheduler)
/loop 2m /athena:loop auto

# Check state
/athena:loop status
```

**Pipeline**: spec → implement → qa → commit → merge (one step per call)

### Mode 2: Parallel (`/athena:batch`)

Best for: multiple independent epics, high throughput needed.

```bash
# Parallel auto-pilot (recommended) — auto-detect phase, one wave per call
/athena:batch auto
/loop 2m /athena:batch auto      # auto-advance one wave every 2 min

# Manual phase execution
/athena:batch --phase 25 --dry-run   # preview
/athena:batch --phase 25             # execute all waves

# Specific epic list
/athena:batch E82,E83,E84

# Advanced options
/athena:batch auto --tier B          # only Tier B epics
/athena:batch --phase 25 --step implement  # specific step only
/athena:batch --retry-failed         # retry failed epics
```

**How it works**:
1. Calls `scripts/epic-graph.sh` to parse dependency graph
2. Computes execution waves (topological sort)
3. Dispatches up to 4 worktree agents per wave (isolated, no conflicts)
4. Syncs main between waves, checks for conflicts
5. Final summary report

---

## Dependency Graph Tool

```bash
# Show Phase 25 execution waves
./scripts/epic-graph.sh --phase 25

# Pending epics only
./scripts/epic-graph.sh --phase 25 --pending-only

# With tier classification
./scripts/epic-graph.sh --phase 25 --classify

# JSON format (for programmatic use)
./scripts/epic-graph.sh --phase 25 --json

# All phases statistics
./scripts/epic-graph.sh --status
```

**Tier Classification**:
| Tier | Criteria | Best Mode |
|------|----------|-----------|
| Tier A | < 3 files | Script or batch |
| Tier B | 3-10 files | Parallel batch |
| Tier C | 10+ files | Full loop |

---

## Observability

### Webhook Notifications

The hook auto-detects the target from the URL host and formats the payload natively for Slack, Telegram, Discord, or a generic JSON receiver (n8n / Zapier / custom server).

```bash
# Slack incoming webhook
export AI_CODING_WEBHOOK_URL="https://hooks.slack.com/services/..."

# Telegram bot (also set TELEGRAM_CHAT_ID)
export AI_CODING_WEBHOOK_URL="https://api.telegram.org/bot<TOKEN>/sendMessage"
export TELEGRAM_CHAT_ID="<chat-id>"

# Discord webhook
export AI_CODING_WEBHOOK_URL="https://discord.com/api/webhooks/..."

# Generic JSON receiver (anything else — flat JSON payload)
export AI_CODING_WEBHOOK_URL="https://your.server/hook"
```

Control volume with `NOTIFY_LEVEL` — default is `boundaries` (only fires on epic boundaries: merge, deploy, start, failed, blocked, needs_human, merged):

```bash
export NOTIFY_LEVEL="silent"      # never fire
export NOTIFY_LEVEL="boundaries"  # default — "I need to look now" moments only
export NOTIFY_LEVEL="verbose"     # every TaskCompleted event
```

### JSONL Audit Log

All Bash commands logged to `.claude/audit.jsonl`:
```bash
jq 'select(.exit != 0)' .claude/audit.jsonl          # failed commands
jq 'select(.epic == "E84")' .claude/audit.jsonl       # filter by epic
jq 'select(.duration_ms > 10000)' .claude/audit.jsonl # slow commands
```

### Stop Verifier

Auto-checks on every Claude stop for this Next.js stack: no `console.log` residue in committed code, no inline `style=` color overrides (use Tailwind + `dark:` variants), no hand-authored files in `components/ui/` (add via `npx shadcn@latest add`), verification discipline (a `verification_check` audit event must exist before `feat:`/`fix:`/`refactor:` commits), and a large-file warning.

---

## Command Reference

| Command | Purpose |
|---------|---------|
| `/athena:load` | Load project context |
| `/athena:loop` | Advance one epic step |
| `/athena:batch` | Parallel epic execution |
| `/athena:spec` | Design feature spec |
| `/athena:implement` | TDD implementation |
| `/athena:qa` | Code review + tests |
| `/athena:ship` | Quick publish flow |
| `/athena:pr` | Full PR pipeline |
| `/athena:deploy` | 6-gate deployment |
| `/athena:plan` | Strategic planning |
| `/athena:cycle` | Full DevOps cycle |
| `/athena:save` | Checkpoint all agents |
| `/athena:learn` | Memory refresh |
| `/athena:promote` | Extract cross-project knowledge |
| `/athena:domain` | Scaffold domain module |
| `/athena:dba` | Database administration |

---

## Next Steps

- **[Building Domain Expert Agents](custom-agents.md)** — Create custom AI agents tailored to your business domain
- **[First Epic Walkthrough](first-epic-walkthrough.md)** — Hands-on guide to building a complete domain from scratch
- **[Learning Path](learning-path.md)** — See the full recommended reading order for all guides
