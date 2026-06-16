---
description: "(memory) Refresh MEMORY.md accuracy → detect drift → suggest promote. Use --batch to extract epic patterns."
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
---
# Refresh Memory Accuracy

Memory pipeline: `/athena:save` (capture) → `/athena:learn` (correct) → `/athena:promote` (generalize)

## Arguments

$ARGUMENTS — optional:
- `--batch [N]` — Batch epic learning mode. Reads the last N completed epics (default 5, max 10), extracts patterns, and appends findings to `docs/context/qa-patterns.md`. Skips normal drift-detection (Steps 1–3.7).

---

## Branch: `--batch` Mode (Batch Epic Learning)

If `$ARGUMENTS` contains `--batch`:

1. **Parse N**: Extract the number after `--batch`. Default to 5 if no number given. Cap at 10 max.

2. **Find completed epics**: Read `docs/context/epic-progress.md`. Identify epics where merge = ✅. Take the last N completed epics (most recent first).

3. **Read each epic's context** (in parallel where possible):
   - Read the epic spec from `docs/epics/e{n}-*.md` (or `docs/epics/archive/e{n}-*.md`)
   - Run `git log --grep="E{n}" --oneline -10` for each epic to get PR/commit context

4. **Extract patterns**: For each epic, identify:
   - Recurring QA findings (test gaps, coverage issues, accessibility)
   - Implementation approaches (patterns reused, architectural decisions)
   - Debug lessons (gotchas encountered, fixes discovered)
   - DX improvements (tooling, workflow, developer experience)
   - Documentation and security observations

5. **Cross-reference**: Read `docs/context/qa-patterns.md` to check existing entries. Do NOT duplicate patterns already captured.

6. **Group by category**: Organize findings into these categories:
   - **Architecture**: structural patterns, domain design, API conventions
   - **Testing**: coverage strategies, Vitest/Playwright patterns, mock approaches
   - **DX**: tooling improvements, workflow optimizations, script enhancements
   - **Documentation**: doc structure, bilingual patterns, spec quality
   - **Security**: auth patterns, input validation, vulnerability prevention

7. **Append to qa-patterns.md**: Add a dated section at the end of the file:
   ```
   ## Batch Learning — {YYYY-MM-DD} (E{first}–E{last})

   ### Architecture
   - [GENERALIZABLE] {pattern description} (E{n})
   - {pattern description} (E{n})

   ### Testing
   - {pattern description} (E{n})

   ### DX
   - {pattern description} (E{n})

   ### Documentation
   - {pattern description} (E{n})

   ### Security
   - {pattern description} (E{n})
   ```

