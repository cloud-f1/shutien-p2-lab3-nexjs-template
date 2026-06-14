# AI Agent Team Guide

The @saas template ships with a 12-agent Claude Code team for automated development.

## Agent Roster

| Agent | Command | Role |
|-------|---------|------|
| `@spec-writer` | `/athena:spec` | Feature spec, OpenAPI-first design |
| `@reviewer` | `/athena:qa --review-only` | Code review + security audit |
| `@qa` | `/athena:qa --test-only` | Test execution + 80% coverage gate |
| `@evaluator` | `/athena:qa --eval-only` | Independent acceptance evaluation |
| `@best-practice` | — | Architecture + trade-off decisions |
| `@debugger` | — | Errors, failing tests (auto-delegated) |
| `@deployer` | `/athena:deploy` | 7-gate deploy protocol |
| `@memory-curator` | `/athena:promote` | Extract wisdom → Tier 0 |
| `@strategist` | `/athena:plan` | Audit, research, propose epics |
| `@orchestrator` | `/athena:batch` | Parallel epic coordination |
| `@designer` | `/athena:design` | Design tokens → React page |
| `@dba` | `/athena:dba` | Migration review, schema design |

## Invocation

```bash
# Full pipeline (one step at a time)
/athena:loop

# Full pipeline (auto-advance)
/athena:loop auto

# Parallel epics (max 4 concurrent)
/athena:batch auto

# Confidence-gated autopilot
/athena:autopilot
```

## When to Use Each Agent

**Building a new feature:**
```bash
/athena:spec "feature description"
/athena:implement
/athena:qa
/athena:pr
```

**Diagnosing a bug:**
```
@debugger — describe the error, share logs
```

**Reviewing for production:**
```bash
/athena:qa --review-only   # security + code quality
/athena:deploy staging     # 7-gate pre-deploy check
```

**Optimizing DB:**
```bash
/athena:dba inspect-migrations
/athena:dba lint
```

## Effort Tiers

Pass `--effort <tier>` to scale depth vs. cost:

| Tier | Use Case |
|------|---------|
| `quick` | Rapid iteration, draft specs |
| `standard` | Normal development (default) |
| `thorough` | Pre-merge quality gate |
| `ultra` | Security audit, critical-path review |

```bash
/athena:qa --effort ultra   # maximum review depth
/athena:spec --effort quick "small tweak"
```
