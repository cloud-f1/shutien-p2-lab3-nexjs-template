---
description: "(memory) Archive weak Tier 0 lessons (strength < threshold) → _archive/, with a revive round-trip. Closes the Ebbinghaus loop — promote (E180+E181) is the gas pedal; forget (E184) is the brake."
allowed-tools: Read, Bash
---

## Default flow (no flags)

1. Run `scripts/memory/forget.sh list` to print candidates (lessons with
   strength < 0.10 by default). NO writes.
2. Surface the secondary E183 advisory (stale promotions that never fired)
   in the same output when available.
3. Wait for human confirmation before applying — forgetting is consequential.

## Flags

- `--dry-run`
  Alias for default `list`. Read-only — explicitly safe to run any time.

- `--apply`
  Run `scripts/memory/forget.sh apply` — atomically archives every candidate
  to `~/.claude/template-memory/_archive/<basename>.md`, stamps
  `archived_at:` in the frontmatter, appends a row to
  `_archive/forgotten.md`, and drops the lesson's entry from
  `scripts/memory/lesson-tags.json` (per E182 sidecar contract). Emits one
  `lesson_archived` event per file into `.claude/audit.jsonl`.

- `--threshold <X>`
  Override the default 0.10 strength cutoff. Combine with `--apply` or with
  the default list to preview a different sweep.

  ```bash
  scripts/memory/forget.sh list --threshold 0.20
  scripts/memory/forget.sh apply --threshold 0.05
  ```

- `--revive <basename>`
  Inverse operation. Moves `_archive/<basename>` back to the active Tier 0
  folder, strips the `archived_at:` marker, and removes the matching
  `archived` row from `_archive/forgotten.md`. Emits a `lesson_revived`
  audit event. Frontmatter strength / last_retrieved / retrieval_count are
  preserved untouched — the lesson resumes at the same score it had when
  archived.

  ```bash
  scripts/memory/forget.sh revive one-off-bugfix.md
  ```

- `--list-archived`
  Print every lesson currently sitting in `_archive/` along with its
  archive date. Read-only.

## Read-only Tier 0 invariant

This command is the ONE exception to the "read-only Tier 0" rule. It MAY
move files INTO and OUT OF `_archive/`, MAY rewrite
`scripts/memory/lesson-tags.json` to drop/restore the sidecar entry for the
archived basename, and MAY append to `_archive/forgotten.md`. It MUST NOT
mutate the content of any other Tier 0 file. (Frontmatter touches are
limited to adding/removing the single `archived_at:` key.)

## Audit events

| Event | When | Fields |
|-------|------|--------|
| `lesson_archived` | Per file successfully archived during `apply` | `ts, lesson, strength, threshold, epic` |
| `lesson_revived`  | Per `--revive` round-trip | `ts, lesson, epic` |

These extend the E180 retrieval-event schema and feed E186's metrics
dashboard ("how often are we archiving? how often are we reviving?").

## Relationship to the rest of Phase 45

```
E180 retrieval signal   ->  emits tier0_loaded / rule_fired / agent_cited
E181 strength score     ->  consumes signals; flag-weak surfaces S < 0.10
E183 follow-through     ->  detects stale promotions (advisory)
E184 (this command)     ->  archives the weak ones; revive when needed
```

`/athena:promote` keeps adding; `/athena:forget` keeps removing — without
deleting. Reversibility is the whole point: a lesson archived today can be
revived tomorrow with one command.
