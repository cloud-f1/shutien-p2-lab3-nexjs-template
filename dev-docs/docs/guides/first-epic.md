# First Epic Walkthrough

This guide walks through the full epic pipeline — from idea to merged code — using the @saas template's AI agent team.

## The Pipeline

```
/athena:spec → /athena:implement → /athena:qa → commit → /athena:pr
```

## Step 1: Write a Spec

```bash
/athena:spec "notifications module — in-app bell icon, mark-as-read, persist to DB"
```

The `@spec-writer` agent:
1. Adds an epic entry to `docs/epics/EPIC_INDEX.md`
2. Creates `docs/epics/eNNN-notifications.md` with detailed spec
3. Designs the Drizzle schema and Server Actions

## Step 2: Implement

```bash
/athena:implement
```

The orchestrator runs TDD:
1. Writes failing tests first (red)
2. Implements the feature (green)
3. Refactors for quality (refactor)

## Step 3: QA

```bash
/athena:qa
```

Three agents run in parallel:
- `@reviewer` — code review + security audit
- `@qa` — test execution + 80% coverage gate
- `@evaluator` — independent acceptance evaluation

## Step 4: Commit and PR

```bash
/athena:pr
```

Runs pre-merge checks → creates the PR with a structured description.

## Autopilot (optional)

For hands-off execution:

```bash
/athena:autopilot
```

Advances the pipeline automatically when confidence ≥ 0.85. Pauses and asks for input on low-confidence steps.

## Effort Tiers

```bash
/athena:spec --effort thorough "complex feature"    # deeper analysis
/athena:qa --effort ultra "critical path"           # maximum review depth
```

See the [Effort Tiers](/docs/guides/ai-agent-team#effort-tiers) reference for details.
