# E194 — Auto-Injected Skill Drift Purge

> Phase 47 — Foundation Truth | Size: S (8 SP) | Deps: none

## Problem

Four skills auto-inject into every session via Claude Code's skill harness (YAML `description:` frontmatter discovery in `.claude/skills/`), and three of them actively teach patterns that were deleted or inverted months ago. `.claude/skills/client-patterns.md` lines 38–46 document the auth Adapter Pattern (`adaptUserRead` / `composeAuthResponse`) — a grep of `client/src/` finds zero references to either symbol. The Adapter Pattern was fully removed in E161 (PR #134); the server now returns a unified `AuthResponse` and the client has thin typed wrappers. An agent reading the skill today will reconstruct a pattern the codebase has not had in months.

The same file at line 134 declares "No Tailwind — custom properties + co-located CSS". Tailwind shipped in E167 and `client/tailwind.config.ts` exists on disk. Lines 131–132 point design tokens to `src/styles/globals.css`, which has zero `:root` blocks; the real token source is `client/src/styles/themes.css` (47 CSS vars, 6 themes). `frontend-review.md` line 53 repeats the same wrong globals.css pointer. Both files describe page-co-located CSS (e.g., `Dashboard.css`) as the accepted norm, but Stop-verifier Rules #21 and #22 (shipped E176) now **ban** new page CSS and new rules in `styles/common/`. Every time a skill steers an agent toward page-level CSS, the Stop verifier ejects the commit — a friction loop baked into the auto-loaded context.

`tdd-workflow.md` P5 line 82 still cites "adapter pattern in `client/src/api/auth.ts`" as a live example. `openapi-first.md` lines 57–64 hardcode a stale inventory snapshot: `tags:[auth,users,health]`, `17 endpoints`, `9 schemas` — counts that drifted as epics E22–E189 landed new domains and endpoints. Any agent using the skill to reason about the API surface gets a fabricated baseline.

## Solution

Surgical edits to four existing skill files — no new files, no renames, no changes to `session-start.sh`.

1. **`client-patterns.md`** — remove the adapter section (lines 38–46: `adaptUserRead`, `composeAuthResponse`, compose pattern); change "No Tailwind" to "Tailwind is the primary styling layer"; repoint `globals.css` → `themes.css` as the token source; replace the CSS-guidance paragraph with "compose `components/ui/` primitives, style via Preset axis (`preset.ts`) × Theme axis (`themes.css`); no new page-level CSS (Stop-verifier Rules #21/#22)".

2. **`tdd-workflow.md`** — remove the P5 line 82 reference to the adapter pattern; if the example block becomes empty, replace with a one-liner noting the auth client is thin wrappers over `AuthResponse` (the OpenAPI-generated type).

3. **`frontend-review.md`** — repoint `globals.css` → `themes.css` for design tokens (line 53); replace the CSS co-location guidance with the primitive-first / Preset-slot / no-new-page-CSS norm; note Rules #21/#22 explicitly so reviewers flag violations.

4. **`openapi-first.md`** — delete the hardcoded inventory block (lines 57–64); replace with: "Inspect `docs/openapi.yaml` for the current endpoint and schema set — counts change as epics land."

## Key Files

| File | Action |
|---|---|
| `.claude/skills/client-patterns.md` | Edit — remove adapter section; fix Tailwind flag; repoint tokens to themes.css; rewrite CSS guidance |
| `.claude/skills/tdd-workflow.md` | Edit — remove adapter-pattern reference in P5 |
| `.claude/skills/frontend-review.md` | Edit — repoint tokens to themes.css; rewrite CSS co-location guidance; cite Rules #21/#22 |
| `.claude/skills/openapi-first.md` | Edit — replace hardcoded endpoint/schema inventory with "inspect openapi.yaml" directive |

## Implementation

