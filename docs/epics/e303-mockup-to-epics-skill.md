# E303 — Mockup-to-Epics Skill + /athena:plan mockup

> Phase 71 · toolchain enrichment · Claude Design integration
> Status: ⬜ pending

## Problem

When a user hands off a Claude Design / HTML-CSS-JS mockup bundle, there is no defined pipeline to translate it into UI-ready, build-grade epics. The current `/athena:plan` only handles text brainstorming — not visual design bundles.

The gap: epics written without reading the actual design source drift from the design. They describe intent ("build the case list") but miss the answers that already live in the source: exact field names, validation rules, RBAC-gated rendering, layout dimensions, copy strings, empty/error states. The build agent then re-guesses — and produces drift.

## Solution

1. **`.claude/skills/mockup-to-epics/SKILL.md`** — complete skill covering:
   - Read handoff README + PRD + domain doc (rules SSOT)
   - Run + screenshot prototype via `node scripts/mockup/shot.cjs` (every screen × role + modals + mobile)
   - Read source IN FULL (per-screen subagents)
   - Inventory codebase for reuse (schema, RBAC, DataTable, Dialog)
   - Write epics from `docs/epics/_templates/ui-spec-epic.md` (with exact: fields/validation, layout, RBAC matrix, modal tables, style mapping → shadcn/Tailwind)
   - UI-foundation epic first (missing shadcn parts + design tokens gate everything)
   - Quality bar: could a build agent implement pixel-aligned without opening the mockup?

2. **`scripts/mockup/shot.cjs`** — Playwright screenshot helper for static HTML prototypes (file:// or http.server)
   - Every screen × role + key modals + mobile (390px)
   - Persists shots into repo (durable reference for epics)

3. **`scripts/mockup/tour-app.cjs`** — Playwright logged-in tour for the running app
   - Used by `user-guide-builder` (E305) for per-item screenshots
   - Logs in via credentials form, walks every page → tab → modal

4. **`/athena:plan mockup <path>` subcommand** — update `plan.md` command to invoke `mockup-to-epics` skill when `$ARGUMENTS` starts with `mockup`

## Key Files

- `.claude/skills/mockup-to-epics/SKILL.md` (NEW) — complete mockup-to-epics skill
- `scripts/mockup/shot.cjs` (NEW) — Playwright screenshot helper (static HTML)
- `scripts/mockup/tour-app.cjs` (NEW) — Playwright logged-in app tour (running dev server)
- `.claude/commands/athena/plan.md` — add `mockup <path>` subcommand section

## Implementation

### Phase 1 — Scripts
- Write `scripts/mockup/shot.cjs`:
  - Takes `<abs-path-to-html>` + `<out-dir>` + optional `[tour.json]`
  - Launches Playwright/Chromium (ships with `next-app`)
  - Captures every page, key modals, role variants, mobile viewport
  - Persists PNGs into out-dir; prints ✓/✗ ledger
- Write `scripts/mockup/tour-app.cjs`:
  - Logs in as admin (and optionally other roles via env)
  - Walks every dashboard page → every tab → key modals
  - Captures PNGs into `dev-docs/public/screenshots/`

### Phase 2 — Skill
- Port `mockup-to-epics/SKILL.md` from pm reference
- Adapt to this template's codebase paths + DataTable pattern + CLAUDE.md rules
- Ensure the quality bar and shadcn/Tailwind style mapping sections are complete

### Phase 3 — Command update
- Add `mockup <path>` section to `.claude/commands/athena/plan.md` command
- Update CLAUDE.md slash commands table to show `mockup` subcommand
- Add `mockup-to-epics` to the key skills list in CLAUDE.md

## Acceptance Criteria

- [ ] `.claude/skills/mockup-to-epics/SKILL.md` exists and covers all 6 pipeline steps
- [ ] `scripts/mockup/shot.cjs` runs (`node scripts/mockup/shot.cjs <html> <out-dir>`) — needs Playwright
- [ ] `scripts/mockup/tour-app.cjs` documented (runs against dev server on port 3000)
- [ ] `/athena:plan mockup <path>` invokes the mockup-to-epics skill
- [ ] CLAUDE.md updated with the new subcommand

## Out of Scope

- Automatic epic file generation from mockup scan (human review of epics required)
- Figma or Sketch integration (HTML/Claude-Design bundles only)
- Running the scripts in CI (local tool, not CI-gated)
