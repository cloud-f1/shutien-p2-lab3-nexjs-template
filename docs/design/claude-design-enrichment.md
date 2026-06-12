# Claude Design — UI Enrichment Plan

> How we use Anthropic Labs' Claude Design (Opus 4.7) to enrich this template's
> visual surface without breaking the CSS-var contract or TDD workflow.

---

## Why

Claude Design ingests a codebase + design system, then generates visuals
(prototypes, slides, one-pagers) exportable as HTML / SVG / PPTX / Canva /
Claude Code. It is a generator, not a runtime — so integration is one-way:
design → port into `client/` under the usual review gates.

This project already has a theme-token design system (`client/src/styles/themes.css`,
4 themes, 47 vars) that is explicitly AI-generation friendly. Claude Design
is a natural fit for expanding that system and the marketing surface.

---

## Enrichment Targets (ranked by ROI)

| # | Target | Input to Claude Design | Output | Effort |
|---|--------|------------------------|--------|--------|
| 1 | **Theme expansion** | `client/src/styles/themes.css` | 2–4 new `[data-theme="…"]` blocks | S |
| 2 | **Landing page refresh** | `LandingPage.tsx` + `.css` + screenshot | HTML hero/features/CTA, port class-by-class | M |
| 3 | **Talk deck visuals** | `talk.html` + existing 6 SVG diagrams | New SVG/PPTX diagrams (agent team, epic pipeline, stop-verifier) | S |
| 4 | **Empty states + icons** | Dashboard pages, theme palette | Illustration set per theme | M |
| 5 | **README / social previews** | README + architecture | OG image, hero diagram | S |

---

## Guardrails

These are non-negotiable — every Claude Design output must pass them before merge.

1. **CSS-var contract** — no hardcoded hex in components. Stop-verifier Rule #17
   (css-var-drift) already enforces this.
2. **Theme completeness** — new themes must define the full variable contract
   (match the `[data-theme="dark"]` block exactly).
3. **TDD** — generated UI is scaffolding, not skip-the-test. New components
   still go through `/athena:implement`.
4. **Review gate** — every visual PR runs `/athena:qa --review-only`
   (invokes `frontend-review` skill).
5. **No localStorage, no inline `staleTime`, no `fireEvent`** — standard client
   rules still apply.
6. **Folder names** — generated code drops into `client/`, never `frontend/`.

---

## Recommended First Experiment

Low-risk, high-signal validation before committing to a larger track:

1. Upload `client/src/styles/themes.css` + a screenshot of `LandingPage`
   to Claude Design.
2. Prompt: *"Generate two new themes (rose, forest) matching this variable
   contract, plus a refreshed landing hero using the dark theme."*
3. Export HTML → branch `feat/claude-design-themes` → port tokens into
   `themes.css`, port hero markup into `LandingPage.tsx`.
4. Run `pnpm test`, `/athena:qa --review-only`, visual smoke in dev server.
5. Merge if all gates pass.

**Success criteria**: Two new themes selectable via `<ThemeProvider>`,
landing page visually refreshed, zero CSS-var drift violations, all 273
client tests green.

---

## Not In Scope

- Replacing Figma/design tooling for engineers — this is a generator, not
  a runtime editor.
- Auto-committing Claude Design output — every change is human-reviewed.
- Extending `@spec-writer` to accept visual specs — possible future epic,
  deferred until the export-to-Claude-Code workflow is proven on theme
  expansion first.

---

## Status

**Spike validated 2026-04-24** (commit `89961d0` on branch
`claude/review-claude-design-qM0XI`):

- Two new themes (rose, forest) landed with full 47-var contract
- 275/275 client tests pass (+2 new data-theme assertions)
- `scripts/checks/css-var-check.sh` reports no new drift
- Go-signal confirmed — theme contract accepts new themes cleanly

**Epics opened (Phase 42 — Visual Enrichment):**

| Epic | Target | Status |
|------|--------|--------|
| [E165](../epics/e165-theme-palette-expansion.md) | Theme palette expansion (rose + forest + docs) | ✅ Closed (rose + forest landed via spike `89961d0`; "Adding a Theme" guide added to `css-architecture.md`) |
| [E166](../epics/e166-talk-deck-svg-diagrams.md) | Talk-deck SVG diagram set | ✅ Closed (3 inline SVGs landed in `talk.html` — agent-team / epic-pipeline / stop-verifier-gate; standalone source files under `docs/presentations/assets/`) |

**Subsumed by E163** (Phase 41 — design-to-code pipeline):
- Landing page + hero refresh — will flow through `/athena:design` once `@designer` agent lands
- Dashboard empty states + icons — same pathway

**Deferred / out-of-scope:**
- README / social previews — minor ops task, no epic opened
