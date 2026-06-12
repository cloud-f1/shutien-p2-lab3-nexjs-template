# E160 — Context Log Auto-Archival

> Phase 40 — Self-Review Improvements | Size: S (2 SP) | Deps: none
> Source: self-review 2026-04-24 — `docs/context/*.md` grows unbounded, SessionStart injection will eventually overflow

## Problem

Append-only logs in `docs/context/`:

- `debug-log.md`, `review-findings.md`, `deploy-log.md`, `orchestration-log.md`, `evaluation-log.md`, `qa-patterns.md`, `health-log.md`, `session-summary.md`

Current sizes are small (117 / 32 / 68 lines for the biggest three), but:

- Growth rate is ~5–20 lines per session
- `scripts/hooks/session-start.sh` injects summary context on every start
- At 1000+ lines per file × 8 files, context injection blows out
- Old entries become low-signal after 30 days (superseded patterns, fixed bugs)

## Solution — auto-compact via hook, tied to auto-promotion

This is a two-layer mechanism:

**Layer 1 — hook-driven auto-compact**: `Stop` hook runs `scripts/archive-context.sh --auto`. It silently archives over-limit files with no user interaction. Archival becomes a passive maintenance behavior, like `git gc`.

**Layer 2 — archival triggers promotion**: before archiving, the script extracts any `[GENERALIZABLE]` lines about to be archived and writes a promotion-proposal (same mechanism as E158). **If a lesson is about to leave the live log, it must first be considered for Tier 0 promotion**. Archival becomes the forcing function that closes the promotion feedback loop.

So E160 + E158 together form an **auto-compact → auto-promote pipeline**:

```
  debug-log.md grows → Stop hook fires →
    archive-context.sh:
      1. detect over-limit files
      2. extract [GENERALIZABLE] from about-to-archive sections
      3. write docs/context/promotion-proposals/<ts>.md (reuse E158 format)
      4. archive old H2 sections to docs/context/archive/YYYY-MM.md
      5. keep live file under limit
      6. emit audit: {event: "auto_compact", lines_archived: N, lessons_queued: M}
```

Per-file limits:

| File | MAX_ACTIVE_ENTRIES | Rationale |
|------|--------------------|-----------|
| `debug-log.md` | 20 | Recent bugs only; old ones are in git |
| `review-findings.md` | 15 | QA cares about current review round |
| `deploy-log.md` | 30 | Longer — deploy history is useful |
| `orchestration-log.md` | 50 | Wave tracking needs context |
| `evaluation-log.md` | 20 | |
| `qa-patterns.md` | **no archive** | Curated patterns are load-bearing |
| `health-log.md` | 50 | |
| `session-summary.md` | 5 | Sessions — only latest few matter |

## Key Files

| File | Action |
|------|--------|
| `scripts/archive-context.sh` | New — supports `--check` (dry-run), `--auto` (hook-safe, silent), default (interactive) |
| `.claude/settings.json` | Edit — register `Stop` hook running `archive-context.sh --auto` |
| `docs/context/archive/.gitkeep` | New |
| `docs/context/archive/README.md` | New — "Archived logs; searchable with `git grep`; promotion happens before archival via E158 flow" |
| `docs/context/promotion-proposals/` | Shared with E158 — archival script writes proposals here |
| `docs/context/CLAUDE.md` | Edit — document auto-compact + linked promotion policy |

### Dependency note

This epic depends conceptually on E158 for the `promotion-proposals/` directory contract, but implementation can land in parallel — the proposal format is a stable JSON-like markdown and the two hooks independently write to the same folder. If E158 ships first, even better: E160 just reuses the format.

## Implementation

### archive-context.sh

