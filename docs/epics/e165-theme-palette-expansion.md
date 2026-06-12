# E165 — Theme Palette Expansion (rose + forest + docs)

> Phase 42 — Visual Enrichment | Size: S (3 SP) | Deps: none
> Source: Claude Design enrichment plan (`docs/design/claude-design-enrichment.md`) — spike validated on 2026-04-24

## Problem

The template ships with 4 themes (dark, indigo, navy, sage) defined via a strict 47-var CSS contract in `client/src/styles/themes.css`. The header of that file explicitly invites AI-generated extension: *"paste this file into any AI tool and ask 'generate a pink theme.'"*

Despite the invitation, no one had ever exercised that path end-to-end. Two gaps:

1. **No real palette diversity** — all 4 themes lean cool (dark/indigo/navy/sage). No warm editorial option, no high-contrast green dark-mode.
2. **No authoring guide** — `docs/design/css-architecture.md` documents the *existing* themes but doesn't spell out the process for adding a new one (var contract, ThemeProvider wiring, LandingPage `THEME_CARDS` entry, test updates).

## Solution

Productize the spike landed on `claude/review-claude-design-qM0XI` (commit `89961d0`):

1. **Two new themes** shipped with the full 47-var contract:
   - `rose` — warm editorial, coral/pink primary (`#E11D48`), amber accent, serif display font
   - `forest` — dark grounded, green primary (`#22C55E`), amber accent, same typography family as `dark`
2. **Author guide** added to `docs/design/css-architecture.md` describing the 5-step process: define block → extend `Theme` type → extend `VALID_THEMES` + `THEME_OPTIONS` → add `THEME_CARDS` entry → add data-theme assertion test.
3. **Close the pipeline** — move the spike through `/athena:qa` and merge.

## Key Files

| File | Action | Status |
|------|--------|--------|
| `client/src/styles/themes.css` | Edit — +2 blocks (`[data-theme="rose"]`, `[data-theme="forest"]`) | ✅ spike 89961d0 |
| `client/src/components/ThemeProvider.tsx` | Edit — extend `Theme` union, `VALID_THEMES`, `THEME_OPTIONS` | ✅ spike 89961d0 |
| `client/src/pages/LandingPage.tsx` | Edit — +2 entries in `THEME_CARDS` | ✅ spike 89961d0 |
| `client/src/components/__tests__/ThemeProvider.test.tsx` | Edit — +2 data-theme assertions, option count 5→7 | ✅ spike 89961d0 |
| `docs/design/css-architecture.md` | Edit — new "Adding a Theme" section (5 steps) | ⬜ todo |
| `docs/design/claude-design-enrichment.md` | Edit — update "Status" to reflect E165 closure | ⬜ todo |

## Implementation

The spike already landed the runtime deliverable. Remaining work is documentation + quality gates:

1. Run `/athena:qa` on the branch — confirm `@reviewer` accepts the theme additions and `@qa` accepts the two added tests (already 275/275 green locally).
2. Author "Adding a Theme" section in `docs/design/css-architecture.md`:
   - Step 1: add `[data-theme="<name>"]` block with full 47-var contract
   - Step 2: extend `Theme` union + `VALID_THEMES` set + `THEME_OPTIONS` array in `ThemeProvider.tsx`
   - Step 3: add `THEME_CARDS` entry (id, label, 4-color swatch) in `LandingPage.tsx`
   - Step 4: add one `data-theme` assertion test in `ThemeProvider.test.tsx` and update the option count
   - Step 5: run `scripts/checks/css-var-check.sh` to verify no drift
3. Update proposal doc status from "Proposal only" → "Spike + E165 landed. Other targets (E166 for talk deck) planned."
4. Merge via PR.

## Alignment / Cross-Epic Hooks

- **Does not add** agents, commands, or Stop-verifier rules. Pure content expansion on existing infrastructure.
- **Uses** Stop-verifier Rule #17 (CSS var drift) to self-validate — spike already confirmed no new drift.
- **Reads from**: `themes.css` existing blocks (as templates), `css-architecture.md` (extends it).
- **Writes to**: `themes.css`, `ThemeProvider.tsx`, `LandingPage.tsx`, `ThemeProvider.test.tsx`, `css-architecture.md`.
- **Complements E163** (design-to-code pipeline). E163 generates *pages*; E165 expands the *palette* those pages can render in. Both rely on the same token contract.
- **Does not depend on E163** — lands independently.

## Acceptance Criteria

- [ ] `/athena:qa` passes on the branch (reviewer + qa + evaluator if run)
- [ ] `scripts/checks/css-var-check.sh` reports no new undefined references introduced by rose/forest blocks
- [ ] All 7 themes selectable via the landing-page `THEME_CARDS` grid without visual regression on existing themes
- [ ] `docs/design/css-architecture.md` contains a step-by-step "Adding a Theme" guide that a new contributor could follow end-to-end
- [ ] `docs/design/claude-design-enrichment.md` status reflects E165 closed + E166 planned
- [ ] PR merged to main; Stop verifier clean

## Out of Scope

- **Light/dark auto-switching per theme** — each theme fixes its own light/dark-ness. A future epic could add per-theme light/dark variants.
- **Theme authoring UI in the app** — only developer-facing for now.
- **Hero refresh** — subsumed by E163 once `@designer` agent lands; no separate epic.
- **Additional themes beyond rose + forest** — reconsider after observing real usage of the two new ones.
