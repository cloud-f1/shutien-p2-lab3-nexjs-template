---
name: module-author
description: >
  Teaches an agent to scaffold a spec-compliant @saas registry module: file
  layout, how to declare deps/env/db in module.manifest.json, where server
  actions and route handlers live, and how to author the paired install-*
  consumer skill. Use when building a new feature module for the @saas registry.
user-invocable: true
metadata:
  author: saas-template
  version: "1.0.0"
---

# Module Author Skill

Use this skill when scaffolding a new feature module for the `@saas` registry.
A module is a self-contained feature (billing, notifications, user-profile, etc.)
that can be installed into any `next-app` via:

```bash
npx shadcn@latest add @saas/<module-id>
```

## The Three Artifacts Every Module Ships

1. **Registry item** — declared in `next-app/registry.json` (type `registry:block`)
2. **`module.manifest.json`** — machine-readable metadata (env, db, deps, post-install steps)
3. **`install-<module-id>` consumer skill** — the execution layer for post-install steps

See [module-manifest-spec.md](./module-manifest-spec.md) for the full field reference.
See [install-skill-guide.md](./install-skill-guide.md) for how to write the paired skill.

---

## How the `@saas` Registry Is Served (read before testing installs)

The `@saas` registry is **served by THIS app itself** — `pnpm registry:build`
writes `public/r/*.json`, which Next serves at `/r/*`. There is no separate
registry server. So `npx shadcn add @saas/<module>` only works against a
**running origin**:

- **Local:** `pnpm dev` (or `pnpm build && pnpm start`) with
  `SAAS_REGISTRY_URL=http://localhost:3000` (the default in `.env.example`).
- **Deployed registry:** set `SAAS_REGISTRY_URL` to your deployed domain.

`components.json` uses the env token `"${SAAS_REGISTRY_URL}/r"` (shadcn ≥ 4.x
expands `${VAR}` from `.env.local`/`.env`). shadcn's token does **not** support
`${VAR:-default}` shell defaults — if `SAAS_REGISTRY_URL` is unset, shadcn fails
fast with a "Missing environment variables" error (intentional: better than the
old silent-localhost-after-deploy footgun). Document this in each install-* skill.

### Pre-installed modules drift from their registry copies

Some modules (`landing`, `billing-stripe`, `billing-ecpay`) are **also baked
directly into this template** (`app/page.tsx`, `components/marketing/*`,
`lib/billing/*`, `actions/billing.ts`). The live baked-in code evolves and can
become **newer than** the `registry/<module>/**` copy distributed by the registry.

Consequences for module authors:

1. **The registry copy is for installing into OTHER projects** — it is an
   intentionally self-contained snapshot, not a re-install target for this repo.
2. **Re-installing a pre-installed module HERE overwrites newer live files with
   the older registry copy** (route collisions, dropped fixes, broken imports).
3. Every install-* skill for a pre-installed module MUST carry a **drift/overwrite
   warning** at the top: state that the module is already baked in, that the live
   files may be newer, and that re-installing overwrites them.
4. If you keep a registry copy in sync with live code, ensure the copy stays
   **standalone** — it may only import files that the module's own `files[]`
   ships (or shadcn `registryDependencies`); it must not depend on template-only
   modules the install would not bring along.

---

## File Layout

Every module lives under `next-app/registry/<module-id>/` and mirrors the install targets:

```
next-app/
  registry/
    <module-id>/
      module.manifest.json          ← machine-readable contract
      components/
        <component>.tsx             → target: components/<module-id>/<component>.tsx
      lib/
        <module-id>-schema.ts       → target: lib/<module-id>/schema.ts  (Drizzle fragment)
        <module-id>-provider.ts     → target: lib/<module-id>/provider.ts
        <module-id>-resolver.ts     → target: lib/<module-id>/resolver.ts
      actions/
        <module-id>.ts              → target: actions/<module-id>.ts
      app/
        (dashboard)/<module-id>/
          page.tsx                  → target: app/(dashboard)/<module-id>/page.tsx
        api/<module-id>/
          route.ts                  → target: app/api/<module-id>/route.ts
```

**Install targets** must align with the `target` field in `module.manifest.json#files[]` and
the `files` array in `registry.json`.

---

## Step-by-Step: Scaffold a New Module

### Step 1 — Reserve the module ID

Pick a kebab-case ID (e.g. `billing`, `user-profile`, `notifications`). Verify it does not
conflict with existing registry items in `next-app/registry.json`.

### Step 2 — Create the registry directory and write files

```
next-app/registry/<module-id>/
```

Default starting files:
- `components/<module-id>-card.tsx` — main UI component
- `lib/<module-id>-provider.ts` — server-side provider / adapter
- `lib/<module-id>-schema.ts` — Drizzle schema fragment (if DB-backed)
- `actions/<module-id>.ts` — Server Actions (`"use server"`)
- `app/(dashboard)/<module-id>/page.tsx` — dashboard route

Use the Next.js App Router architecture rules:
- Default to **Server Components**; add `"use client"` only for interactivity
- Server Actions in `actions/<module-id>.ts` must start with `"use server"`
- Data fetching in async Server Components (never in client components)
- Use `@/` path alias for all cross-module imports

### Step 3 — Write `module.manifest.json`

Create `next-app/registry/<module-id>/module.manifest.json`. Required fields:

```json
{
  "$schema": "../schema/module.manifest.schema.json",
  "id": "<module-id>",
  "version": "1.0.0",
  "title": "<Human Title>",
  "summary": "<One-sentence description>",
  "registryDependencies": [],
  "npmDependencies": {},
  "envVars": [],
  "dbTables": [],
  "db": {},
  "routes": [],
  "serverActions": [],
  "postInstall": [],
  "files": []
}
```