8. **Rules for batch output**:
   - Max 5 lines per epic (across all categories)
   - Tag cross-project patterns with `[GENERALIZABLE]`
   - Omit empty categories (don't add a heading with no entries)
   - Keep qa-patterns.md under 200 lines total — if appending would exceed, summarize older Batch Learning sections first

9. **Report**: Print summary:
   - Epics processed (list of E-numbers)
   - Patterns extracted (count by category)
   - Generalizable patterns found (count)
   - Suggest `/athena:promote` if any `[GENERALIZABLE]` patterns were added

**Then EXIT — do not continue to Step 1 below.**

---

## Branch: Normal Mode (Memory Accuracy Refresh)

If `$ARGUMENTS` does NOT contain `--batch`, run the standard drift-detection flow below.

## Step 1 — Read current state
Read these files in parallel:
- `~/.claude/projects/*/memory/MEMORY.md` (auto-memory for this project)
- `docs/context/session-summary.md`
- `docs/epics/EPIC_INDEX.md`
- Recent git log: `git log --oneline -20`

## Step 2 — Detect drift
Compare MEMORY.md claims against actual state:
- Epic completion status (MEMORY.md vs EPIC_INDEX.md)
- Current phase / active track
- Key file paths — do they still exist?
- Dev environment info — still accurate?
- Known gotchas — still relevant or resolved?

## Step 3 — Post-cycle reflection check
Read `docs/context/strategy-log.md`. If current cycle state is REFLECTING or COOLDOWN:
- Extract lessons from the latest cycle's reflection section
- Look for entries tagged `[GENERALIZABLE]`
- Incorporate cycle learnings into MEMORY.md (Step 3.5 below)
- If `[GENERALIZABLE]` entries found, note them for Step 4

## Step 3.5 — Update MEMORY.md
For each stale fact found:
- Correct it with current truth
- Keep the same section structure
- Do NOT add speculative info — only verified facts
- Do NOT remove entries unless confirmed obsolete

Report: list each correction as `[OLD] → [NEW]`

## Step 3.6 — Garbage collect stale entries
For each claim in MEMORY.md:
1. **Epic status**: compare against EPIC_INDEX.md. Remove or correct any
   "pending"/"in-progress" for completed epics.
2. **File paths**: verify with `ls` or `Glob`. Remove references to files
   that no longer exist.
3. **Counts** (test counts, agent counts, command counts): verify against
   actual filesystem. Correct if drifted.
4. **Resolved gotchas**: if a debugging entry references a bug that has been
   fixed (check git log), mark it resolved or remove.

## Step 3.7 — Clean session-summary.md noise
1. Remove all `<!-- last activity: ... -->` comment lines (unbounded growth).
2. Ensure "Latest Session" date matches today or last commit date.
3. Verify "Current State" table counts match reality.
4. Keep file under 80 lines.

## Step 3.8 — Flag weak Tier 0 lessons (E181)
Run the strength score's weak-lesson flagger and report any lesson with
`S < 0.10` to the user as a `/athena:forget` candidate (E184). This is
informational only — never auto-archive. Best-effort; if `score.sh` or the
Tier 0 dir is missing, skip silently.

```bash
[ -x scripts/memory/score.sh ] && bash scripts/memory/score.sh flag-weak 2>/dev/null || true
```

If output is non-empty, surface to the user:

> ⚠️ Tier 0 lessons below strength threshold (S < 0.10):
> {list of "<basename>\t<score>" lines}
>
> Consider running `/athena:forget` (E184) to review whether these should be
> archived. Strength is the per-lesson Ebbinghaus decay × retrieval reinforcement
> score from E181. Low strength means a lesson hasn't been retrieved in a long
> time relative to its half-life.

## Step 4 — Scan for generalizable lessons
Grep `docs/context/*.md` for `[GENERALIZABLE]` tags.
- If found: report them and suggest `/athena:promote`
- If none: skip — do not auto-run promote

## Step 4.5 — Stale promotion check (E183)
Run the promotion follow-through detector and surface any premature
promotion candidates (Tier 0 lessons promoted ≥30 days ago that have
NEVER fired — no `agent_cited`/`rule_fired`/`tier0_loaded` events since
promotion AND `retrieval_count == 0`). Read-only: detection only, the
human decides keep / demote / forget.

```bash
[ -x scripts/memory/promotion-follow-through.sh ] && \
  bash scripts/memory/promotion-follow-through.sh 2>/dev/null || true
```

If the report shows any candidates under `## Premature Promotion
Candidates (N)`, surface the full block to the user and append:

> ⚠️ Stale Tier 0 lessons detected. Each candidate above is a `/athena:forget`
> (E184) target. Per-candidate context (promotion date, original proposer,
> originating agent) is included so you can verify before archiving.

If the report shows the "_No premature promotion candidates_" line, do
NOT surface anything — keep the user-facing output quiet on the happy path.

## Step 4.6 — Consolidation scan (E190)
Run the consolidation detector and surface any near-duplicate Tier 0 lesson pairs.
Read-only: detection only. The human decides whether to merge, dismiss, split, or
archive-one. **No auto-merge.**

```bash
[ -x scripts/memory/consolidation-detect.sh ] && \
  REPORT_PATH="docs/context/promotion-proposals/consolidation-$(date -u +%Y-%m-%d).md" \
  bash scripts/memory/consolidation-detect.sh 2>/dev/null || true
```

Parse the JSON output. If the array is non-empty (clusters found):

1. Surface a consolidation candidate table to the user using the cluster data
   (cluster_id, lesson names, avg_overlap score).
2. Confirm that the markdown report was written to
   `docs/context/promotion-proposals/consolidation-YYYY-MM-DD.md`.
3. Append:
   > ⚠️ Tier 0 consolidation candidates detected. Each cluster above contains
   > lessons that overlap significantly (combined Jaccard+cosine ≥ 0.7).
   > Options per cluster: **merge** (keep best, delete duplicate), **dismiss**
   > (they're distinct enough on reflection), **split** (extract unique parts),
   > or **archive-one** via `/athena:forget`. Human decision required — no
   > auto-merge.

If the array is empty `[]`, do NOT surface anything — keep the output quiet.

## Step 5 — Report
Print summary:
- Facts corrected (count + list)
- Generalizable entries found (count)
- Consolidation candidates (count of clusters, if any)
- Next suggested action (promote or nothing)

## Rules
- NEVER auto-run `/athena:promote` — only suggest
- NEVER auto-merge consolidation candidates — only report them
- NEVER add unverified information to MEMORY.md
- NEVER remove entries without confirming they are obsolete
- Keep MEMORY.md under 200 lines
