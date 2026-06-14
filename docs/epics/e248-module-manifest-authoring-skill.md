# E248 — Module Manifest + `module-author` Skill

**Phase:** 58 | **Status:** ⬜ | **Depends:** E247

## Problem

A shadcn registry item alone does not capture a *feature module's* full needs (env vars,
DB tables, post-install steps, cross-module deps), and there is no AI-readable contract for
an agent to author a new module to spec. This epic builds the "AI 幫你做模組" engine.

## Solution

- Define `module.manifest.json` spec per module:
  `{ id, version, title, summary, registryDependencies[], npmDependencies[], envVars[],
  dbTables[], routes[], postInstall[] }`. Distributed alongside code via a shadcn universal
  `registry:file` item with an explicit `target`.
- JSON Schema at `registry/schema/module.manifest.schema.json` + a `pnpm module:validate`
  validator.
- `module-author` Claude Code skill (`.claude/skills/module-author/SKILL.md` + guides):
  teaches an agent to scaffold a spec-compliant module — file layout, where server
  actions / route handlers / schema fragments live, how to declare deps/env/db, and how the
  paired `install-*` consumer skill is authored. Mirrors the `next-best-practices` skill shape.
- Convention: every module ships (a) registry item(s), (b) `module.manifest.json`,
  (c) an `install-<module>` consumer skill (the home for post-install steps, since the
  shadcn registry does NOT run Drizzle migrations).

## Acceptance

- [ ] `module.manifest.json` schema defined; validator passes on a sample manifest
- [ ] `module-author` skill has valid SKILL.md frontmatter + authoring guide; produces a
      compliant module when followed
- [ ] manifest is distributable via a universal `registry:file` item with explicit target
- [ ] cross-module deps expressed via `registryDependencies`; env/db via manifest fields

## Research-Informed Refinements (2nd pass · `woawzys1o`)

- **Manifest base = shadcn `registry-item.json` schema** (the verified machine-readable substrate):
  reuse its native `envVars` (written to `.env.local`, never overwrites existing), `registryDependencies`
  (version-pinnable via `ref`, e.g. `@saas/account#v1.0.0`), and `dependencies`/`devDependencies`.
  Then **extend** with the fields the registry schema lacks: `db` (Drizzle schema-fragment path +
  generate/migrate commands), `postInstall` (**declarative** step descriptions — the registry does NOT
  execute scripts), `files`/`routes`/`serverActions` (so an uninstall checklist can be derived), and
  **`docs`/`demo`** (the module's doc page + iframe live-demo + API-demonstration entry that aligns into
  the **E240** VitePress site — `docs` is a native registry-item field; `demo` is the custom convention).
- **AGENTS.md is prose-only** — no formal schema, cannot declare deps/env/db (verified). Use it as the
  human+agent README supplement, NOT the machine-readable dep source.
- The **`install-*` consumer skill executes** the declarative `postInstall` (env wiring +
  `pnpm db:generate && pnpm db:migrate`) — neither the registry nor MCP runs code, so the skill is the
  execution layer.
