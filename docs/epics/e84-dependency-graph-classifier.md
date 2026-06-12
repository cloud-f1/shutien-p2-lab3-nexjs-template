# E84 — Epic Dependency Graph & Tier Classifier

> **Phase 25** | Priority: P0 | Points: 8 | Size: M
> **Depends on**: none

---

## Problem Statement

Parallel epic execution (E85) requires knowing which epics can run simultaneously. Currently, dependency rules are embedded as markdown text in `epic-progress.md` — not machine-parseable. There's no automated way to compute execution waves or classify epics by complexity tier.

## Stories

### S1: Dependency Graph Parser

**AC:**
- [ ] Create `scripts/epic-graph.sh` that parses `docs/context/epic-progress.md` dependency rules
- [ ] Extract all `E{n}: deps` entries from the Dependency Rules section
- [ ] Build adjacency list representation of the DAG
- [ ] Validate: detect cycles (error if found)
- [ ] Output formats: `--json` (machine), `--text` (human-readable)
- [ ] JSON output: `{"nodes": [...], "edges": [...], "waves": [...]}`

### S2: Topological Sort → Execution Waves

**AC:**
- [ ] Compute topological sort of the dependency graph
- [ ] Partition into execution waves (groups of independent epics)
- [ ] Respect `--phase N` filter to scope to a single phase
- [ ] Output wave plan: `Wave 1: [E82, E83, E84], Wave 2: [E85, E86]`
- [ ] Handle `--pending-only` flag to exclude completed epics

### S3: Tier Classifier

**AC:**
- [ ] Classify epics into tiers based on spec analysis:
  - **Tier A (scriptable)**: template/config changes, < 3 files
  - **Tier B (agent batch)**: CRUD, add fields, wire endpoints, 3-10 files
  - **Tier C (full loop)**: complex features, new patterns, security, 10+ files
- [ ] Read epic spec files (`docs/epics/e{n}-*.md`) for classification signals
- [ ] Output: `--classify` flag adds tier to each epic in the wave plan
- [ ] Default tier for epics without spec: Tier C (conservative)

### S4: Integration with Epic Progress

**AC:**
- [ ] Read current step status from `epic-progress.md` to skip completed epics
- [ ] `--status` flag shows: total/pending/completed counts per phase
- [ ] Compatible with the format `/athena:batch` will consume (E85)

## Risk Notes

- Low risk — standalone script, no existing code modification
- Shell script for simplicity (bash + jq); no Python dependency
- Critical path: E85 and E86 both depend on this

## Files to Touch

```
scripts/epic-graph.sh              — new: graph parser + wave planner + classifier
scripts/hooks/CLAUDE.md            — document new script
docs/context/epic-progress.md      — read-only (parser input)
```