1. Read `.claude/skills/client-patterns.md` in full; identify the adapter block (lines 38–46) and the CSS/Tailwind/globals.css references; apply edits; verify no `adaptUserRead`/`composeAuthResponse`/`globals.css`-as-token-source remain.
2. Read `.claude/skills/tdd-workflow.md`; locate P5 line 82 adapter reference; remove or replace; confirm no `adapter` pattern references survive in the file.
3. Read `.claude/skills/frontend-review.md`; fix line 53 globals.css pointer; rewrite CSS section to primitive-first + Preset-slot norm + Rules #21/#22 callout.
4. Read `.claude/skills/openapi-first.md`; delete lines 57–64 hardcoded inventory; insert "inspect `docs/openapi.yaml`" directive.
5. Run verification grep across all four files: `grep -n "adaptUserRead\|composeAuthResponse\|No Tailwind\|globals\.css\|17 endpoints\|9 schemas" .claude/skills/*.md` — expect zero matches.
6. Confirm all four skill files remain at their existing paths in `.claude/skills/` — the Claude Code skill harness auto-discovers them by YAML frontmatter; no path changes are needed.

## Acceptance Criteria

- [ ] `grep -rn "adaptUserRead\|composeAuthResponse" .claude/skills/` returns zero matches
- [ ] `grep -n "No Tailwind" .claude/skills/client-patterns.md` returns zero matches
- [ ] `grep -n "globals\.css" .claude/skills/client-patterns.md .claude/skills/frontend-review.md` returns zero matches (no stale token pointer)
- [ ] `client-patterns.md` mentions `themes.css` as the CSS-var / design-token source and references Stop-verifier Rules #21/#22
- [ ] `frontend-review.md` CSS guidance directs reviewers to flag page-co-located CSS and cites Rules #21/#22
- [ ] `tdd-workflow.md` contains no reference to the adapter pattern or `composeAuthResponse`
- [ ] `openapi-first.md` contains no hardcoded endpoint count or schema count; directs agent to inspect `docs/openapi.yaml` directly
- [ ] All four skill files remain at their existing paths in `.claude/skills/` — the Claude Code skill harness still discovers them via YAML frontmatter (no path/rename changes)
- [ ] Manual smoke: open a new session; the injected context teaches Tailwind + themes.css + primitive-first — not the adapter or globals.css patterns

## Alignment / Cross-Epic Hooks

- **Independent epic** — no deps on any in-flight epic. Ships in Wave 1 of Phase 47.
- **Unblocks E195** (new design-system skill) — E195 will cross-reference the corrected `client-patterns.md` CSS section; a stale section there would conflict with the new skill's guidance.
- **Reuses Stop-verifier rule awareness** — the updated skills explicitly cite Rules #21/#22 rather than re-implementing enforcement; the hook layer already owns enforcement, the skills own teaching.
- **Closes the E161 adapter-removal tail** — E161 deleted the server code and client wrappers (PR #134) but left the skill layer uncleaned; this epic closes that tail formally.
- **Closes the E167 Tailwind-landing tail** — E167 shipped Tailwind; skills never caught up; this closes it.

## Out of Scope

- Deeper rewrite of deploy/launch stack-coupled skills (`deploy-gcr-zeabur.md`, `launch-checklist.md`) — separate deferred item
- Adding a new design-system skill that teaches the Preset recipe book — that is E195
- Updating `MEMORY.md` or Tier 0 files to reflect skill corrections — those are already accurate (MEMORY.md "CSS Architecture" section is correct); only the auto-injected skills need fixing
- Automated staleness detection for skill files (a future /athena:learn enhancement) — out of scope for this surgical purge

## Provenance

- Spec source: 2-workflow enhancement audit (athena-enhancement-research + ultracode-into-athena), 2026-05-30
- Approved via `/athena:plan approve E193,E194,E195,E196,E197` on 2026-05-30 (Cycle 21); Phase 48/49 rendered same day under "no limit 5 epics" override
