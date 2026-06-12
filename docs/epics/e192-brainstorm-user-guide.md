# E192 — Bilingual User Guide for Brainstorm-First Workflow

> Phase 46 — Workflow Discipline + Memory-Aware Planning | Size: S (3 SP) | Deps: none

## Problem

After Phase 46 ships, `/athena:plan brainstorm` becomes the default design-dialogue entry. This is a **user-facing behavioral change**, not just an internal refactor — every developer running `/athena:cycle` will encounter the new flow.

The project already maintains a **bilingual user guide convention** (`docs/guides/en/` + `docs/guides/zh-TW/`, ~10 guides each side). Track B fork users explicitly rely on these guides for onboarding (CLAUDE.md "Fork 後客製化提示" + `docs/zh-tw/track-b-integration.md`). CLAUDE.md alone is insufficient — it's project-identity for Claude Code sessions, not user-onboarding.

Without a dedicated user guide:
- Track B learners hit `/athena:plan brainstorm` cold with no walkthrough
- The memory-aware retrieval behavior (E189) is invisible — users won't know past lessons surface during brainstorm
- The enriched epic file format (Implementation Phases / Per-Phase Checkpoints / Test Strategy) is undocumented from a user perspective

## Solution

Author two parallel guide files matching the existing convention:

- `docs/guides/en/brainstorm-first.md` (English)
- `docs/guides/zh-TW/brainstorm-first.md` (Traditional Chinese, per user preference: 使用者文件相關一率使用繁體中文)

Both cover the same content:

1. **When to use `/athena:plan brainstorm`** — vs. `/athena:plan audit` / `research` / `comply` / `evolve` / `auto`. Brainstorm = feature-idea refinement; the others = analysis-driven proposals.
2. **Expected dialogue flow** — purpose / constraints / success criteria Q&A (cap 7); 2-3 proposed approaches; section-by-section design review.
3. **Memory-aware retrieval (E189)** — what to expect when past Tier 0/Tier 1 lessons surface as design considerations during dialogue.
4. **Enriched epic file format (E187)** — what Implementation Phases / Per-Phase Checkpoints / Test Strategy sections look like + how to read them.
5. **End-to-end example** — walk through one feature ("weekly digest emails") from `/athena:plan brainstorm "..."` → strategy-log row → `/athena:plan approve` → enriched epic file → `/athena:implement`.
6. **Comparison with old flow** — short side-by-side: `/athena:plan auto → spec → implement` vs. `/athena:plan brainstorm → approve → implement`.

## Key Files

| File | Action |
|---|---|
| `docs/guides/en/brainstorm-first.md` | New — English user guide (~200-300 lines, matches `first-epic-walkthrough.md` style) |
| `docs/guides/zh-TW/brainstorm-first.md` | New — Traditional Chinese user guide (mirror EN content) |
| `docs/guides/en/learning-path.md` | Edit — add brainstorm-first to the recommended reading order |
| `docs/guides/zh-TW/learning-path.md` | Edit — mirror EN update |
| `README.md` (root) | Edit — one-line mention in the "Documentation" or "User Guides" section linking to new guide |

## Implementation

1. Read existing `docs/guides/en/first-epic-walkthrough.md` and `ai-agent-team-guide.md` to match tone and structure
2. Draft `docs/guides/en/brainstorm-first.md` covering the 6 sections above
3. Translate to Traditional Chinese → `docs/guides/zh-TW/brainstorm-first.md`
4. Update both `learning-path.md` files with a reference to the new guide (likely between "first-epic-walkthrough" and "memory-system")
5. Update root README.md with a link to the new guide
6. Verify links resolve: `find docs/guides -name "*.md" -exec grep -l brainstorm-first {} \;`
7. Coverage check: `wc -l docs/guides/en/brainstorm-first.md docs/guides/zh-TW/brainstorm-first.md` — expect both ~200-300 lines, roughly parallel structure

## Acceptance Criteria

- [ ] `docs/guides/en/brainstorm-first.md` exists, covers all 6 sections, includes one complete worked example
- [ ] `docs/guides/zh-TW/brainstorm-first.md` exists, mirrors EN content (parallel section structure)
- [ ] Both files link to relevant athena commands (`/athena:plan brainstorm`, `/athena:plan approve`, `/athena:implement`)
- [ ] Both files reference E187 (enriched epic format) + E189 (memory-aware retrieval) without assuming reader has read those epic files
- [ ] `docs/guides/{en,zh-TW}/learning-path.md` updated with brainstorm-first link
- [ ] Root `README.md` mentions the new guide in user-facing docs section
- [ ] No broken markdown links
- [ ] Tone matches existing bilingual guides (technical but accessible; example-driven)

## Alignment / Cross-Epic Hooks

- **Independent epic** — no deps on E187/E188/E189/E190/E191. Can be drafted in parallel.
- **Documents E187 + E189** — content references those epics but does not block on their implementation being complete (guide is forward-looking).
- **Practical timing**: write the guide AFTER E187 ships (so the worked example uses the real `/athena:plan brainstorm` output), but the epic itself is independent in the dependency graph. Recommended sequencing: ship in Wave 2 or 3 once E187 is mergeable; this isn't a hard dep, just a quality-of-content choice.

## Out of Scope

- Translating other Phase 46 docs (E187 impl plan, roadmap spec) — those are internal engineering docs, not user-facing
- Video walkthroughs / GIFs / screenshots — text-only, mirrors existing guide convention
- Updating `docs/zh-tw/getting-started.md` Step 4 (fork customization) — that's about CLAUDE.md customization, separate concern; revisit in a future docs cycle
- Adding brainstorm-first.md to `dev-docs/` — `dev-docs/` is for the in-app `/docs/` browser; user guides for terminal users live in `docs/guides/`
- Updating CLAUDE.md — that's E191's job (Cycle integration)

## Provenance

- Spec source: `docs/superpowers/specs/2026-05-18-athena-phase-46-roadmap.md` (post-approve completeness audit)
- Audit & proposal: `docs/context/strategy-log.md` Cycle 20 § Post-Approve Completeness Audit
- Approved via `/athena:plan approve E192` on 2026-05-19 (Cycle 20 addendum)
