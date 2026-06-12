# E215 — WCAG AA Extension Guide for Custom Domains

> Phase 51 — Stabilize + Phase 2 Foundation | Size: M (8 SP) | Deps: none

## Problem

E177 proved the template a11y-clean (zero axe-core violations across 14 routes), but it **explicitly fenced extension guidance out of scope** — and never shipped the contributor doc. A fork that adds its own domain has no written guide for keeping new surfaces WCAG AA.

Concrete evidence:

- E177's Out of Scope and Key Files both punt the contributor guide. `docs/epics/e177-a11y-audit-sweep.md:48` lists `docs/guides/en/accessibility.md` as a "New" deliverable, but `docs/design/A11Y_BASELINE.md:183-184` then re-files it as **deferred**: "Contributor guide (`docs/guides/en/accessibility.md`) — the in-spec comment block + this doc cover the immediate need; expand if drift surfaces." Verified: neither `docs/guides/en/accessibility.md` nor `docs/guides/zh-TW/accessibility.md` exists today.
- The a11y proof is **single-cell**. `client/e2e/a11y-primitives.spec.ts:51` pins every scan to `{ theme: "dark", preset: "default" }`, and `docs/design/A11Y_BASELINE.md:41-43` states the 6-theme × 2-preset cross-product is deferred. So a fork that re-themes (or adds a domain page on a non-default theme) has **no guidance** on how its custom token values stay above the 4.5:1 / 3:1 WCAG AA contrast bars.
- Forks genuinely add surfaces. `make new-domain NAME=x` (`Makefile:297-299` → `scripts/new-domain.sh`) and `/athena:domain` (`.claude/commands/athena/domain.md`) scaffold full-stack domains — new pages, new tables, new icon-only buttons — none of which the template's a11y matrix knows about.
- The recipes that *do* exist are debug-oriented, not extension-oriented. `docs/design/A11Y_BASELINE.md:133-142` lists "common offenders" for fixing a *failing* template scan, but says nothing about how a fork author extends the scan to their own routes, picks contrast-safe token values for a brand-new theme, or wires aria/keyboard patterns into a custom primitive.

Net: the template is a11y-clean but the knowledge is locked in the test code and a debug-focused baseline doc. A fork adding a domain has to reverse-engineer the a11y contract from `a11y-runner.ts` and `themes.css` rather than read a guide.

**Critic note:** demand for this guide is *inferred* (no fork user has filed a request) — it is a trim candidate. It ships as docs-only, no code, so its blast radius is zero; the value is making the a11y story self-serve for the documented fork path.

## Solution

Ship one bilingual contributor guide (en + 繁體中文) that turns E177's locked-in a11y contract into a step-by-step extension playbook for fork authors.

1. **Document the existing contract** — point to the live machinery (`a11y-runner.ts` WCAG tag set, the 14-route matrix, the `[a11y]` Playwright project) so a fork knows what "AA-clean" already means before extending it.
2. **Extend-the-matrix recipe** — show exactly how a fork adds its new domain route(s) to the a11y sweep (the route list the spec iterates) and its custom primitives to the interaction specs.
3. **Custom-token contrast targets** — a concrete table of the WCAG AA ratios (4.5:1 normal text, 3:1 large text / non-text UI) mapped onto the `themes.css` token contract (`--text-primary` / `--text-secondary` / `--text-muted` against `--surface` / `--surface-2`), with a "how to check a candidate value" workflow for someone adding a 7th theme or re-skinning an existing one.
4. **Keyboard-nav + ARIA patterns** — codify the primitive-first rules the template already follows (icon-only buttons need `aria-label`; dialogs use `<Modal>`/`<Drawer>` focus-trap; live regions use `role="alert"` / `aria-live`; tab order skip-nav → topbar → nav → main) as authoring rules for new custom components.
5. **Bilingual ship** — write `docs/guides/en/accessibility.md` and the 繁體中文 mirror `docs/guides/zh-TW/accessibility.md` (matching every other guide pair in those dirs); cross-link both from `A11Y_BASELINE.md`.

## Key Files

| File | Action |
|---|---|
| `docs/guides/en/accessibility.md` | New — English fork-author a11y extension guide (the deliverable E177 deferred) |
| `docs/guides/zh-TW/accessibility.md` | New — 繁體中文 mirror; keys/sections identical to en, prose translated |
| `docs/design/A11Y_BASELINE.md` | Edit — flip the "Contributor guide … deferred" line (`:183-184`) to a cross-reference pointing at the new guide |
| `docs/epics/e177-a11y-audit-sweep.md` | Edit (optional) — annotate the Out-of-Scope contributor-guide bullet as "shipped in E215" |

## Implementation

