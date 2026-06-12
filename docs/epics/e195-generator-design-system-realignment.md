# E195 — Generator + Design-System Realignment

> Phase 47 — Foundation Truth | Size: M (8 SP) | Deps: E194

## Problem

Two generator commands produce page-co-located CSS that the project's own Stop verifier hard-blocks. `.claude/commands/athena/design.md` line 53 instructs `@designer` to write a `Page.css` file under `client/src/pages/<slug>/`, and `.claude/commands/athena/domain.md` Step 8 (around line 99) emits a `{{PASCAL_PLURAL}}.css` file under `client/src/pages/{{KEBAB_PLURAL}}/`. Stop-verifier Rule #21 (`scripts/hooks/stop-verifier.sh`) blocks any newly-staged file matching `client/src/pages/**/*.css` — meaning a freshly generated page is **un-committable** without bypassing the project's own invariant. This has been the case since E176 merged and Rule #21 was activated.

Additionally, `design.md` line 50 directs `@designer` to draw design tokens from `client/src/styles/common/` — a path that CLAUDE.md explicitly names as "near-empty" and "frozen" (post-E170/E173/E178 trims). The canonical token sources are `docs/design/design-system.css` and `themes.css`, yet the generator command still cites the frozen path.

The project's single most-enforced architectural invariant — primitive-first composition across 40 `components/ui/` primitives via the Preset axis (`components/ui/preset.ts`) × Theme axis (`styles/themes.css`) — has no auto-loaded skill to pre-empt violations. The skills fixed in E194 previously taught the opposite pattern. Without a dedicated skill, agents encountering page-styling work default to the wrong mental model and regenerate the same Rule #21/22 violations.

## Solution

Four coordinated changes that close the generator → Stop-verifier gap without touching runtime code:

1. **Fix `design.md`** — rewrite the styling instruction in Step 3 (around line 50–55) to emit Tailwind classes + `components/ui/` Preset slots; remove the `Page.css` output step; point token source at `docs/design/design-system.css` and `themes.css`.

2. **Fix `domain.md`** — rewrite Step 8 to scaffold styling via Tailwind utility classes inline in the TSX template; remove the `{{PASCAL_PLURAL}}.css` template emit; remove or stub the `docs/templates/domain/client/page.css.tmpl` reference.

3. **Retire `docs/templates/domain/client/page.css.tmpl`** — replace file contents with a tombstone comment block directing authors to `components/ui/` Preset slots. Do not delete (preserves git history and makes the redirect self-documenting).

4. **New skill `.claude/skills/design-system.md`** — primitive-first composition skill. Auto-loaded at SessionStart (joins existing skills). Carries: the 40-primitive inventory surface, Preset × Theme recipe, Rules #21/#22 constraint summary, and canonical token source paths. Trigger phrases: "add a page", "style a", "new page", "tsx page", and `@designer` invocations.

## Key Files

| File | Action |
|---|---|
| `.claude/commands/athena/design.md` | Edit — Step 3/line 50–55: token source → `design-system.css`+`themes.css`; remove `Page.css` emit |
| `.claude/commands/athena/domain.md` | Edit — Step 8/~line 99: remove `{{PASCAL_PLURAL}}.css` emit; inline Tailwind in TSX template |
| `docs/templates/domain/client/page.css.tmpl` | Retire — replace with tombstone comment redirecting to `components/ui/` Preset slots |
| `.claude/skills/design-system.md` | New — primitive-first skill: 40 primitives, Preset×Theme recipe, Rules #21/#22 |

## Implementation

1. Read `design.md` in full; identify the `Page.css` output step and `styles/common/` token reference; patch both in a single edit; verify no other lines still reference page-level CSS.
2. Read `domain.md` in full; locate Step 8 and the `{{PASCAL_PLURAL}}.css` emit block; replace with a commented Tailwind inline-class pattern in the TSX template stub; remove the `page.css.tmpl` file reference.
3. Read `docs/templates/domain/client/page.css.tmpl`; overwrite with a tombstone header comment (2–5 lines) explaining the deprecation and pointing to `components/ui/preset.ts` Preset slots.
4. Author `.claude/skills/design-system.md` with: trigger phrases, the primitive-first rule, a canonical `components/ui/` import example, the Preset × Theme recipe (one compact table), the two token-source paths, and explicit Rules #21/#22 constraint language.
5. Confirm `.claude/skills/design-system.md` is in `.claude/skills/` — Claude Code auto-loads all `*.md` files in that directory at session start without any explicit registration.
6. Smoke-test mentally: trace `/athena:design my-page "a simple page"` through the patched `design.md` and confirm no `*.css` file would be emitted; repeat for `/athena:domain NAME=widgets`.
7. Update CLAUDE.md skills inventory count if it lists the number of auto-loaded skills.

## Acceptance Criteria

- [ ] Running `/athena:design <slug> "<desc>"` per the patched `design.md` produces **zero** `client/src/pages/**/*.css` output steps — Stop Rule #21 is satisfied without bypass
- [ ] Running `/athena:domain NAME=<x>` per the patched `domain.md` scaffolds **zero** `client/src/pages/**/*.css` files — Stop Rule #21 is satisfied without bypass
- [ ] `design.md` token-source reference points to `docs/design/design-system.css` + `themes.css`; `client/src/styles/common/` is no longer cited as a canonical source
- [ ] `docs/templates/domain/client/page.css.tmpl` contains a tombstone comment (not the original CSS template); the file is NOT deleted from the repository
- [ ] `.claude/skills/design-system.md` exists and explicitly references Rules #21 and #22 and the Preset × Theme axes
- [ ] `.claude/skills/design-system.md` lists trigger phrases and includes a concrete `components/ui/` import + Preset-slot usage example
- [ ] The new skill is in `.claude/skills/` and will be auto-loaded by Claude Code at SessionStart (no manual registration needed)
- [ ] CLAUDE.md skills count (if enumerated) is updated to reflect the new skill file

## Alignment / Cross-Epic Hooks

- **Deps**: E194 (fixes the upstream skill gap that taught the wrong pattern; E195 closes the generator side of the same class of violations).
- **Unblocks**: any Phase 47+ epic that generates new pages — generated pages will now commit clean past Rules #21/#22 without manual intervention.
- **Reuses**: Stop-verifier Rule #21 (`scripts/hooks/stop-verifier.sh`) and Rule #22 are the enforcement layer — E195 brings the generators into compliance; no hook changes needed.
- **Reuses**: `components/ui/preset.ts` + the 40-primitive library established in E167–E176; the skill documents the existing API, not a new one.

## Out of Scope

- Migrating the legacy `client/src/pages/dashboard/DashboardLayout.css` (kept intentionally for VRT / e2e / a11y compat — explicitly listed in CLAUDE.md)
- Adding new `components/ui/` primitives or modifying existing Preset slots
- Consolidating deploy or launch skills (separate concern)
- Modifying `scripts/hooks/stop-verifier.sh` Rule #21 logic — rule stays as-is; generators must conform to it

## Provenance

- Spec source: 2-workflow enhancement audit (athena-enhancement-research + ultracode-into-athena), 2026-05-30
- Approved via `/athena:plan approve E193,E194,E195,E196,E197` on 2026-05-30 (Cycle 21); Phase 48/49 rendered same day under "no limit 5 epics" override
