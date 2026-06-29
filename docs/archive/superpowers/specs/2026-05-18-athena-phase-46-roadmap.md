---
title: "Phase 46 — Workflow Discipline + Memory-Aware Planning"
status: PROPOSED (awaiting human approval gate)
phase: 46
epics: E187, E188, E189, E190, E191
total_sp: 42
budget_used: 42 / 80
date_drafted: 2026-05-18
drafted_by: brainstorming session (claude opus 4.7 + user qwedsazxc78@gmail.com)
predecessor_phase: 45 (Memory Mechanism Maturity — Ebbinghaus loop, shipped 2026-05-07)
---

# Phase 46 — Workflow Discipline + Memory-Aware Planning

> **Theme.** Port the high-leverage [obra/superpowers](https://github.com/obra/superpowers/tree/main/skills) patterns into the athena namespace **without duplicating** what athena already does well. Add a brainstorm dialogue gate inside `/athena:plan`, wire Tier 0 + Tier 1 memory into planning, formalize verification discipline, and brake Tier 0 lesson duplication.

> **Status.** This is a roadmap, not a per-epic spec. Each epic still needs `/athena:spec` → `/athena:plan brainstorm` (after E187 ships) → `/athena:implement`.

> **Human gate.** Roadmap requires explicit approval before `epic-progress.md` rows get created (per `/athena:plan` safety rules).

---

## 1. Why this phase

Phase 45 closed the Ebbinghaus retrieve/reinforce/decay/forget loop. Memory is now structurally sound but **passive** — agents *write* lessons but rarely *read* them during design. Meanwhile, the planning pipeline (`/athena:plan` → `/athena:spec` → `/athena:implement`) has a structural gap: there's no design-dialogue gate. Specs get written before the idea is refined, which leads to mid-implementation rework.

The obra/superpowers skill library (14 skills) codifies several disciplines athena lacks: brainstorming, writing-plans (tactical, not strategic), verification-before-completion, receiving-code-review. **Most superpowers patterns overlap with existing athena capabilities** (TDD, dispatching-parallel-agents, using-git-worktrees, systematic-debugging, executing-plans) and porting them creates decision paralysis. Phase 46 cherry-picks **only the 3 patterns athena genuinely lacks** and grafts them onto existing athena primitives (`/athena:plan`, `@strategist`, Stop verifier, `/athena:learn`) instead of adding new top-level commands.

### Decision: graft, don't duplicate

| Superpowers skill | Action | Why |
|---|---|---|
| `brainstorming` | **Graft** as `/athena:plan brainstorm` sub-mode | Fills design-dialogue gap before spec |
| `writing-plans` | **Graft** as enriched `docs/epics/E{n}_{slug}.md` template (phases + checkpoints + test strategy added to existing epic file) | Fills tactical-plan layer inside the existing epic file — no new doc type |
| `verification-before-completion` | **Graft** as `skills/verification-discipline.md` + Stop Rule #23 | Fixes "agents claim done without evidence" behavior |
| `test-driven-development` | **Skip** | `skills/tdd-workflow.md` + `/athena:implement` already enforce |
| `dispatching-parallel-agents` | **Skip** | `/athena:batch` + `@orchestrator` already do this |
| `using-git-worktrees` | **Skip** | `/athena:batch` already uses worktrees |
| `systematic-debugging` | **Skip** | `@debugger` agent already handles |
| `executing-plans` | **Skip** | `/athena:loop` already does this |
| `subagent-driven-development` | **Skip** | `/athena:batch` Agent-tool dispatch covers it |
| `requesting/receiving-code-review` | **Skip** | `@reviewer` + `reviewer-loop.sh` (E162) already enforce |
| `finishing-a-development-branch` | **Skip** | `/athena:ship` + `/athena:pr` cover |
| `writing-skills` | **Skip** (meta) | Not user-invoked |
| `using-superpowers` | **Skip** (meta) | Not athena-relevant |
| `visual companion` (brainstorming sub-feature) | **Deferred** to Phase 47 | Cut from Phase 46 scope for budget |

### Memory layer: minimal disruption

Phase 45 shipped 5 memory epics (E180–E186). Strength scores need ~30 days to settle before structural changes are safe. Phase 46 adds **only read-side memory features** (retrieval during planning, duplication detection). No writes to schema, no migrations.

---

## 2. Goals

1. **G1.** Add a brainstorm dialogue gate inside `/athena:plan` so feature design happens *before* spec lock-in
2. **G2.** Enrich the existing epic file template (`docs/epics/E{n}_{slug}.md`) with tactical-plan sections — phases, per-phase checkpoints, test strategy — produced by brainstorm mode. **No new doc type.**
3. **G3.** Wire Tier 0 + Tier 1 memory retrieval into brainstorm so past lessons surface as design considerations
4. **G4.** Add a verification-discipline skill + Stop Rule #23 so agents can't claim "done" without an audit-event trail
5. **G5.** Detect Tier 0 lesson duplication (≥70% theme overlap) — anti-bloat brake complementing `/athena:forget`

## 3. Non-goals (deferred / out-of-scope)

| Item | Why deferred | Where it lands |
|---|---|---|
| Dev system tooling (faster TDD, e2e scaffolding, type sync) | Separate theme; mixing dilutes Phase 46 | Phase 47 |
| TDD / debugging / parallel-dispatch ports from superpowers | Athena equivalents already exist | Never |
| Cross-project memory sync, embeddings | Phase 45 strength scores need ~30 days to settle | Phase 48+ |
| Visual companion for `@strategist` brainstorm | Cut from Phase 46 budget; novel + risky | Phase 47 stretch |
| Cross-project lesson similarity clustering | Depends on embedding work | Phase 48+ |
| Auto-merge of consolidated lessons | Human gate required for now (E190 = detector only) | Future enhancement |

---

## 4. Pipeline architecture

### Before Phase 46

```
/athena:plan auto   →  audit/research/comply/evolve mode
                       proposes epics
                       writes strategy-log.md
                       ⏸️ AWAITING APPROVAL
                        ↓ human approves
/athena:spec        →  @spec-writer drafts OpenAPI + spec doc
                        ↓
/athena:implement   →  TDD red/green/refactor
                        ↓
/athena:qa          →  review + tests + acceptance
```

Pain points:
- No design dialogue between idea and spec
- No tactical impl plan layer between epic and code
- Agents claim "done" without verification trail
- Tier 0 lessons rarely consulted during design (passive memory)

### After Phase 46

```
/athena:plan brainstorm "feature idea"        ← NEW sub-mode (E187)
  │
  ├─ memory retrieval                          ← NEW (E189)
  │    └─ scripts/memory/match.sh --context=brainstorm
  │       reads Tier 0 + Tier 1 lessons tagged with feature keywords
  │       audit emit: tier0_loaded {context: "brainstorm"}
  │
  ├─ design dialogue                           ← NEW (E187)
  │    └─ @strategist runs Q&A: purpose, constraints, success criteria
  │       presents 2-3 approaches with trade-offs
  │       loops until user approves
  │       captures: phases, checkpoints, test strategy
  │
  └─ output: strategy-log.md (epic proposal — existing format
              + new fields: phases, checkpoints, test_strategy)
     audit emit: plan_brainstorm {epic: E{n}}

   ⏸️ AWAITING HUMAN APPROVAL (existing gate, unchanged)

/athena:plan approve E{n}    →  creates ENRICHED docs/epics/E{n}_{slug}.md  ← writing-plans grafted here
                                template now includes:
                                  • problem statement + stories + AC (existing)
                                  • dependency chain + risk notes (existing)
                                  • Implementation Phases (NEW)
                                  • Per-Phase Checkpoints (NEW)
                                  • Test Strategy (NEW)
                                adds row to epic-progress.md (existing)

/athena:spec        (unchanged — formalizes OpenAPI bits from epic file's brainstorm sketch)
   ↓
/athena:implement   (unchanged — TDD per epic file's implementation phases)
   ↓
/athena:qa          + Stop Rule #23                ← NEW (E188)
                      blocks "done"/"completed" commits
                      unless verification_check audit event exists
                      within last 10 min
```

Parallel maintenance:
```
/athena:learn                  → Step 4.6 (NEW, E190)
  └─ scripts/memory/consolidation-detect.sh
     flags Tier 0 lesson clusters with theme-overlap ≥ 0.7
     surfaces to promotion-proposals/ queue
     audit emit: consolidation_detected

/athena:cycle                  → updated entry step (E191)
  └─ now invokes /athena:plan brainstorm
     not /athena:plan auto
     EPIC_INDEX.md template includes
     "Brainstorm Plan: docs/plans/E{n}-impl.md" row
```

---

## 5. Epic breakdown

### Summary table

| ID | Name | Layer | SP | Depends | Wave | Risk |
|---|---|---|---|---|---|---|
| **E187** | `/athena:plan brainstorm` mode + enriched epic file template | command + @strategist + template | 13 | — | 1 | M |
| **E188** | Verification discipline skill + Stop Rule #23 | skill + hook | 8 | — | 1 | M |
| **E189** | Memory-aware planning — `@strategist` reads Tier 0/1 during brainstorm | agent extension | 8 | E187 | 2 | L |
| **E190** | Lesson consolidation detector — `consolidation-detect.sh` + `/athena:learn` Step 4.6 | script + command | 8 | — | 1 | L |
| **E191** | Cycle integration — `/athena:cycle` + `EPIC_INDEX.md` template + CLAUDE.md update | refactor | 5 | E187, E188, E189 | 3 | L |

**Total: 42 SP (well under 80 SP cycle budget).**

### E187 — `/athena:plan brainstorm` mode + enriched epic file template

**Problem.** `/athena:plan` is strategic (which epic to do next). There's no design-dialogue layer that refines a *specific* feature idea before it gets formalized into a spec. Agents currently jump from "idea" to "spec" with no intermediate gate, leading to mid-implementation rework when assumptions turn out wrong. Existing epic files (`docs/epics/E{n}_*.md`) capture problem/stories/AC/deps/risk but lack tactical content — phases, checkpoints, test strategy.

**Solution.** Add a `brainstorm` sub-mode to `/athena:plan` AND enrich the epic file template the existing `/athena:plan approve` step writes:
1. Sub-mode invoked as `/athena:plan brainstorm "weekly digest emails for project owners"`
2. Spawns `@strategist` in dialogue mode (new behavior — see `.claude/agents/strategist.md` update)
3. Runs the obra/superpowers brainstorming protocol adapted for athena conventions:
   - Explore project context (read epic-progress, strategy-log, relevant code)
   - Ask clarifying questions ONE at a time (purpose, constraints, success criteria)
   - Propose 2-3 approaches with trade-offs
   - Present design sections (architecture, components, data flow, error handling, testing)
   - **Capture phases, per-phase checkpoints, test strategy as dialogue progresses**
   - Iterate until user approves
4. Writes ONE output (existing convention preserved):
   - `docs/context/strategy-log.md` — epic proposal row, extended with brainstorm fields (phases, checkpoints, test_strategy)
5. On `/athena:plan approve E{n}`, the existing epic-file-creation step reads those fields and writes the **enriched** `docs/epics/E{n}_{slug}.md` with new sections: Implementation Phases, Per-Phase Checkpoints, Test Strategy
6. Emits audit event `plan_brainstorm` with epic ID

**No new doc type. No new directory.** Writing-plans content lives in the existing epic file.

**Stories.**
- As a developer, when I have a feature idea but it's not fully formed, I can run `/athena:plan brainstorm "idea"` and walk through design with @strategist before any code or spec
- As a future me, when I pick up an epic 3 weeks later, the epic file itself tells me phases, checkpoints, and test strategy — one doc, not two
- As a reviewer, when I evaluate an epic, I see brainstorm-derived tactical plan inline in the epic file

**Acceptance criteria.**
- `/athena:plan brainstorm "X"` extends the strategy-log row with `phases`, `checkpoints`, `test_strategy` JSON fields
- On `/athena:plan approve`, the generated `docs/epics/E{n}_{slug}.md` contains: Implementation Phases (≥3), Per-Phase Checkpoints, Test Strategy section
- Audit log emits `plan_brainstorm` event with `{epic, sp_estimate, phase_count}` fields
- Existing `/athena:plan` modes (audit/research/comply/evolve/auto) work unchanged — `brainstorm` is purely additive
- Epic file template updated at `docs/templates/epic-template.md` (or wherever the canonical template lives — verify during impl)
- @strategist agent definition (`.claude/agents/strategist.md`) gains "Brainstorm Mode" section
- Backward compat: existing epic files (E1–E186) without the new sections still validate
- 5+ test fixtures cover: empty idea string, idea matching existing epic, idea spanning multiple domains, idea rejected mid-dialogue, idea with security implications

**Files touched (estimate).**
```
.claude/commands/athena/plan.md          (extend Usage + new Step 2.5 + epic-write step)
.claude/agents/strategist.md             (add Brainstorm Mode section)
docs/templates/epic-template.md          (enrich with phases/checkpoints/test-strategy)
scripts/hooks/audit-emit.sh              (add plan_brainstorm event type)
docs/context/qa-patterns.md              (mention new pattern)
```

**Risk: Medium.** Touches `@strategist` (already complex) and `/athena:plan` (production-critical). Mitigation: preserve all existing modes byte-identical; brainstorm is purely additive.

---

### E188 — Verification discipline skill + Stop Rule #23

**Problem.** Agents claim "completed", "done", "shipped" in commit messages and reports without running the verification commands that would prove it. Stop verifier has 22 rules but none of them check the *behavior* "agent claimed done without evidence".

**Solution.** Two-part:
1. **New skill** `.claude/skills/verification-discipline.md` — codifies the obra/superpowers `verification-before-completion` pattern: before any commit/PR/report that uses completion verbs ("done", "completed", "fixed", "shipped", "passing"), agent must have an audit event in the last 10 min showing the relevant check ran (test run, lint pass, type-check, etc.)
2. **Stop Rule #23** — Stop verifier hook scans the last 50 audit events; if the about-to-be-committed work is from an agent and the staged diff/commit message contains completion verbs, require a `verification_check` event within the last 10 min, OR a whitelist verb (`wip:`, `chore(state):`, `docs:`, partial commits).

**Stories.**
- As a reviewer, I can trust that "done" claims have an audit trail behind them
- As a developer, when I commit `wip:` or `chore(state):` I'm not blocked
- As a future agent, I learn the discipline by being blocked once

**Acceptance criteria.**
- `.claude/skills/verification-discipline.md` exists, gets auto-loaded at SessionStart, lists the verbs that trigger the rule
- Stop verifier Rule #23 blocks commit when:
  - Author is an agent (not human user)
  - Commit message OR staged diff contains: "done", "completed", "shipped", "fixed", "passing", "verified"
  - No `verification_check` audit event in last 10 min
  - Commit message does not start with a whitelisted prefix
- Whitelist prefixes: `wip:`, `chore(state):`, `docs:`, `chore(memory):`, `chore(roadmap):`
- 8+ fixture tests cover the matrix (verb × whitelist × event-present)
- Zero false positives across 50+ existing commits replayed through the rule
- Hook performance: rule adds <50ms to Stop verifier total runtime

**Files touched.**
```
.claude/skills/verification-discipline.md    (NEW)
scripts/hooks/stop-verifier.sh               (add rule #23)
scripts/hooks/tests/test-rule-23.sh          (NEW — 8 fixtures)
.claude/settings.json                        (no change — Stop hook already wired)
scripts/hooks/CLAUDE.md                      (document rule #23)
CLAUDE.md                                    (update "22 rules" → "23 rules" mentions)
```

**Risk: Medium.** False positives would block legitimate commits. Mitigation: extensive whitelist, audit-event grace period, fixture replay against 50+ existing commits before activation.

---

### E189 — Memory-aware planning

**Problem.** Tier 0 + Tier 1 memory exists but is passive — agents write lessons but don't read them during design. `@strategist` proposing a new epic doesn't surface "we tried this 3 months ago and it failed because X" lessons.

**Solution.** Extend `@strategist` to read tagged memory during `brainstorm` mode (E187). Reuse E182's `scripts/memory/match.sh` tag-matching infrastructure. When user invokes `/athena:plan brainstorm "feature X"`:
1. Extract keywords from feature description (TF-IDF or simple stopword filter)
2. Call `match.sh --context=brainstorm --keywords="X,Y,Z" --min-strength=0.4`
3. If matches found, inject as design-consideration block in the dialogue: *"Past lesson: when we did Y, we hit Z gotcha — see `[link]`. Consider whether this applies."*
4. Audit emit: `tier0_loaded {context: "brainstorm", lessons: [...]}` (extends existing E180 event type)

**Stories.**
- As @strategist, when I'm brainstorming a feature, I get relevant past lessons surfaced without having to manually search
- As a developer, I learn from past mistakes encoded in Tier 0 / Tier 1 without re-reading everything
- As a memory curator, I can see in `tier0_loaded` audit events whether brainstorm context is actually retrieving useful lessons (feeds Phase 45 dashboard)

**Acceptance criteria.**
- `@strategist` brainstorm mode calls `match.sh` before dialogue starts
- Injects ≥1 relevant lesson into dialogue when match found (strength ≥0.4, tag overlap ≥1)
- Audit emit `tier0_loaded` includes `context=brainstorm`
- No injection when no matches (graceful no-op)
- Tier 0 lessons consulted during brainstorm have `retrieval_count` and `last_retrieved` updated via E181 `score.sh reinforce`
- Phase 45 metrics dashboard (E186) now shows brainstorm-context retrievals as a separate slice

**Files touched.**
```
.claude/agents/strategist.md                 (extend Brainstorm Mode with retrieval step)
scripts/memory/match.sh                      (no schema change — add --context flag if missing)
scripts/memory/score.sh                      (no schema change — reinforce called on retrieved IDs)
.claude/commands/athena/metrics.md           (add brainstorm slice to --memory dashboard)
docs/context/qa-patterns.md                  (document new pattern)
```

**Risk: Low.** Read-only against memory schema. Reuses E182 + E180 + E181 infrastructure. Worst case: no matches, dialogue proceeds as if E189 wasn't there.

---

### E190 — Lesson consolidation detector

**Problem.** Tier 0 has 8 lessons today (and growing). As `/athena:promote` accumulates lessons over many phases, duplicates and near-duplicates will sneak in — different wording for the same insight. `/athena:forget` archives weak lessons but doesn't detect *duplicates*.

**Solution.** Read-only detector. New script `scripts/memory/consolidation-detect.sh`:
1. Loads all Tier 0 lessons (`~/.claude/template-memory/*.md` excluding archive)
2. Extracts tags + title + first paragraph from each
3. Computes pairwise theme-overlap (Jaccard on tags + simple cosine on first-paragraph token bags)
4. Outputs JSON list of clusters with overlap ≥ 0.7
5. `/athena:learn` Step 4.6 (NEW) calls the script and surfaces clusters to `docs/context/promotion-proposals/consolidation-{timestamp}.md`
6. Human gate: user reviews, decides per-cluster: merge / dismiss / split / archive-one

**Stories.**
- As a memory curator, I can see when 3+ lessons are saying the same thing and consolidate them
- As @memory-curator agent, I have a signal during `/athena:promote` to suggest "this overlaps with lesson X, merge or differentiate?"
- As future me, I'm not buried under near-duplicate lessons

**Acceptance criteria.**
- `scripts/memory/consolidation-detect.sh` produces well-formed JSON: `[{cluster_id, lessons: [{name, score}], avg_overlap}, ...]`
- Zero false positives on the current 8 Tier 0 lessons (they are all distinct — the detector should output `[]`)
- `/athena:learn` Step 4.6 writes consolidation findings to `docs/context/promotion-proposals/consolidation-YYYY-MM-DD.md`
- Audit emit: `consolidation_detected {clusters: N, lessons_involved: M}`
- Script runs in <2s for 50 lessons (linear scaling)
- 5+ fixture tests cover: empty memory, all-distinct, exact duplicate, near-duplicate, three-way cluster

**Files touched.**
```
scripts/memory/consolidation-detect.sh        (NEW)
scripts/memory/tests/test-consolidation.sh    (NEW — 5 fixtures)
.claude/commands/athena/learn.md              (add Step 4.6)
docs/context/promotion-proposals/.gitkeep     (NEW if dir doesn't exist)
.claude/agents/memory-curator.md              (mention consolidation as input)
```

**Risk: Low.** Read-only. Output is advisory. No memory schema changes.

---

### E191 — Cycle integration

**Problem.** Once E187–E190 ship, `/athena:cycle` still calls `/athena:plan auto` as its entry step. CLAUDE.md doesn't mention the new brainstorm pipeline. `EPIC_INDEX.md` row format hasn't been refreshed to note that epics carry tactical-plan content inline.

**Solution.** Wire everything in:
1. `/athena:cycle` first step changes from `/athena:plan auto` to `/athena:plan brainstorm` (with prompt for feature idea)
2. CLAUDE.md "Active Epic" + "Slash Commands" sections updated to reference brainstorm sub-mode
3. `EPIC_INDEX.md` legend updated to note that Phase 46+ epics include Implementation Phases / Checkpoints / Test Strategy sections inline (no new column needed)
4. Existing `/athena:loop` step descriptions updated (no behavioral change — just doc clarity)
5. Memory: add `[GENERALIZABLE]` lesson candidate in `docs/context/promotion-proposals/`: "brainstorm-first plan workflow"

**Stories.**
- As a developer, when I run `/athena:cycle`, the new brainstorm-first workflow is the default path
- As a reviewer, I know Phase 46+ epic files contain tactical plan inline
- As a future fork user, CLAUDE.md tells me about the brainstorm gate

**Acceptance criteria.**
- `/athena:cycle` first step invokes brainstorm
- CLAUDE.md "Slash Commands" + "Active Epic" sections updated
- `EPIC_INDEX.md` legend mentions enriched epic format for Phase 46+
- `/athena:loop` doc references new pipeline (without behavioral change)
- Promotion proposal candidate written to `docs/context/promotion-proposals/`
- All hooks pass (no regressions)
- Full test suite green: server 398+, client 515+

**Files touched.**
```
.claude/commands/athena/cycle.md             (entry step update)
docs/epics/EPIC_INDEX.md                     (legend update — note enriched epic format)
CLAUDE.md                                    (Slash Commands + Active Epic sections)
.claude/commands/athena/loop.md              (doc update, no behavior change)
docs/context/promotion-proposals/2026-XX-XX-brainstorm-first.md  (NEW candidate)
docs/context/session-summary.md              (Phase 46 closeout)
```

**Risk: Low.** Pure refactor / doc update. Sequenced last in the wave plan to absorb any breakages from E187–E190.

---

## 6. Wave plan

```
Wave 1 (parallel, max-concurrent 3):
  ├─ E187  /athena:plan brainstorm + impl plan output
  ├─ E188  Verification discipline + Stop Rule #23
  └─ E190  Lesson consolidation detector
  Rationale: no inter-deps. Use /athena:batch auto for parallel dispatch.

Wave 2 (sequential — only E189 here):
  └─ E189  Memory-aware planning
  Rationale: depends on E187's brainstorm sub-mode existing.

Wave 3 (sequential — only E191 here):
  └─ E191  Cycle integration
  Rationale: depends on E187, E188, E189. Sequenced last to absorb breakage.
```

**Execution recommendation.** After human approves this roadmap and `/athena:plan approve E187,E188,E189,E190,E191` creates the epic files:
```bash
git push origin main
/loop 2m /athena:batch auto   # auto-detects Wave 1, dispatches parallel
```

Expected: ~2-3 days wall-clock for 5 epics, similar to Phase 45 cadence.

---

## 7. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Brainstorm dialogue makes `/athena:plan` slow for non-brainstorm modes | L | L | Preserve all existing modes byte-identical; `brainstorm` is opt-in sub-mode |
| R2 | Memory retrieval (E189) injects irrelevant lessons | M | L | Reuse E182 `match.sh`; require min strength 0.4 + tag overlap ≥1; graceful no-op on no-match |
| R3 | Stop Rule #23 false positives block legit commits | M | M | Extensive whitelist, 10-min audit grace, fixture replay against 50+ commits before activation |
| R4 | Consolidation detector (E190) flags valid distinct lessons | L | L | Read-only output, human gate via `/athena:learn` queue, no auto-merge |
| R5 | E187 changes to `@strategist` break existing modes | M | M | Snapshot tests of audit/research/comply/evolve/auto outputs before E187 merge |
| R6 | E191 cycle integration introduces hidden state break | L | M | Sequenced last in wave plan; full regression suite gates merge |
| R7 | Phase touches multiple production-critical files (`@strategist`, `/athena:plan`, `/athena:learn`, `/athena:cycle`) simultaneously | M | M | Wave plan isolates dependencies; existing 515+398 tests gate each epic merge |
| R8 | Documentation drift between roadmap, CLAUDE.md, MEMORY.md after merge | L | L | E191 explicitly updates all three; `/athena:learn` after Phase 46 close audits drift |

---

## 8. Success metrics (measure 30 days after Phase 46 close)

| Metric | Target | How measured |
|---|---|---|
| `/athena:plan brainstorm` invocations | ≥5 real features | `jq '. | select(.event=="plan_brainstorm")' .claude/audit.jsonl` |
| `docs/plans/E{n}-impl.md` docs in repo | ≥3 | `ls docs/plans/E*.md` |
| `tier0_loaded` events with `context=brainstorm` | ≥1 | `jq '. | select(.event=="tier0_loaded" and .context=="brainstorm")' .claude/audit.jsonl` |
| Stop Rule #23 false positives | 0 over 50+ commits | Git log inspection + audit log replay |
| Lesson consolidation clusters detected & resolved | ≥1 | `docs/context/promotion-proposals/consolidation-*.md` count |
| Tier 0 lesson count (anti-bloat) | ≤12 (currently 8) | `ls ~/.claude/template-memory/*.md \| wc -l` |
| Phase 45 retention metrics unchanged or improved | Block B inject hit-rate ≥75% | `/athena:metrics --memory` |

---

## 9. Migration & rollback

**Migration steps (per epic — see individual impl plans after E187 ships):**
- E187: no migration; new sub-mode is purely additive
- E188: Stop Rule #23 disabled by default for first 5 days post-merge; enable via `STOP_RULE_23_ENABLED=1` env var; flip to default-on after 5-day fixture-replay window
- E189: no migration; read-only against existing memory schema
- E190: no migration; new script + new doc directory
- E191: doc updates only; backward-compatible

**Rollback per epic:**
- E187: revert `.claude/commands/athena/plan.md` + `@strategist` sections; brainstorm sub-mode disappears, no data loss
- E188: set `STOP_RULE_23_ENABLED=0`; rule no-ops without revert
- E189: revert `@strategist` brainstorm-mode retrieval step
- E190: leave script in place (read-only); revert `/athena:learn` Step 4.6 wiring
- E191: standard doc revert via git revert

**Worst case (full Phase 46 revert):** `git revert` the merge commits in reverse order. No schema migrations means no data corruption risk.

---

## 10. Appendix A — Superpowers → Athena port decision matrix

For each obra/superpowers skill, the explicit decision and why.

| Superpowers skill | Athena equivalent | Decision | Phase 46 epic |
|---|---|---|---|
| `brainstorming` | (none — gap) | **PORT (graft)** | E187 |
| `writing-plans` | `/athena:plan` is strategic, not tactical; epic files lack phases/checkpoints/test-strategy | **PORT (graft)** as enriched `docs/epics/E{n}_{slug}.md` template (no new doc type) | E187 |
| `verification-before-completion` | Stop verifier exists but no "claim-without-evidence" rule | **PORT (graft)** | E188 |
| `test-driven-development` | `skills/tdd-workflow.md` + `/athena:implement` enforce TDD strictly | **SKIP** — full overlap | — |
| `dispatching-parallel-agents` | `/athena:batch` with worktree isolation + Step 3.5 probe | **SKIP** — full overlap | — |
| `using-git-worktrees` | `/athena:batch` already uses them internally | **SKIP** — full overlap | — |
| `systematic-debugging` | `@debugger` agent + auto-delegation | **SKIP** — full overlap | — |
| `executing-plans` | `/athena:loop` + `/athena:batch` execute plans | **SKIP** — full overlap | — |
| `subagent-driven-development` | `/athena:batch` Agent-tool dispatch | **SKIP** — full overlap | — |
| `requesting-code-review` | `@reviewer` + `reviewer-loop.sh` (E162 iterative convergence) | **SKIP** — full overlap | — |
| `receiving-code-review` | `@reviewer` workflow handles | **SKIP** — partial overlap, low value | — |
| `finishing-a-development-branch` | `/athena:ship` + `/athena:pr` | **SKIP** — full overlap | — |
| `writing-skills` | Meta skill — not user-invoked | **SKIP** — meta | — |
| `using-superpowers` | Meta skill — not athena-relevant | **SKIP** — meta | — |
| Brainstorming visual companion | (none) | **DEFER** to Phase 47 | — |

**Bottom line:** 3 patterns ported, 11 skipped (full overlap), 1 deferred. Athena namespace gains 1 new sub-mode + 1 new skill + 1 new script, not 14 new commands.

---

## 11. Appendix B — Open questions (resolve before E187 spec)

1. **Epic file template location** — the canonical "epic template" is **inline in `.claude/commands/athena/plan.md`** § "approve E{n}" Step 2 (currently a 4-bullet description: Problem statement / Stories with ACs / Dependency chain / Risk notes). There is **NO separate `docs/templates/epic-template.md`** file (audit confirmed 2026-05-19). Recommend: enrich the inline description with the 3 new sections (Implementation Phases / Per-Phase Checkpoints / Test Strategy). Backward compat via section-presence checks (existing E0–E186 epic files without these sections still validate).
2. **Brainstorm Q&A length cap** — should `@strategist` cap dialogue at N questions to prevent runaway sessions? Recommend cap at 7 with override flag.
3. **Strategy-log brainstorm fields shape** — phases/checkpoints/test_strategy as JSON in strategy-log row, or as inline markdown sub-sections? Recommend JSON for machine readability (mirrors existing strategy-log row format), human-readable markdown rendered into epic file on approve.
4. **Stop Rule #23 grace period** — 10 min default is arbitrary. Should it be configurable per-agent? Recommend env var `STOP_RULE_23_GRACE_MIN=10` with sensible default.
5. **E189 keyword extraction** — TF-IDF requires corpus stats. Simple stopword filter is faster but lower precision. Recommend start with stopword filter, upgrade to TF-IDF in Phase 48 if precision is an issue.
6. **E190 theme-overlap threshold** — 0.7 is arbitrary. Should it be tunable? Recommend keep at 0.7 for v1; revisit after first cluster detection.

---

## 12. Approval flow

1. **Human reviews this roadmap doc** (current step)
2. User runs `/athena:plan approve E187,E188,E189,E190,E191` to lock the epics
3. `docs/epics/E187_*.md` through `E191_*.md` files auto-created with epic template
4. `docs/context/epic-progress.md` Phase 46 row added with all ⬜
5. `docs/epics/EPIC_INDEX.md` updated
6. Push to main → `/loop 2m /athena:batch auto` begins Wave 1

---

## 13. Provenance

- Drafted via `superpowers:brainstorming` skill (5.1.0)
- Session: 2026-05-18, claude opus 4.7 + user qwedsazxc78@gmail.com
- Predecessor: Phase 45 (E180–E186, shipped 2026-05-07)
- Reference: [obra/superpowers](https://github.com/obra/superpowers/tree/main/skills) — 14 skills surveyed, 3 ported
- Next step: writing-plans skill invocation to produce executable plan for E187 (the foundation epic)
