# E166 — Talk-Deck SVG Diagram Set

> Phase 42 — Visual Enrichment | Size: S (3 SP) | Deps: none
> Source: Claude Design enrichment plan (`docs/design/claude-design-enrichment.md`)

## Problem

`talk.html` is the canonical external-facing artifact for the template (recent active work on branch `feat/talk-presentation` — 37 slides, 6 SVG diagrams already landed via `df72cc6`). Three high-value architectural concepts still render as text walls rather than diagrams:

1. **Agent team shape** — 10 agents, their model assignments (opus vs sonnet), and their write-back files
2. **Epic pipeline flow** — `spec → implement → qa → commit → merge` with the human-gate checkpoints (`/athena:plan`, `/athena:qa`)
3. **Stop-verifier gate** — 18 rules, blocking vs advisory split, how Rule #18 ties into `epic-progress.md`

Each is currently explained in prose. Prose does not survive a 30-second slide.

## Solution

Ship 3 new SVG diagrams and wire them into `talk.html` as replacements for the matching text sections. Follow the same hand-authored-SVG style as the 6 existing diagrams (inline `<svg>`, theme-token fills via CSS vars, accessible `<title>`/`<desc>` children).

## Key Files

| File | Action |
|------|--------|
| `talk.html` | Edit — replace 3 text sections with `<svg>` diagrams; add `<figcaption>` for each |
| `docs/presentations/assets/agent-team.svg` | New — standalone source file for re-use outside the talk (Mermaid or Excalidraw export OK) |
| `docs/presentations/assets/epic-pipeline.svg` | New |
| `docs/presentations/assets/stop-verifier-gate.svg` | New |
| `docs/design/claude-design-enrichment.md` | Edit — mark talk-deck target as closed |

## Implementation

Three diagrams, each with the same structure:

### Diagram 1 — Agent Team (10 agents)

- Center node: `@orchestrator`
- 9 surrounding nodes grouped into 3 clusters:
  - **Specification**: `@spec-writer`, `@best-practice`, `@strategist`
  - **Quality**: `@reviewer`, `@qa`, `@evaluator`, `@debugger`
  - **Lifecycle**: `@deployer`, `@memory-curator`
- Each node carries a badge: `opus` (6 nodes) vs `sonnet` (4 nodes)
- Arrows show write-back file ownership (from agent → `docs/context/*.md`)

### Diagram 2 — Epic Pipeline Flow

- Linear flow: `/athena:plan` → `spec` → `implement` → `qa` → `commit` → `merge`
- Human-gate markers (🙋) on `/athena:plan` approval and on PR merge
- Side-channel arrow showing `@debugger` auto-triggered on failed tests, looping back to `implement`
- Bottom rail: `epic-progress.md` step matrix with ⬜/🔄/✅ tokens

### Diagram 3 — Stop-Verifier Gate

- 18 rules in a 3×6 grid
- Color-coded: red border = blocking (Rules 1–7, 13, 18), gray border = advisory
- Callout on Rule #18 showing its connection to `epic-progress.md` (`impl=✅ ∧ qa=⬜` → refuse Stop)

All three diagrams:
- Use CSS variables for fills/strokes (`var(--primary)`, `var(--accent)`, `var(--border)`, `var(--text-primary)`)
- Render correctly in all 6 themes (dark/indigo/navy/sage/rose/forest) once inlined — verify by toggling theme in the talk's theme picker
- Include `<title>` + `<desc>` for screen-reader a11y

## Alignment / Cross-Epic Hooks

- **Does not add** agents, commands, or Stop-verifier rules.
- **Consumes E165's palette** — the 3 diagrams render in any of the 6 themes because they reference CSS vars only. No hardcoded hex.
- **Reads from**: existing 6 SVGs in `talk.html` (style guide), `scripts/hooks/CLAUDE.md` (Rule #18 copy), `.claude/agents/*` (agent roster).
- **Writes to**: `talk.html`, `docs/presentations/assets/*.svg`.
- **Does not depend on E163** — manual authoring is fine for a 3-diagram scope; if E163 ships first, `/athena:design` could accelerate the authoring, but this epic doesn't wait for it.

## Acceptance Criteria

- [ ] 3 new `.svg` files under `docs/presentations/assets/`, each with `<title>` + `<desc>`
- [ ] `talk.html` replaces the matching 3 text sections with inlined SVGs
- [ ] `scripts/checks/css-var-check.sh` reports no new undefined references
- [ ] Visual smoke: open `talk.html` in 6 themes (dark/indigo/navy/sage/rose/forest), all diagrams legible, contrast meets WCAG AA
- [ ] Build passes (`bee9f45`'s `build.sh` still produces a clean `talk.html` delivery version)
- [ ] `docs/design/claude-design-enrichment.md` marks talk-deck target as closed

## Out of Scope

- Rewriting or restyling the 6 existing diagrams
- Animating the diagrams (static SVG only)
- Exporting `.pptx` or Canva versions (can be added later via Claude Design's export once that path is proven)
- Non-English localisation of diagram labels — follow whatever locale the host section uses
