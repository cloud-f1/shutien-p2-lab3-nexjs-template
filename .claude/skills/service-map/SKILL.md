---
name: service-map
description: >
  Draw how a service actually fits together from the REAL import graph, not a whiteboard — into a
  committed artifact. Use when someone says "map how the <X> service fits together", "show me the
  architecture of <X> from the code", "what depends on <X>", or wants a dependency/import map. Runs
  `scripts/service-map.cjs` (mechanical import-edge parse) to emit a Mermaid graph + edge table, and
  flags orphans (0-importer modules = dead/phantom code a whiteboard hides). Pairs with the existing
  maps under `docs/architecture/`.
user-invocable: true
---

# Service map — from the real import graph

A whiteboard can draw a service that no longer exists. The import graph can't: if nothing imports a
module, it isn't wired in. This skill draws the map **mechanically from the code**, so the artifact
is provably what's actually connected — and it surfaces the rot (orphans, phantoms) that diagrams hide.

## Run it
```bash
node scripts/service-map.cjs <seed...> [--out FILE]
```
- `seed` = one or more **module-name substrings** (e.g. `billing`, `items`, `api-keys`, `auth`).
- The tool scans `next-app/{lib,actions,app,components}` (.ts/.tsx, tests excluded), parses every
  `import … from` / `import()`, resolves `@/`→`next-app/` + relative paths, and emits:
  - a **slice** = the seed modules + their transitive imports (dependencies) + their direct importers (consumers);
  - a **Mermaid** graph of the import edges;
  - an **edge table** (`module · kind · imports · imported by`);
  - **stats** (module count, external deps) and **orphan/phantom** flags.

```bash
node scripts/service-map.cjs notifications                    # → "phantom: no code wired in" (example)
node scripts/service-map.cjs items billing api-keys auth      # → the template's core domains
node scripts/service-map.cjs auth --out docs/architecture/auth-service-map.md
```

## How to read the output
- **"No modules match …"** → the service is a **phantom**: a whiteboard/registry/doc claims it but
  no code imports anything by that name. (How the payments map came out before the billing module
  was wired in — see `docs/architecture/payments-service-map.md`.)
- **`(none — orphan ⚠)`** in the *imported by* column on a **lib/component** → dead/unwired code.
  This is the same class of dead-duplicate-module rot the fork's `service-map.cjs` was built to
  catch.
- **`(entry point)`** on a **page/action** → expected: the router/form invokes it, nothing imports it.
- **external deps** list → the service's real outside edges (e.g. `drizzle-orm`, `stripe`). A service
  that should call an external API but lists none is a red flag.

## Turn it into an artifact
Write the output to `docs/architecture/<service>-map.md` and wrap it with a short human narrative:
the **verdict** (one line), the generated graph/table, any **residue** the graph can't see (skills,
scripts, docs that *name* the service — grep for them), and the **lesson**. Keep the artifact
regenerable — note the exact command in the file header. The template's default combined map lives
at `docs/architecture/service-map.md`, generated with:
```bash
node scripts/service-map.cjs items billing api-keys auth --out docs/architecture/service-map.md
```

## Companion: orphan-tested-function guard
`scripts/service-map.cjs` catches modules with **zero importers**. It can't catch the narrower trap
of a module that *is* imported but exports a function nobody actually calls (only its own unit
test does) — that's `scripts/check-orphan-exports.mjs` (`pnpm --dir next-app check:orphans`), which
scans `next-app/lib` for exports with test coverage but zero production call-sites. Run both when
auditing a domain: `service-map` for the module-level graph, `check:orphans` for the function-level
wiring gap.

## Caveats
- The graph sees `next-app/` imports only. References in `.claude/skills/`, `scripts/`, deploy
  config, or prose are **not** edges — grep for those separately when mapping residue.
- Regex import-parse (not a full TS resolver): good enough for this codebase's import style; it
  won't follow re-exports through barrels beyond one hop or resolve path-mapped packages.
