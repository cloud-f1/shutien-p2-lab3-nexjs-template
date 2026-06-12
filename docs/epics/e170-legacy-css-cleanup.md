# E170 — Legacy CSS Cleanup + Design System Doc Sweep

> Phase 43 — Universal Design System Adoption | Size: S (3 SP) | Deps: E167, E168, E169

## Problem

After E167 + E168 + E169 land, **page-co-located CSS files are deleted inline** by their migration epic (E168 deletes `LandingPage.css`, `Legal.css`, `GettingStarted.css`; E169 deletes `AuthPages.css`). What remains after Phase 43 is a different layer of cleanup that no migration epic owns:

| Artifact | Why it's stale | Owned by |
|---|---|---|
| `client/src/pages/auth/components/` | Components promoted to `components/ui/` in E169; directory empties out | E170 — directory removal after E169 PR merges |
| Legacy `.btn-*`, `.form-*`, `.c-*` rules in `styles/common/*.css` | Superseded by Tailwind utilities + `<Button>` / `<FormField>` / `<Card>` primitives | E170 — trim file-by-file |
| `client/src/styles/common/forms.css` `.form-toggle` rule | Superseded by `<Toggle>` (E173) | E170 — gated on E173 acceptance |
| Bespoke `.settings-modal-*` rules (location TBD) | Superseded by `<Modal>` (E174) | E170 — gated on E174 acceptance |
| `docs/design/css-architecture.md` | Documents the file layout that no longer exists post-cleanup | E170 — full rewrite |
| `@designer` agent prompt (E163) | Still references `client/src/styles/common/` instead of `components/ui/` | E170 — prompt edit |
| `CLAUDE.md` (root + client) | Architecture rules section pre-dates Preset axis + primitive-first conventions | E170 — references update |
| Stragglers from E168/E169 (anything they couldn't delete inline because grep found a stray reference) | E168/E169 acceptance criteria say "deferred to E170 if grep finds a stray reference" | E170 — catch-all sweep |

**Stale-artifact ownership matters** because if E170 also tries to delete the page CSS files, two epics race for the same `git rm` and the timeline ambiguity blocks `/athena:batch`. The split is: **migration epic deletes the CSS file inline once its grep is empty; E170 handles the cross-cutting cleanup that no single migration owns.**

Leaving them in place causes three problems:
1. **Confusion** — new contributors find two ways to do the same thing.
2. **Drift risk** — someone edits a legacy class, thinking it's live, and no page actually consumes it.
3. **Bundle waste** — every legacy CSS file ships in the build.

## Solution

A focused cleanup epic that runs *after* the migrations. Three deliverables:

1. **Delete orphan CSS files** — only after `grep` proves zero references in any `.tsx`.
2. **Trim `styles/common/*.css`** — keep only the rules that primitives still depend on (e.g. `view-enter` animation). Remove `.btn`, `.form-*`, `.c-*` variants superseded by Tailwind primitives.
3. **Doc sweep** — rewrite `css-architecture.md` to reflect the new layout; update `@designer` agent prompt; update `CLAUDE.md` references.

## Key Files

| File | Action |
|---|---|
| `client/src/pages/auth/components/` | **Delete** (directory empty after E169 promotion of FormBanner/PasswordField/SocialButtons to `components/ui/`) |
| `client/src/styles/common/buttons.css` | Trim — remove variants now superseded by `<Button>` primitive |
| `client/src/styles/common/forms.css` | Trim — `.form-toggle` deletable after E173 ships `<Toggle>`; keep `.form-input` / `.form-select` if `<FormField>` consumers still use them as raw inputs |
| `client/src/styles/common/cards.css` | Trim — `.c-card`, `.c-panel`, `.c-badge` deletable after E178 ships `<Card>` |
| `docs/design/css-architecture.md` | **Rewrite** — file layout reflects post-cleanup state; explain the relationship to `design.md` (theme axis vs primitives + preset axis) |
| `docs/design/design.md` | Edit — § 7 migration table all ✅; § 10 anti-pattern checklist updated to match reality |
| `.claude/agents/designer.md` (E163) | Edit — reference `components/ui/` primitives, not `pages/*.css` |
| `client/CLAUDE.md` | Edit — file conventions section reflects post-cleanup directory layout |
| `CLAUDE.md` (root) | Edit — "Architecture Rules" section mentions Preset axis + primitive-first |
| Catch-all CSS stragglers from E168/E169 | Audit any `*.css` file under `client/src/pages/`; if grep returns 0 references, delete (E168/E169 should have caught these but human-error backstop) |

## Implementation

1. **Audit phase** (~30 min):
   - For each candidate file: `grep -rn '<class-name-here>' client/src --include='*.tsx'` — confirm zero references.
   - Build a delete-list with grep evidence per file. Log to a scratch doc; commit nothing yet.
2. **Delete phase** (~30 min):
   - One commit per deleted file group (all CSS deletions in commit 1; component-directory deletions in commit 2).
   - After each commit, run `pnpm test:run` and `pnpm build` — no regression.
3. **Trim phase** (~1 h):
   - Remove rules from `styles/common/*.css` that have zero references. Re-run grep + build.
4. **Doc sweep** (~1 h):
   - Rewrite `css-architecture.md` (target ≤ 100 lines — current is 235).
   - Update `design.md` § 7 (migration status) and § 10 (anti-patterns).
   - Update `@designer` agent prompt and `CLAUDE.md` references.
5. **Final audit** (~15 min):
   - `find client/src -name '*.css'` — should return only `globals.css`, `themes.css`, `fonts.css`, `common/*.css` (trimmed), `DashboardLayout.css`, `Dashboard.css`. No page-co-located CSS files.

## Acceptance Criteria

- [ ] `pages/auth/components/` directory deleted (consumers promoted by E169)
- [ ] No `*.css` files remain under `client/src/pages/` (page-CSS deletions owned by E168/E169 inline; E170 catches stragglers)
- [ ] `styles/common/*.css` trimmed; remaining rules all have at least one consumer (provable via grep)
- [ ] `css-architecture.md` rewritten ≤ 100 lines, accurately describes the post-cleanup layout
- [ ] `design.md` § 7 migration table reads "✅ Migrated" for every surface
- [ ] `@designer` agent prompt updated to reference `components/ui/` primitives
- [ ] `CLAUDE.md` (root + client) updated to reflect new structure
- [ ] Bundle-size sanity check: CSS bundle ≤ 65 kB gzipped (post-cleanup should be smaller, not bigger)
- [ ] All tests pass; build green; Stop-verifier clean

## Alignment / Cross-Epic Hooks

- **Hard-depends on E167, E168, E169** — cannot trim `styles/common/*.css` or update docs until every page-level migration is done.
- **Soft-depends on E173** — `.form-toggle` deletion gates on `<Toggle>` shipping in Phase 44.
- **Soft-depends on E174** — `.settings-modal-*` (and any other inline-modal CSS) deletion gates on `<Modal>` shipping in Phase 44.
- **Soft-depends on E175** — `DashboardLayout.css` cleanup is owned by E175 itself (not E170); E170 only cleans page CSS + `styles/common/*.css`.
- **Soft-depends on E178** — `.c-card`, `.c-panel`, `.c-badge` deletion gates on `<Card>` shipping in Phase 44.
- **Closes the loop opened by E167** — E167 promised "no new page CSS"; the migration epics (E168/E169) make good by deleting the page files inline; E170 makes good for the cross-cutting layer (`styles/common/*.css`, doc rewrite, agent prompt).
- **Updates @designer (E163)** so future AI-generated pages target the new primitive layout, not legacy CSS classes.
- **Soft-depends on E171** for risk reduction — Playwright visual tests give confidence that deletion didn't change rendering.

## Out of Scope

- **Refactoring `DashboardLayout.css`** — owned by E175 (DashboardLayout decomposition), which trims it as part of its primitive-extraction work. E170 does NOT touch this file.
- **Deleting page-level CSS files** (`LandingPage.css` / `Legal.css` / `GettingStarted.css` / `AuthPages.css`) — owned by E168 / E169 inline, deleted in the same PR as their page migration. E170 only catches stragglers.
- **CSS-in-JS migration** — explicitly NOT this epic. We're cleaning up legacy CSS, not changing the styling philosophy.
- **Build-tool changes** — Tailwind + PostCSS already in place from E167; no new tooling.