1. Read the live a11y contract end to end so the guide is grounded, not invented: `client/e2e/helpers/a11y-runner.ts` (WCAG tag union), `client/e2e/a11y.spec.ts` + `client/e2e/a11y-primitives.spec.ts` (route + interaction matrix), `client/src/styles/themes.css` (the 47-var token contract), and `docs/design/A11Y_BASELINE.md` (the existing recipes).
2. Write `docs/guides/en/accessibility.md` with these sections:
   - **What the template already guarantees** — WCAG 2.1 AA, zero violations, the routes + primitive interactions covered, where the gate runs (`pnpm test:e2e --project=a11y`).
   - **Extend the matrix for your domain** — concrete edit: add your `make new-domain`/`/athena:domain` route to the route list the a11y spec iterates; add a custom primitive to the interaction specs (mirror the Modal/Toast pattern at `a11y-primitives.spec.ts:50-104`).
   - **Custom-token contrast targets** — a ratio table (4.5:1 / 3:1) mapped to `themes.css` text-vs-surface token pairs; a step-by-step "check a candidate hex before you commit it" workflow (e.g. run the contrast scan / use a checker) for adding a theme or re-skinning one.
   - **Keyboard + ARIA authoring rules** — the primitive-first patterns (aria-label on icon buttons, `<Modal>`/`<Drawer>` for focus trap, live-region roles, logical tab order) as DO/DON'T rules for new components.
   - **Debug a violation in your fork** — short pointer back to `A11Y_BASELINE.md` "How to debug a violation".
3. Write `docs/guides/zh-TW/accessibility.md` as a faithful 繁體中文 mirror — identical section structure and headings, prose fully translated (per the user-doc 繁中 rule); keep code fences, file paths, and token names verbatim.
4. Edit `docs/design/A11Y_BASELINE.md:183-184`: replace the "deferred" bullet with a cross-reference line linking both new guides.
5. (Optional) Annotate `docs/epics/e177-a11y-audit-sweep.md` Out-of-Scope contributor-guide note as resolved by E215.
6. Verify: both guide files exist under the two `docs/guides/{en,zh-TW}/` dirs; the en + 繁中 versions have matching headings; every file path / token / command cited in the guide resolves against the real repo (no invented paths); `A11Y_BASELINE.md` no longer claims the guide is deferred.

## Acceptance Criteria

- [ ] `docs/guides/en/accessibility.md` exists and documents (a) what the template already guarantees, (b) how to extend the a11y matrix for a custom domain route, (c) custom-token contrast targets mapped to `themes.css`, (d) keyboard-nav + ARIA authoring patterns
- [ ] `docs/guides/zh-TW/accessibility.md` exists as a 繁體中文 mirror — identical section/heading structure, prose translated, file paths + token names + commands kept verbatim
- [ ] The contrast section states the WCAG AA bars explicitly (4.5:1 normal text, 3:1 large text / non-text UI) and maps them onto real `themes.css` token pairs (`--text-*` against `--surface*`)
- [ ] The matrix-extension section shows the concrete edit to add a new domain route (the route list the a11y spec iterates) and a custom primitive interaction spec, referencing the real Modal/Toast pattern in `a11y-primitives.spec.ts`
- [ ] Every file path, token name, and command cited in both guides resolves against the actual repo (no invented paths)
- [ ] `docs/design/A11Y_BASELINE.md` no longer lists the contributor guide as "deferred" — the bullet is replaced with a cross-reference to the new guide(s)
- [ ] Docs-only: no changes under `client/`, `server/`, `.claude/`, or any test/spec/code file

## Alignment / Cross-Epic Hooks

- **Soft-references E212's matrix mechanism** (cross-theme/preset a11y sweep). E215 is the *human* extension guide; E212 is the *machine* cross-product. They are complementary — the guide can name E212's matrix as the enforcement backstop once it lands, but E215 ships standalone as docs and does **not** hard-depend on E212. If E212 ships first, the guide's matrix-extension section should reference it; if E215 ships first, that reference is a forward note. Soft sequencing only.
- **Closes the E177 tail** — finishes the contributor guide E177 / `A11Y_BASELINE.md` explicitly deferred. Same "make the claim self-serve" intent E177 had for the *test* layer, now applied to the *fork-author* layer.
- **Pairs with E214** (fork-safe secrets / OWASP guide) — same fork-enablement docs theme this cycle; both move buried-in-code knowledge into the `docs/guides/{en,zh-TW}/` self-serve surface. Independent deliverables, no shared files.

## Out of Scope

- **Running or extending the actual a11y test matrix** — E215 documents how a fork extends it; building the cross-theme/preset cross-product is E212's job.
- **Manual screen-reader testing** with NVDA / JAWS / VoiceOver — out of scope per E177; the guide can point at it as a human-gated follow-up, not own it.
- **WCAG AAA** — AA is the bar (consistent with `A11Y_BASELINE.md:27-29`); AAA blocks too many palette choices.
- **Cognitive a11y** (reading-level, attention, memory) — outside axe-core's scope, same as E177.
- **New primitives or token changes** — the guide describes the existing `components/ui/` + `themes.css` contract; it does not add or modify components or tokens.
- **Auto-generating per-fork a11y reports** — find + document, don't tool.

## Provenance

- Spec source: `/athena:plan auto` Cycle 23 (2026-06-02) — surfaced by the comply/research lenses as ground-truth #5 ("Fork a11y extension is undocumented"); critic flagged demand as inferred-not-signalled (trim candidate), kept as a zero-blast-radius docs deliverable.
- Approved via `/athena:plan approve all` on 2026-06-02.
