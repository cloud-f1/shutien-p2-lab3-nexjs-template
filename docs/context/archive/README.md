# Archived Context Logs

This directory holds older H2 sections trimmed out of the live `docs/context/*.md`
logs by `scripts/archive-context.sh` (epic **E160**). Files are organised by
month: `<YYYY-MM>.md`. Each archived block carries a generated HTML comment
header (`<!-- archived from <file> at <iso-ts> -->`) so you can always trace
a section back to its source log.

## How a section lands here

The `Stop` hook fires `scripts/archive-context.sh --auto` on every session
end. The script:

1. Walks the seven append-only logs in `docs/context/`:
   `debug-log.md`, `review-findings.md`, `deploy-log.md`,
   `orchestration-log.md`, `evaluation-log.md`, `health-log.md`,
   `session-summary.md`. (`qa-patterns.md` is intentionally excluded —
   curated patterns are load-bearing.)
2. For any file whose `## ` H2 count exceeds the per-file limit (see
   `docs/context/CLAUDE.md` "Auto-compact policy"), it first **extracts every
   `[GENERALIZABLE]` line from the soon-to-archive sections** into a
   promotion proposal at
   `docs/context/promotion-proposals/archive-<ts>.md` (shared format with the
   E158 PostToolUse hook).
3. Then archives the oldest H2 sections to `<YYYY-MM>.md` and rewrites the
   live file with only the newest N entries.
4. Emits an `auto_compact` event to `.claude/audit.jsonl`.

So **promotion always runs before archival**. A `[GENERALIZABLE]` lesson is
never silently lost — it gets queued for `/athena:promote` review first.

## Searching archived logs

Archived content stays plaintext markdown. Search works as expected:

```bash
git grep "pattern" docs/context/archive/
git grep "pattern" docs/context/        # also covers archive/ via recursion
```

Because the archive is committed alongside the live logs, both `git log` and
`git blame` retain full provenance.

## Manual triggers

```bash
scripts/archive-context.sh --check   # dry-run, exits 1 if any file over limit
scripts/archive-context.sh --auto    # silent (Stop hook uses this)
scripts/archive-context.sh           # interactive — prints what was archived
```

`/athena:save` runs `--check` after writing checkpoints and prints a friendly
nudge if anything is over limit.
