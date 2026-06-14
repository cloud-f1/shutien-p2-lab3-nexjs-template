---
title: Authoring a Module
description: How to scaffold a spec-compliant @saas registry module using the module-author skill.
---

# Authoring a Module

This guide explains how to create a new `@saas` registry module — a self-contained installable block
that declares its routes, server actions, database tables, and env vars in a `module.manifest.json`,
and ships a paired `install-*` Claude Code skill for AI-assisted post-install wiring.

## Prerequisites

- Claude Code installed and running in this repo
- Working `next-app/` dev environment (`pnpm install` inside `next-app/`)
- Basic familiarity with Next.js App Router and the @saas stack

## Step 1 — Invoke the `module-author` Skill

The fastest way to scaffold a new module is to use the built-in `module-author` skill in Claude Code:

```
/module-author
```

The skill will:

1. Ask you for the module ID (e.g., `my-feature`)
2. Ask for the module's purpose, routes, server actions, DB tables, env vars, and npm dependencies
3. Scaffold the complete file structure under `next-app/registry/<module-id>/`
4. Generate `module.manifest.json` with all declared fields
5. Create the paired `install-<module-id>` skill under `.claude/skills/`
6. Add docs scaffolding under `dev-docs/modules/<module-id>.md`

## Step 2 — File Layout

A complete `@saas` module lives under `next-app/registry/<module-id>/`:

```
next-app/registry/<module-id>/
  module.manifest.json        # machine-readable wiring spec (REQUIRED)
  app/
    (route-group)/
      <route>/
        page.tsx              # App Router page (if the module adds a page)
        route.ts              # App Router route handler (if it adds an API route)
  components/
    <feature>/
      <component>.tsx         # React components
  lib/
    <feature>/
      <util>.ts               # Server-side utilities
  actions/
    <feature>.ts              # Server Actions ("use server")
```

The `hello-module` is the canonical minimal example — use it as a reference:

```
next-app/registry/hello-module/
  module.manifest.json
  components/hello-banner.tsx
  lib/hello-utils.ts
```

## Step 3 — Write `module.manifest.json`

Every module **must** ship a `module.manifest.json` that conforms to the registry-item schema.
Required fields:

```json
{
  "$schema": "../schema/module.manifest.schema.json",
  "id": "my-feature",
  "version": "1.0.0",
  "title": "My Feature",
  "summary": "One-sentence description of what this module does.",
  "registryDependencies": [],
  "npmDependencies": {},
  "envVars": [],
  "dbTables": [],
  "db": {},
  "routes": [],
  "serverActions": [],
  "postInstall": [],
  "docs": "/docs/modules/my-feature",
  "demo": {
    "path": "/demo/my-feature",
    "iframeSrc": "http://localhost:3000/",
    "apiDemoPath": "/api/my-feature"
  },
  "files": [
    {
      "path": "registry/my-feature/components/my-component.tsx",
      "type": "registry:component",
      "target": "components/my-component.tsx"
    }
  ]
}
```

### Key field reference

| Field | Type | Purpose |
|---|---|---|
| `id` | `string` | Unique kebab-case identifier — becomes `@saas/<id>` |
| `registryDependencies` | `string[]` | shadcn/ui primitives or other `@saas/*` modules to install first |
| `npmDependencies` | `object` | npm packages (shadcn CLI installs these automatically) |
| `envVars` | `array` | Env vars this module requires (name, description, required, example) |
| `dbTables` | `string[]` | DB tables this module creates |
| `db` | `object` | Migration commands (`generateCommand`, `migrateCommand`) |
| `postInstall` | `array` | Ordered steps — `action` is one of `manual`, `command`, `env-wire`, `db-generate`, `db-migrate`, `docs` |
| `files` | `array` | Source → target file mappings |

## Step 4 — Write the `postInstall` Steps

Post-install steps are the machine-readable wiring spec that the paired `install-*` skill uses.
Write them in execution order:

```json
"postInstall": [
  {
    "step": 1,
    "action": "env-wire",
    "description": "Add MY_API_KEY to .env.local. Never commit to git."
  },
  {
    "step": 2,
    "action": "db-generate",
    "description": "Generate Drizzle migrations for the new tables.",
    "command": "pnpm db:generate"
  },
  {
    "step": 3,
    "action": "db-migrate",
    "description": "Apply migrations.",
    "command": "pnpm db:migrate"
  },
  {
    "step": 4,
    "action": "manual",
    "description": "Wire the new route into the sidebar navigation."
  },
  {
    "step": 5,
    "action": "command",
    "description": "Run typecheck and lint.",
    "command": "pnpm typecheck && pnpm lint"
  }
]
```

## Step 5 — Write the Paired `install-*` Skill

Each module has a companion Claude Code skill that drives the post-install wiring.
The skill lives at `.claude/skills/install-<module-id>/SKILL.md`.

Minimum skill structure:

```markdown
# install-<module-id>

Post-install wiring skill for @saas/<module-id>.

## What this skill does

1. Reads `module.manifest.json` to verify files landed
2. Checks env vars are set in `.env.local`
3. Runs DB migrations if needed
4. Walks through each `postInstall` step
5. Confirms typecheck + lint pass

## Steps

### Phase 0 — Pre-flight
Read `next-app/registry/<module-id>/module.manifest.json`.
Verify all `files[].target` paths exist under `next-app/`.

### Phase 1 — Env vars
Check `.env.local` for each required `envVars[].name`.
If missing, prompt the user to add it.

### Phase 2 — Database
If `dbTables` is non-empty and migrations have not been applied:
run `pnpm db:generate && pnpm db:migrate` from `next-app/`.

### Phase 3 — Post-install steps
Walk through each `postInstall` step in order.
For `command` steps, run the command.
For `manual` steps, display the instruction and confirm with the user.

### Phase 4 — Verify
Run `pnpm typecheck && pnpm lint` from `next-app/`.
Report success or failure.
```

## Step 6 — Add to the Registry Index

Add the module to `next-app/public/r/registry.json`:

```json
{
  "items": [
    ...
    {
      "name": "my-feature",
      "type": "registry:block",
      "registryUrl": "http://localhost:3000/r/my-feature.json"
    }
  ]
}
```

Then build and validate:

```bash
cd next-app
pnpm registry:build
pnpm module:validate
```

## Step 7 — Add Docs and Demo

1. Create `dev-docs/modules/<module-id>.md` — follow the pattern in existing module docs (purpose, install command, env table, post-install steps, uninstall checklist)
2. Create `dev-docs/demo/<module-id>.md` — add a demo iframe and description
3. Add the module to `dev-docs/modules/index.md` with a `<ModuleCard>` entry

## Uninstall Documentation (Required)

Every module doc **must** include an "Uninstall (Manual Checklist)" section.
The registry/MCP provide **no automated uninstall**; document the manual steps explicitly:

1. Files to remove (from `module.manifest.json` → `files`)
2. DB tables to drop (from `dbTables`) via a down-migration
3. Env vars to unset (from `envVars`)
4. npm packages to remove (from `npmDependencies`)

## Reference

| Path | Purpose |
|---|---|
| `next-app/registry/<id>/module.manifest.json` | Machine-readable wiring spec |
| `.claude/skills/install-<id>/SKILL.md` | Paired AI install skill |
| `next-app/registry/schema/module.manifest.schema.json` | JSON Schema for manifest validation |
| `dev-docs/modules/<id>.md` | VitePress module docs page |
| `next-app/public/r/registry.json` | Registry index |
| `next-app/registry/hello-module/` | Canonical minimal module reference |
