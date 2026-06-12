---
description: "(memory) Promote [GENERALIZABLE] lessons → Tier 0 (~/.claude/template-memory/) → regenerate NEW_PROJECT_PRIMER.md."
             ~/.claude/template-memory/. Invokes @memory-curator.
             Regenerates NEW_PROJECT_PRIMER.md for all future projects.
allowed-tools: Read, Write, Bash
---

## Default flow (no flags)

1. Ensure docs/context/ is current (run /athena:save first if not)
2. Invoke @memory-curator: read all docs/context/ files, extract [GENERALIZABLE],
   write to ~/.claude/template-memory/, regenerate NEW_PROJECT_PRIMER.md
3. Run `scripts/memory/backfill-half-life.sh` to ensure every Tier 0 file
   has `half_life_days:` frontmatter (idempotent — no-op if all present;
   E185).
4. Report: what was promoted, what was skipped, total wisdom entries
5. Rotate watermark (see Watermark section below)

## Flags

- `--dry-run`
  List pending `[GENERALIZABLE]` entries from the three watched logs
  (`docs/context/debug-log.md`, `qa-patterns.md`, `review-findings.md`) as
  `file:line: first 80 chars`. **No writes** to `~/.claude/template-memory/`
  and **no watermark rotation**. Read-only — safe to run any time.

  Implementation hint:
  ```bash
  grep -Hn '\[GENERALIZABLE\]' \
    docs/context/debug-log.md \
    docs/context/qa-patterns.md \
    docs/context/review-findings.md 2>/dev/null \
    | cut -c1-120
  ```

- `--apply <proposal-file>`
  Consume a proposal previously emitted by the
  `scripts/hooks/auto-promote-check.sh` PostToolUse hook (file lives in
  `docs/context/promotion-proposals/<YYYYMMDD-HHMMSS>.md`).

  Steps:
  1. Read the proposal file — it contains a `## Pending lessons` block of
     `file:line:` entries.
  2. Delegate to `@memory-curator`, pointing it at the proposal (not the raw
     logs). The curator promotes qualifying entries into
     `~/.claude/template-memory/` and regenerates `NEW_PROJECT_PRIMER.md`.
  3. On success, rotate the watermark (see below).
  4. Report the promoted / skipped / total counts **and** reference the
     consumed proposal file.

## Watermark

`docs/context/.last-promote-ts` is an epoch seconds value. The hook reads it
to decide which `[GENERALIZABLE]` lines are "new" (via
`git log --since="@$ts"`).

On **successful non-dry-run** promotion (default flow or `--apply`), rotate
the watermark so the same batch will not be proposed again:

```bash
date +%s > docs/context/.last-promote-ts
git add docs/context/.last-promote-ts
```

`--dry-run` must **not** touch this file.

## Relationship to the PostToolUse hook

The `scripts/hooks/auto-promote-check.sh` hook only **proposes** — it drafts
`docs/context/promotion-proposals/<ts>.md` when >=3 new `[GENERALIZABLE]` tags
have landed since the watermark. It never writes to Tier 0. This command
(particularly `--apply`) is the only path that actually promotes.
