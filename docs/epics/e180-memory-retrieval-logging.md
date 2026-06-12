# E180 — Memory Retrieval Logging (Ebbinghaus foundation)

> Phase 45 — Memory Mechanism Maturity | Size: S (3 SP) | Deps: none

## Problem

The memory pipeline (`/athena:promote` → Tier 0) is **write-only**. Once a lesson lands in `~/.claude/template-memory/`, nothing measures whether it is ever retrieved. We cannot answer:

- Which Tier 0 lessons did SessionStart actually inject this session?
- Which stop-verifier rule fired, and which lesson backed it?
- Which lessons have not been touched in 30+ days?

Without retrieval data, every downstream Ebbinghaus mechanism (strength scoring E181, selective injection E182, promotion follow-through E183, forget E184, metrics E186) is impossible to build. **This is the foundation epic** — ship it first, accumulate 4–6 weeks of data, then design the decay curve from observation rather than guesswork.

## Solution

Three hooks emit retrieval events as new event types in the **existing** `.claude/audit.jsonl` (precedent: E146's `agent_complete` event already lives there). One file, one query surface, one privacy story.

1. **`scripts/hooks/session-start.sh`** — when `cat`ing `~/.claude/template-memory/NEW_PROJECT_PRIMER.md` (the only Tier 0 file actually injected today; line 48–52 of the hook), emit one `tier0_loaded` event. When E182 ships and inject becomes selective, the same hook emits one event per selected file.
2. **`scripts/hooks/stop-verifier.sh`** — every `exit 2` block emits a `rule_fired` event with `rule_id`. Lesson cross-reference is best-effort via a side-table `scripts/hooks/rule-to-lesson.json` (a minimal map of `{"19": "anti-patterns.md", "21": "anti-patterns.md", ...}`); rules without a lesson mapping just record `rule_id`.
3. **`scripts/hooks/subagent-stop-writeback.sh`** — extends the existing `agent_complete` emitter. After timestamping the agent's write-back, greps the modified file for `template-memory/<slug>.md` references and emits one `agent_cited` per match.

### Event schema (appended to `.claude/audit.jsonl`)

```json
{"ts":"2026-05-05T10:23:00Z","event":"tier0_loaded","lesson":"NEW_PROJECT_PRIMER.md","agent":"unknown","epic":"E180"}
{"ts":"2026-05-05T10:25:11Z","event":"rule_fired","rule_id":19,"lesson":"anti-patterns.md","epic":"E180"}
{"ts":"2026-05-05T10:30:42Z","event":"agent_cited","agent":"reviewer","lesson":"workflow-patterns.md","epic":"E180"}
```

Schema follows the existing `agent_complete` precedent (ts/event/agent/epic). `lesson` is the file basename relative to `~/.claude/template-memory/`.

## Key Files

| File | Action |
|---|---|
| `scripts/hooks/session-start.sh` | Edit — emit `tier0_loaded` for every Tier 0 file actually `cat`-ed (today: 1 file; post-E182: N) |
| `scripts/hooks/stop-verifier.sh` | Edit — every `exit 2` block emits `rule_fired` with `rule_id` |
| `scripts/hooks/rule-to-lesson.json` | New — `{ "rule_id": "lesson_basename" }` map for citation enrichment |
| `scripts/hooks/subagent-stop-writeback.sh` | Edit — extend existing event emitter to scan write-back for lesson refs |
| `scripts/hooks/CLAUDE.md` | Edit — document the three new event types in the JSONL Audit Log section (precedent: `agent_complete` is documented there) |
| `docs/context/CLAUDE.md` | Edit — link to the schema doc; explain retrieval-log → memory-mechanism relationship |

## Implementation

1. Document the schema in `scripts/hooks/CLAUDE.md` § JSONL Audit Log (next to existing `agent_complete` doc).
2. Patch `session-start.sh` — after the `cat NEW_PROJECT_PRIMER.md` block (line 50), emit `tier0_loaded` to `.claude/audit.jsonl` via the same `jq -c` pattern other hooks use.
3. Patch `stop-verifier.sh` — wrap each existing `exit 2` site to first append `rule_fired` (with the rule number from the file's existing rule index 1–22).
4. Author the minimal `rule-to-lesson.json` (start with rules 18/19/20/21/22 → matching anti-patterns / workflow-patterns lessons; expand later).
5. Patch `subagent-stop-writeback.sh` — after the existing `agent_complete` emit, grep the agent's write-back file for `template-memory/<slug>` references; emit one `agent_cited` per unique match.
6. Smoke test on a throwaway branch: trigger one of each event, `jq 'select(.event == "tier0_loaded" or .event == "rule_fired" or .event == "agent_cited")' .claude/audit.jsonl` should return all three.

## Acceptance Criteria

- [ ] SessionStart emits `tier0_loaded` for every Tier 0 file actually injected (today: 1 — `NEW_PROJECT_PRIMER.md`)
- [ ] Stop verifier emits `rule_fired` for every rule trip (verified by deliberately tripping rule #21 in a fixture test)
- [ ] `rule-to-lesson.json` enriches at least 5 rules (rules 18–22) with a backing lesson basename
- [ ] `subagent-stop-writeback.sh` emits `agent_cited` when a write-back contains a known lesson slug (fixture test)
- [ ] All three event types appear in `.claude/audit.jsonl` (existing audit log — no new file)
- [ ] Schema documented in `scripts/hooks/CLAUDE.md` § JSONL Audit Log next to `agent_complete`
- [ ] `audit.jsonl` is already gitignored (verified — no new gitignore entry needed)

## Alignment / Cross-Epic Hooks

- **Foundation for E181 / E182 / E183 / E184 / E186** — every downstream epic reads this log.
- **Pairs with E135** (Context Budget Tracking) — same JSONL audit philosophy.
- **Privacy**: per-session, gitignored, never leaves the local machine.

## Out of Scope

- **Aggregation** — no cross-session rollup yet (E186 builds the dashboard).
- **Strength scoring** — pure logging only; E181 consumes the log.
- **Tier 1 retrieval** — only Tier 0 (`~/.claude/template-memory/`) tracked. Tier 1 (`docs/context/`) is project-local and lives in git history.
- **Backfill** — no historical reconstruction. Day 0 of E180 is day 0 of the data.
- **Per-section (H2-level) retrieval** — file-level `lesson` only. NEW_PROJECT_PRIMER.md is one event regardless of which sections within it the model attended to.
- **Auto-populating `rule-to-lesson.json`** — manual curation only. The map is short and rarely changes.
