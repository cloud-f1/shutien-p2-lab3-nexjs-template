# Promotion Proposals

Auto-generated drafts produced by the `scripts/hooks/auto-promote-check.sh`
PostToolUse hook (epic **E158**). Each file represents a queued batch of
`[GENERALIZABLE]` lessons waiting for human-approved promotion to Tier 0
(`~/.claude/template-memory/`).

## How a proposal lands here

1. An agent (typically `@debugger`, sometimes `@reviewer` or `@qa`) appends a
   line containing `[GENERALIZABLE]` to one of the watched context logs:
   - `docs/context/debug-log.md`
   - `docs/context/qa-patterns.md`
   - `docs/context/review-findings.md`
2. The PostToolUse hook runs after every Edit / Write. When the file touched
   is one of the three above, it counts new `[GENERALIZABLE]` lines added since
   `docs/context/.last-promote-ts` (the watermark).
3. Once the count reaches **3 or more**, the hook drops a proposal
   `<YYYYMMDD-HHMMSS>.md` in this directory and emits an
   `auto_promote_proposed` event to `.claude/audit.jsonl`.

The hook **never** writes to Tier 0. It only drafts the proposal.

## Reviewing a proposal

Open the newest file in this directory. It lists every pending tagged line
with `file:line: text` so you can decide whether the batch is worth promoting.

### Dry-run (no side effects)

```
/athena:promote --dry-run
```

Lists pending entries and exits. Does not touch Tier 0 and does not rotate
the watermark. Safe to run any time.

### Apply (promotes and rotates watermark)

```
/athena:promote --apply docs/context/promotion-proposals/<ts>.md
```

Delegates to `@memory-curator`:

1. Reads the proposal file.
2. Extracts qualifying lessons and writes them to the appropriate files under
   `~/.claude/template-memory/` (Tier 0).
3. Regenerates `NEW_PROJECT_PRIMER.md`.
4. Rotates the watermark: `date +%s > docs/context/.last-promote-ts` so the
   same batch is not proposed again.

On success, the proposal file can be deleted or left in place as an audit
trail — the watermark guarantees it will not be re-proposed.

## Why a human gate?

Tier 0 feeds every future project. Promotion quality matters, and the hook
cannot judge whether a tagged line is genuinely cross-project wisdom versus a
one-off fix that merely resembled one. The hook closes the loop (producer →
consumer) by making the queue visible; the human still chooses what ships.
