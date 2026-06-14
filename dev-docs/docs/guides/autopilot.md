# Autopilot Mode

Autopilot mode (`/athena:autopilot`) runs the full `spec → implement → qa → commit → merge` pipeline automatically, gated by confidence scores.

## How It Works

1. At each step, the orchestrator evaluates a **confidence score** (0.0–1.0)
2. If confidence ≥ threshold, it auto-advances to the next step
3. If confidence < threshold, it pauses and asks for human input

## Thresholds by Effort Tier

| Tier | Threshold | Behavior |
|------|-----------|---------|
| `quick` | 0.80 | Aggressive auto-advance |
| `standard` | **0.85** | Balanced (default) |
| `thorough` | 0.90 | Conservative |
| `ultra` | 0.95 | Near-manual (pauses often) |

## Invocation

```bash
# Standard autopilot (threshold 0.85)
/athena:autopilot

# With explicit effort tier
/athena:autopilot --effort thorough

# Batch autopilot (multiple epics, max 4 parallel)
/athena:batch auto
```

## Cron-Driven Pattern

```bash
# Run every 5 minutes — works unattended
/loop 5m /athena:batch auto
```

## What Pauses Autopilot

- Confidence < threshold at any pipeline step
- QA gate failure (tests failing or coverage < 80%)
- Security finding from `@reviewer`
- `@evaluator` acceptance score < 0.7
- Breaking changes detected in schema or API contract

When paused, autopilot outputs a clear message and waits for `y/n` or a corrective instruction before continuing.