```bash
#!/usr/bin/env bash
# Usage:
#   archive-context.sh --check   # dry-run; exits 1 if any file over limit
#   archive-context.sh --auto    # silent, hook-safe; extracts lessons first, then archives
#   archive-context.sh           # interactive, same as --auto but prints summary
set -euo pipefail

declare -A LIMITS=(
  [debug-log.md]=20
  [review-findings.md]=15
  [deploy-log.md]=30
  [orchestration-log.md]=50
  [evaluation-log.md]=20
  [health-log.md]=50
  [session-summary.md]=5
)

CHECK_ONLY=0
AUTO=0
case "${1:-}" in
  --check) CHECK_ONLY=1 ;;
  --auto)  AUTO=1 ;;
esac

# Extract [GENERALIZABLE] from about-to-be-archived sections → promotion proposal
extract_lessons_before_archive() {
  local file="$1" limit="$2"
  local count; count=$(grep -cE '^## ' "$file" || true)
  (( count > limit )) || return 0

  local cutoff=$((count - limit))
  local proposal_dir="docs/context/promotion-proposals"
  mkdir -p "$proposal_dir"
  local ts; ts=$(date +%Y%m%d-%H%M%S)
  local proposal="$proposal_dir/archive-${ts}.md"

  # Dump any [GENERALIZABLE] lines from sections 1..cutoff
  awk -v cutoff="$cutoff" '
    /^## / { h2++ }
    h2 <= cutoff && /\[GENERALIZABLE\]/ { print }
  ' "$file" > "$proposal.tmp"

  if [[ -s "$proposal.tmp" ]]; then
    {
      echo "# Promotion Proposal — ${ts} (from archive flow)"
      echo ""
      echo "Source file: \`$file\` (entries 1..${cutoff} about to be archived)"
      echo ""
      echo "## Lessons"
      cat "$proposal.tmp"
      echo ""
      echo "## Next step"
      echo "\`/athena:promote --apply $proposal\`"
    } > "$proposal"
  fi
  rm -f "$proposal.tmp"
}

root="docs/context"
archive_dir="$root/archive"
mkdir -p "$archive_dir"

month=$(date +%Y-%m)
archive_file="$archive_dir/${month}.md"

over_limit=0

for fname in "${!LIMITS[@]}"; do
  file="$root/$fname"
  [[ -f "$file" ]] || continue
  limit="${LIMITS[$fname]}"

  # Count H2 entries
  entries=$(grep -cE '^## ' "$file" || true)
  if (( entries > limit )); then
    over_limit=$((over_limit + 1))
    (( AUTO == 0 )) && echo "⚠️  $fname has $entries entries (limit $limit)"
    if (( CHECK_ONLY == 0 )); then
      # Extract [GENERALIZABLE] lessons BEFORE archiving — auto-promotion hook
      extract_lessons_before_archive "$file" "$limit"
      # Split: keep last $limit H2 sections, archive the rest
      awk -v limit="$limit" '
        /^## / { h2_count++ }
        { entries[NR] = $0; h2_at_line[NR] = h2_count }
        END {
          total = h2_count
          cutoff = total - limit
          for (i = 1; i <= NR; i++) {
            if (h2_at_line[i] <= cutoff) print entries[i] > "/dev/stderr"
            else                          print entries[i]
          }
        }
      ' "$file" > "$file.new" 2>> "$archive_file"
      mv "$file.new" "$file"
      (( AUTO == 0 )) && echo "   Archived older entries to $archive_file"

      # Telemetry
      printf '{"ts":"%s","event":"auto_compact","file":"%s","archived_entries":%d}\n' \
        "$(date -u +%FT%TZ)" "$fname" "$((entries - limit))" >> .claude/audit.jsonl
    fi
  fi
done

if (( CHECK_ONLY == 1 && over_limit > 0 )); then
  exit 1
fi
```

### /athena:save nudge

Append to `save.md` pipeline:

```markdown
## Post-save check

Run `scripts/archive-context.sh --check`. If it exits non-zero, print:

> ℹ️  Context logs exceeding size limits. Run `scripts/archive-context.sh` to archive old entries.
```

## Alignment / Cross-Epic Hooks

- **Writes to**: `docs/context/archive/YYYY-MM.md` (archive), `docs/context/promotion-proposals/archive-<ts>.md` (lessons extracted before archival — **same format as E158**)
- **Hooks**: registers `Stop` hook in `.claude/settings.json` (auto-compact on session end)
- **Relationship with E158**: both write to `promotion-proposals/`; E158 fires on edit, E160 fires on Stop. They complement, don't conflict.
- **Writes audit**: `.claude/audit.jsonl` event `auto_compact`
- **Does NOT bump** Stop-verifier rule count (this is a `Stop` hook, not a verifier rule)
- **Soft-dependency**: if E158 ships first, this epic reuses the proposal format verbatim; if this ships first, E158 adopts this format. Either order is fine.

## Acceptance Criteria

- [ ] `scripts/archive-context.sh --check` prints which files exceed limits, exits 1 if any
- [ ] `scripts/archive-context.sh` (no flag) archives old H2 sections to `archive/YYYY-MM.md`
- [ ] Live file retains only the latest N entries per the limit table
- [ ] Archived entries remain searchable: `git grep "pattern" docs/context/archive/` works
- [ ] `session-summary.md` and `qa-patterns.md` policies respected (never archive curated patterns)
- [ ] `docs/context/CLAUDE.md` documents the policy
- [ ] Archive dir has `README.md` explaining intent

## Out of Scope

- Cron-style automatic archival — keep archive a human-driven command
- Archiving based on date (vs. entry count) — entry count is simpler and sufficient
