# docs/context/ — Agent Write-Back Memory

This folder is the **Tier 1 project memory**. Each file is owned by one agent.

## Ownership

| File | Owner Agent | Written When |
|---|---|---|
| `review-log.md` | @qa | After every review (legacy — see review-findings.md) |
| `review-findings.md` | @reviewer | After every code review |
| `test-status.md` | @qa | After every test run |
| `decisions.md` | @best-practice | After architecture decisions |
| `spec-log.md` | @spec-writer | After spec creation |
| `debug-log.md` | @debugger | After debug sessions |
| `deploy-log.md` | @deployer | After deployments |
| `epic-progress.md` | /athena:loop command | After each epic step completes |
| `strategy-log.md` | @strategist | After every `/athena:plan` run |
| `health-log.md` | (reserved) | For future @devops-monitor |
| `qa-patterns.md` | @qa + @spec-writer | After each review (@qa appends), before each spec (@spec-writer reads) |
| `orchestration-log.md` | /athena:batch command | After each batch execution |
| `session-summary.md` | /athena:save command | End of session |
| `evaluation-log.md` | @evaluator | After every independent acceptance evaluation (append-only) — *removed as empty scaffold in E205; recreated on first write* |

## Context Budget (1M context era)

With Opus 4.6 defaulting to 1M context, the previous aggressive truncation
strategy is no longer necessary. SessionStart hook now loads ~200-400 lines
of project state automatically (full session-summary + epic-progress + recent
git activity). Agents batch-read their required context files in parallel on
startup instead of reading one-by-one across multiple rounds.

Budget guideline: session-start injection < 500 lines (< 0.05% of 1M).

## Rules

- **Never delete** these files — they are append-oriented logs
- **Never edit another agent's file** — each agent owns its document exclusively
- Use the universal write-back format: timestamp header, then structured content
- `session-summary.md` is the **session resume point** — SessionStart hook reads it
- `/athena:save` triggers all agents to checkpoint simultaneously
- `/athena:promote` extracts `[GENERALIZABLE]` entries → Tier 0 global memory

## `[GENERALIZABLE]` auto-trigger flow (E158)

Closed-loop producer → proposer → consumer pipeline:

1. **Producer (agents tag).** When an agent fixes a bug / codifies a pattern
   that applies beyond this project, it appends a line containing
   `[GENERALIZABLE]` to its owned log. The three watched files are
   `debug-log.md` (@debugger), `qa-patterns.md` (@qa), and
   `review-findings.md` (@reviewer).

2. **Proposer (hook drafts).** The PostToolUse hook
   `scripts/hooks/auto-promote-check.sh` runs after every Edit / Write. When
   the touched file is one of the three watched logs, it counts
   `[GENERALIZABLE]` lines added via
   `git log --since="@$(cat docs/context/.last-promote-ts)"` on those files.
   If count >= 3, it drops a proposal in
   `docs/context/promotion-proposals/<YYYYMMDD-HHMMSS>.md` and emits an
   `auto_promote_proposed` event to `.claude/audit.jsonl`. The hook **never**
   writes to Tier 0.

3. **Consumer (human applies).** The user runs
   `/athena:promote --dry-run` to inspect the queue, then
   `/athena:promote --apply docs/context/promotion-proposals/<ts>.md` to
   commit the batch. On success, the command rotates the watermark
   (`docs/context/.last-promote-ts`) so the same tags are not re-proposed.

## Auto-compact policy (E160)

The `Stop` hook runs `scripts/archive-context.sh --auto` on every session
end. Append-only logs that exceed their per-file H2 entry limit get their
oldest sections moved to `docs/context/archive/<YYYY-MM>.md`, keeping the
live file lean enough that `SessionStart` injection never overflows.

| File | MAX_ACTIVE_ENTRIES | Rationale |
|------|--------------------|-----------|
| `debug-log.md` | 20 | Recent bugs only; old ones are in git |
| `review-findings.md` | 15 | QA cares about the current review round |
| `deploy-log.md` | 30 | Longer — deploy history is useful |
| `orchestration-log.md` | 50 | Wave tracking needs context |
| `evaluation-log.md` | 20 | *(recreated on first @evaluator write)* |
| `health-log.md` | 50 | |
| `session-summary.md` | 5 | Sessions — only the latest few matter |
| `qa-patterns.md` | **never archived** | Curated patterns are load-bearing |

**Archival is paired with promotion.** Before the script archives a section,
it scans the soon-to-archive H2 blocks for `[GENERALIZABLE]` lines and
writes them to `docs/context/promotion-proposals/archive-<ts>.md` — the
**same directory and format used by E158**. So a tagged lesson is never
silently lost: it is queued for `/athena:promote` review first, then the raw
section is archived (still searchable via `git grep docs/context/archive/`).

Manual triggers:

```bash
scripts/archive-context.sh --check   # dry-run, exits 1 if any over limit
scripts/archive-context.sh --auto    # silent (Stop hook uses this)
scripts/archive-context.sh           # interactive — prints what was archived
```

`/athena:save` runs `--check` after writing checkpoints and prints a friendly
nudge if anything is over limit.

The `auto_compact` audit event lands in `.claude/audit.jsonl`:

```json
{"ts":"2026-04-24T12:00:00Z","event":"auto_compact","file":"debug-log.md","archived_entries":5,"limit":20}
```

## Memory retrieval log (E180 — Phase 45 foundation)

Tier 0 memory **retrieval** is logged into the same `.claude/audit.jsonl` via
three event types: `tier0_loaded`, `rule_fired`, and `agent_cited`. See
`scripts/hooks/CLAUDE.md` § "Memory Retrieval Events (E180)" for the schema +
queries.

The retrieval log is the **foundation for all downstream Phase 45 mechanisms**
(E181 strength scoring, E182 selective injection, E183 promotion follow-through,
E184 forget, E186 metrics). Tier 1 (this folder, `docs/context/`) lives in git
history — only Tier 0 retrieval is logged here.
