# module.manifest.json Field Reference

Full spec for all fields. The canonical machine-readable schema is at:
`next-app/registry/schema/module.manifest.schema.json`

---

## Required Fields

| Field | Type | Pattern | Description |
|-------|------|---------|-------------|
| `id` | `string` | `^[a-z][a-z0-9-]*$` | Unique module ID (kebab-case). Must match the shadcn registry item name. |
| `version` | `string` | semver | Module manifest version (e.g. `"1.0.0"`). |
| `title` | `string` | — | Human-readable name (e.g. `"Billing (Stripe)"`). |
| `summary` | `string` | — | One-sentence description of what this module provides. |

---

## Shadcn-Native Fields (Extended)

These fields map directly to the shadcn `registry-item.json` schema. The registry reads them
natively; the module manifest extends them with richer metadata.

### `registryDependencies` (`string[]`, default `[]`)

Other `@saas` module IDs this module depends on. Supports version-pinning:

```json
"registryDependencies": [
  "account",
  "@saas/account#v1.0.0"
]
```

shadcn installs these automatically when a consumer runs `npx shadcn@latest add @saas/<id>`.

### `npmDependencies` (`object`, default `{}`)

Runtime npm packages. Key = package name, value = semver range:

```json
"npmDependencies": { "stripe": "^17.0.0" }
```

Maps to shadcn registry-item `dependencies`. Installed automatically by shadcn CLI.

### `npmDevDependencies` (`object`, default `{}`)

Dev/build-only npm packages. Maps to shadcn `devDependencies`.

### `envVars` (`EnvVar[]`, default `[]`)

Environment variables. Written to `.env.local` by the install-* skill (never overwrites existing):

```json
"envVars": [
  {
    "name": "STRIPE_SECRET_KEY",         // UPPER_SNAKE_CASE, required
    "description": "Stripe secret key.", // optional human hint
    "required": true,                    // default true
    "example": "sk_test_..."             // non-sensitive placeholder
  }
]
```

Maps to shadcn registry-item `envVars` field.

### `docs` (`string`, optional)

Path or URL to the module's documentation page. Aligns with E240 VitePress site:

```json
"docs": "/docs/modules/billing"
```

This is a native shadcn registry-item field.

---

## Extended Fields (Module-Manifest-Only)

These fields extend beyond the shadcn registry-item schema.

### `dbTables` (`string[]`, default `[]`)

Drizzle table names (snake_case) introduced by this module:

```json
"dbTables": ["subscriptions", "stripe_customers"]
```

Used to generate uninstall checklists. Each name must be `snake_case`.

### `db` (`object`, optional)

Drizzle ORM integration metadata:

```json
"db": {
  "schemaFragmentPath": "lib/billing/schema.ts",   // relative to next-app/
  "generateCommand": "pnpm db:generate",            // default
  "migrateCommand": "pnpm db:migrate"               // default
}
```

The schema fragment exports Drizzle table definitions. It is NOT auto-merged into
`lib/schema.ts` — the install-* skill handles that.

### `routes` (`string[]`, default `[]`)

Next.js App Router route segments added by this module (relative to `app/`):

```json
"routes": [
  "(dashboard)/billing/page.tsx",
  "api/webhooks/stripe/route.ts"
]
```

Used for documentation and uninstall checklists.

### `serverActions` (`string[]`, default `[]`)

Server Action file paths (relative to `next-app/`):

```json
"serverActions": ["actions/billing.ts"]
```

### `postInstall` (`PostInstallStep[]`, default `[]`)

Ordered declarative steps a consumer must perform after installing registry files.
**The registry does NOT execute these.** The install-* skill reads and executes them.

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
    "description": "Apply migrations to the database.",
    "command": "pnpm db:migrate"
  },
  {
    "step": 4,
    "action": "manual",
    "description": "Configure Stripe webhook in the dashboard."
  }
]
```

PostInstallStep fields:
- `step` (integer, required): 1-based ordering
- `action` (enum, optional): machine-readable intent — `env-wire` | `db-generate` | `db-migrate` | `db-seed` | `command` | `manual` | `docs`
- `description` (string, required): human-readable instruction
- `command` (string, optional): shell command for `action: "command"` steps

### `demo` (`object`, optional)

Live demo configuration for E240 VitePress site:

```json
"demo": {
  "path": "/demo/billing",
  "iframeSrc": "http://localhost:3000/demo/billing",
  "apiDemoPath": "/api/demo/billing/checkout"
}
```

### `files` (`ManifestFile[]`, default `[]`)

All files this module installs, mirroring the shadcn registry-item `files` array.
Used for generating complete uninstall checklists:

```json
"files": [
  {
    "path": "registry/billing/components/billing-card.tsx",  // source path, relative to next-app/
    "type": "registry:component",                            // shadcn file type
    "target": "components/billing/billing-card.tsx"          // install target
  }
]
```

Valid `type` values: `registry:component` | `registry:lib` | `registry:hook` | `registry:page` | `registry:block` | `registry:file`

---

## Validation

```bash
cd next-app
pnpm module:validate                                              # all manifests
pnpm module:validate registry/<module-id>/module.manifest.json   # one file
```

The validator is at `next-app/lib/registry/validate-manifest.ts`.
The JSON Schema is at `next-app/registry/schema/module.manifest.schema.json`.
A full sample is at `next-app/registry/schema/samples/billing.module.manifest.json`.
