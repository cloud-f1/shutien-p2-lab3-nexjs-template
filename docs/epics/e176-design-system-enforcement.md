# E176 — Design System Enforcement (Stop-Verifier Rules + Coverage Script)

> Phase 44 — Design System Completion & Validation | Size: S (2 SP) | Deps: E167

## Problem

Today's design-system rules in `design.md` § 6 ("Conventions & Bans") and § 10 ("Component Change Process") are **advisory**. Nothing in the toolchain blocks a PR that:

- Adds a new `client/src/pages/foo/Foo.css` file (we said: no new page CSS)
- Hand-rolls `<div className="page-header">` in a new view (we said: use `<PageContainer>`)
- Imports from `pages/auth/components/` after E169 promotes them (we said: use `components/ui/`)
- Hardcodes a Tailwind class string inside a primitive in `components/ui/` (we said: extract to Preset)
- Adds a new primitive without a co-located test
- Adds a Preset slot to `defaultPreset` but forgets `compactPreset`

The Stop-verifier hook already has 20 rules covering localStorage, fireEvent, MSW location, OpenAPI drift, etc. Design system rules belong there too — defense in depth, mechanized.

## Solution

Two new Stop-verifier rules + one coverage script.

### Rule #21 — No new page-co-located CSS files

Block commit if `git diff --name-only --cached` contains any new file matching `client/src/pages/**/*.css`. Allow `client/src/styles/**/*.css` (theme system, common primitives) and `client/src/components/**/*.css` (DashboardLayout — exception that survives per E175).

Bypass: explicit `// design-system: legacy-css-allowed` comment on the file's first line, with a justification.

### Rule #22 — Hardcoded Tailwind class strings in primitives

Block commit if `components/ui/*.tsx` (excluding `*.test.tsx` and `preset.ts`) contains a string literal matching the design-system audit grep:

```bash
grep -nE '"[^"]*(bg-|text-|border-|font-|rounded|px-|py-|w-|sm:|md:|inline-flex|overflow-|space-|flex|min-w|max-w|gap-|mb-|mt-|ml-|mr-)[^"]*"'
```

This is the same audit grep already documented in `design.md` § 10 ("Checklist before merging a primitive change") — promoted from doc-checklist to mechanized gate.

### Coverage script — `scripts/checks/design-system-coverage.sh`

Reports (and on `--strict`, fails) when:

- A page in `client/src/pages/` does not import anything from `client/src/components/ui/`
- Any `.tsx` file outside `components/ui/` contains `<div className="page-header">`
- A new Preset slot in `preset.ts` is added to `defaultPreset` but missing from `compactPreset` (or any other registered preset)
- A primitive file lacks a co-located `__tests__/<Name>.test.tsx`

Used by:
- `pnpm check:design` script (interactive output, exit 0)
- `pnpm check:design --strict` (CI mode, exits 1 on violation) — wired into pre-deploy gate

## Key Files

| File | Action |
|---|---|
| `scripts/hooks/stop-verifier.sh` | Edit — add Rule #21 (no new page CSS) and Rule #22 (no hardcoded Tailwind in primitives) |
| `scripts/hooks/CLAUDE.md` | Edit — document Rule #21 + #22 in the rules table |
| `scripts/checks/design-system-coverage.sh` | New — coverage script with strict mode |
| `client/package.json` | Edit — `"check:design": "bash ../scripts/checks/design-system-coverage.sh"` |
| `Makefile` | Edit — add `make check-design` target wrapping the script |
| `scripts/hooks/__tests__/stop-verifier-design.test.sh` | New — fixture-driven tests proving Rule #21 + #22 fire on bad inputs and skip on good inputs |
| `docs/design/design.md` | Edit — § 6 + § 10 reference the mechanized gates; "checklist" items now say "automated via Stop-verifier" |
| `CLAUDE.md` (root) | Edit — Stop-verifier rule count 20 → 22 |

## Implementation

1. Author Rule #21 in `stop-verifier.sh` — small `git diff --cached --name-only` filter. Test with fixture: stage a new `pages/foo/Foo.css` → expect block.
2. Author Rule #22 — grep over `components/ui/*.tsx`. Test with fixture: edit `Button.tsx` to inline a `"px-6 py-3"` string → expect block; revert → expect pass.
3. Author `design-system-coverage.sh` with three checks:
   - find `client/src/pages/**/*.tsx` files; assert each imports from `../components/ui` (or relative equivalent)
   - grep for `<div className="page-header">` in `*.tsx` outside `components/ui/`
   - parse `preset.ts` exports — every key in `defaultPreset` must exist in `compactPreset` (and any other registered preset)
   - find `components/ui/*.tsx` (not test files); assert each has a sibling `__tests__/<name>.test.tsx`
4. Wire `make check-design` and `pnpm check:design`.
5. Wire `--strict` into pre-deploy gate (Gate 8).
6. Update `design.md` § 6 + § 10: replace "manual audit checklist" language with "mechanized via Rule #21 / #22 / `make check-design`."
7. Update `CLAUDE.md` rule count.

## Acceptance Criteria

- [ ] Stop-verifier Rules #21 and #22 implemented + fixture-tested
- [ ] `scripts/checks/design-system-coverage.sh` implemented + fixture-tested
- [ ] `pnpm check:design` and `make check-design` work locally
- [ ] Pre-deploy gate runs the coverage script in `--strict` mode (Gate 8 or new Gate 9)
- [ ] Both rules block deliberately-broken fixture commits and pass on the current branch
- [ ] design.md § 6 + § 10 updated to reference mechanized gates
- [ ] CLAUDE.md root rule count incremented (20 → 22)
- [ ] No false positives on the existing branch (current code passes)

## Alignment / Cross-Epic Hooks

- **Hard-depends on E167** — without primitives there's nothing to enforce.
- **Soft-depends on E168/E169/E170** — Rule #21 would block legitimate `pages/auth/AuthPages.css` until that file is deleted in E169/E170. Either:
  - **Option A**: ship E176 *after* E170 (clean state).
  - **Option B**: ship E176 with a `// design-system: legacy-css-allowed` annotation on the existing CSS files, and remove annotations in E170.
  Recommend Option B — gets the gate in place earlier, forces explicit acknowledgement of legacy.
- **Pairs with E171** — Playwright VRT and Stop-verifier rules are complementary (visual regression + structural regression).

## Out of Scope

- **Auto-fixing** violations (e.g. extracting hardcoded class strings into Preset automatically) — too risky; let the developer do it.
- **TypeScript-level enforcement** (e.g. `as const` on Preset to make incomplete merges type errors) — TypeScript already catches missing slot keys when `Preset` interface is fully typed.
- **Lint plugin** for editor-time feedback — separate epic if/when needed; ESLint config is already broken on this repo (pre-existing).
- **Hardcoded color audit** (e.g. `#FF0000` in components) — already covered by Stop-verifier Rule #17 (CSS-var drift).