Declare every dependency, env var, table, route, and action. See field reference below.

Validate with:
```bash
cd next-app && pnpm module:validate registry/<module-id>/module.manifest.json
```

### Step 4 — Register in `registry.json`

Add the registry item to `next-app/registry.json`:

```json
{
  "name": "<module-id>",
  "type": "registry:block",
  "title": "<Human Title>",
  "description": "<One-sentence description>",
  "registryDependencies": [],
  "dependencies": [],
  "devDependencies": [],
  "files": [
    {
      "path": "registry/<module-id>/components/<module-id>-card.tsx",
      "type": "registry:component",
      "target": "components/<module-id>/<module-id>-card.tsx"
    }
  ]
}
```

The `files` array here must match the `files` array in `module.manifest.json`.

### Step 5 — Distribute the manifest as a registry:file item

The manifest itself must be installable via shadcn. Add to the registry item's `files`:

```json
{
  "path": "registry/<module-id>/module.manifest.json",
  "type": "registry:file",
  "target": "registry/<module-id>/module.manifest.json"
}
```

This allows consumers to receive the machine-readable contract alongside the code.

### Step 6 — Write the `install-<module-id>` consumer skill

See [install-skill-guide.md](./install-skill-guide.md).

### Step 7 — Build and verify

```bash
cd next-app

# Validate the manifest
pnpm module:validate registry/<module-id>/module.manifest.json

# Build the registry (generates public/r/<module-id>.json)
pnpm registry:build

# Typecheck and lint
pnpm typecheck
pnpm lint
```

---

## Declaring Dependencies

### Cross-module deps (`registryDependencies`)

Reference other `@saas` modules this module depends on:

```json
"registryDependencies": [
  "@saas/account",
  "@saas/account#v1.0.0"
]
```

Version-pin with `#ref` when you depend on a specific module version.
These map to shadcn's native `registryDependencies` field — shadcn installs them automatically.

### npm deps (`npmDependencies`)

```json
"npmDependencies": {
  "stripe": "^17.0.0",
  "@stripe/stripe-js": "^5.0.0"
}
```

These are written to the shadcn registry item's `dependencies` array and installed
automatically by `npx shadcn@latest add @saas/<module-id>`.

---

## Declaring Environment Variables (`envVars`)

```json
"envVars": [
  {
    "name": "STRIPE_SECRET_KEY",
    "description": "Stripe secret key from the Stripe Dashboard.",
    "required": true,
    "example": "sk_test_..."
  }
]
```

Rules:
- Name must be `UPPER_SNAKE_CASE`
- The install-* skill writes these to `.env.local` (never overwrites existing values)
- The registry itself does NOT touch env files — the skill is the execution layer

---

## Declaring DB Tables (`dbTables` + `db`)

```json
"dbTables": ["subscriptions", "stripe_customers"],
"db": {
  "schemaFragmentPath": "lib/<module-id>/schema.ts",
  "generateCommand": "pnpm db:generate",
  "migrateCommand": "pnpm db:migrate"
}
```

The Drizzle schema fragment at `schemaFragmentPath` must export table definitions
compatible with the main `lib/schema.ts`. It is NOT automatically merged — the
install-* skill handles integration.

The registry does NOT run `pnpm db:generate` or `pnpm db:migrate`. These are
**declarative** instructions executed by the install-* skill.

---

## Declaring Post-Install Steps (`postInstall`)

The `postInstall` array is **declarative** — a list of steps the registry cannot execute.
The install-* consumer skill reads and executes them.

```json
"postInstall": [
  {
    "step": 1,
    "action": "env-wire",
    "description": "Add env vars to .env.local."
  },
  {
    "step": 2,
    "action": "db-generate",
    "description": "Generate Drizzle migrations.",
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
    "description": "Configure external service (webhook endpoint, API keys, etc.)."
  }
]
```

Valid `action` values:

| action | Meaning |
|--------|---------|
| `env-wire` | Write envVars to .env.local (install-* skill does this) |
| `db-generate` | Run `pnpm db:generate` |
| `db-migrate` | Run `pnpm db:migrate` |
| `db-seed` | Run `pnpm db:seed` or a custom seed script |
| `command` | Run the shell `command` field |
| `manual` | Human must perform this step |
| `docs` | Read the documentation at `docs` URL |

---

## Architecture Rules for Module Code

Follow these rules when writing module files:

1. **Default to Server Components** — `"use client"` only for browser APIs, event handlers, or hooks
2. **Server Actions** go in `actions/<module-id>.ts`, start with `"use server"`
3. **Route Handlers** go in `app/api/<module-id>/route.ts`
4. **`@/` alias** for all imports — never relative `../../` paths
5. **`cn()` from `@/lib/utils`** for all conditional Tailwind classes
6. **shadcn/ui components** from `@/components/ui/` — never re-implement them
7. **Drizzle** for all DB access — never raw SQL strings, never Prisma
8. **No inline `style=` color overrides** — use Tailwind `dark:` variants

---

## Validation Checklist

Before committing a new module, verify:

- [ ] `pnpm module:validate registry/<module-id>/module.manifest.json` passes
- [ ] All `files[].target` paths match the actual install location
- [ ] All `envVars[].name` are `UPPER_SNAKE_CASE`
- [ ] All `dbTables[]` entries are `snake_case`
- [ ] `registryDependencies` lists all cross-module deps
- [ ] `postInstall` steps are ordered and cover env, db, and manual steps
- [ ] The manifest is listed as a `registry:file` in `registry.json` (for distribution)
- [ ] The paired `install-<module-id>` skill is written (see [install-skill-guide.md](./install-skill-guide.md))
- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm registry:build` succeeds
