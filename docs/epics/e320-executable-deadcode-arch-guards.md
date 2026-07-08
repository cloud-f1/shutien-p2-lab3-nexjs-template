# E320 — Executable Dead-Code & Architecture Guards

> Phase 75 · quality · toolchain · backport-wave-2
> Status: ⬜ pending
> Source: `../ai-rc-engineer-pm/scripts/service-map.cjs` + `scripts/check-orphan-exports.mjs`

## Problem

Phase 73's E314 ("service-map + dead-code detection") shipped only a **hand-written** `docs/architecture/payments-service-map.md` — a static drawing, not a tool. Nothing regenerates it from the real import graph, and nothing mechanically catches the two dead-signal bug classes the fork hit repeatedly:

1. **Orphan/phantom modules** — a `lib/` module with **zero importers** (dead code, or a duplicate that a whiteboard map hides). The fork's `service-map.cjs` surfaced a real dead duplicate module this way.
2. **Orphan-tested functions** — a `lib/` export with **full unit-test coverage but zero production call-sites** (tested-but-never-wired; passes the coverage gate while the feature silently does nothing in prod). The fork's E301 + E317 were exactly this class; E307 built `check:orphans` to guard it.

The template's `testing-strategy` skill *describes* the orphan-tested trap but has no runnable guard.

## Solution

Port the fork's two **executable** tools and wire them into the quality gate:

1. **`scripts/service-map.cjs`** — regex import-edge parser over `next-app/{lib,actions,app,components}` (resolves `@/` alias + relative paths). Emits a Mermaid graph + edge table + stats, and flags **0-importer orphan/phantom modules**. Writes a regenerable artifact to `docs/architecture/`, replacing (or superseding) the hand-written `payments-service-map.md`.
2. **`scripts/check-orphan-exports.mjs`** — heuristic guard that finds `lib/` exports with unit tests but zero production callers. Wired as `pnpm check:orphans` in `next-app/package.json`; `--strict` exits 1 for CI.

Both are domain-agnostic (scan any Next.js `@/`-aliased tree). Adapt only the seed module list + examples to the template's `items`/`billing`/`api-keys` domains.

## Key Files

- `scripts/service-map.cjs` (NEW — port + generalize)
- `scripts/check-orphan-exports.mjs` (NEW — port + generalize)
- `next-app/package.json` — add `"check:orphans": "node ../scripts/check-orphan-exports.mjs"`
- `docs/architecture/` — regenerated service-map artifact (supersede `payments-service-map.md` with generated output, or add a generated companion + note the hand-written one is illustrative)
- `.claude/skills/service-map/SKILL.md` (NEW — thin skill wrapping the tool, port from fork)
- `Makefile` / CI — call `check:orphans` in the verify path (soft-fail first, then `--strict`)

Reference (fork, read-only): `../ai-rc-engineer-pm/scripts/service-map.cjs`, `../ai-rc-engineer-pm/scripts/check-orphan-exports.mjs`, `../ai-rc-engineer-pm/.claude/skills/service-map/`

## Implementation

### Phase 1 — service-map.cjs
- Port the parser; confirm it resolves the template's `@/*` → `next-app/` alias.
- Run it; commit the generated map to `docs/architecture/service-map.md`. Reconcile with the existing `payments-service-map.md` (keep as illustrative or replace).

### Phase 2 — check-orphan-exports.mjs
- Port; point it at `next-app/lib`. Verify it flags a deliberately-orphaned fixture and passes clean on the real tree (fix any true orphans it finds, or allowlist with justification).
- Add `pnpm check:orphans` script.

### Phase 3 — wire into gate
- Add to the `make verify` path (E322) + CI as a soft check first; flip to `--strict` once the tree is clean.
- Add the `service-map` skill (thin wrapper: when to run, how to read orphans).

## Acceptance Criteria

- [ ] `node scripts/service-map.cjs` emits a Mermaid graph + edge table + orphan list without error
- [ ] `docs/architecture/service-map.md` is generated (not hand-written) and current
- [ ] `pnpm check:orphans` runs; `--strict` exits non-zero on a seeded orphan and zero on a clean tree
- [ ] `next-app/package.json` has the `check:orphans` script
- [ ] `.claude/skills/service-map/SKILL.md` exists (no 瑞成/rc-schedule literals)
- [ ] Tools contain no product-specific module names in their logic (examples only)

## Cross-Epic

- E314 (Phase 73) — this **upgrades** E314's docs-only deliverable to a runnable tool
- E321 (test middle layer) — `check:orphans` complements integration tests for the wiring-bug class
- E322 — wired into `make verify` + CI

## Out of Scope

- The fork's `.codegraph/codegraph.db` (8.7MB unreferenced committed SQLite blob) — explicitly NOT ported (anti-pattern)
- Product `rc-schedule`/`rc-*` module examples — replace with template domains
