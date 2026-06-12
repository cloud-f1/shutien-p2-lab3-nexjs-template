# E141 — Athena Audit Command

> Phase 33 — Developer Tooling | Size: M (5 SP) | Deps: none

## Problem

No automated way to check three-source consistency: OpenAPI spec vs server routes vs client API calls. Drift between these surfaces causes runtime errors that tests may not catch.

## Solution

Create `/athena:audit` slash command that extracts endpoints from all three sources, cross-references them, and reports gaps + schema drift as a structured markdown table.

## Key Files

| File | Action |
|------|--------|
| `.claude/commands/athena/audit.md` | New — slash command definition |

## Acceptance Criteria

1. `/athena:audit` is a valid slash command (markdown with frontmatter)
2. Instructs the agent to extract endpoints from OpenAPI, server routes, and client API calls
3. Produces a gap report table (endpoint × source matrix)
4. Checks for schema drift (OpenAPI response schemas vs Pydantic models)
5. Outputs summary with counts of aligned, missing, and drifted endpoints
