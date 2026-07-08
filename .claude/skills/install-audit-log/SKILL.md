---
name: install-audit-log
description: >
  Install the @saas/audit-log module into this Next.js SaaS project. Wires a legal-grade
  immutable audit trail: lib/audit-log/schema.ts (append-only audit_log_entries table with
  a denormalized actor snapshot + before/after jsonb + targetLabel) and lib/audit-log/log.ts
  (a fire-and-forget log() helper that records the real actor even for act-on-behalf-of).
  Reads module.manifest.json, wires the schema into the Drizzle barrel, and runs migrations.
  Use after: npx shadcn@latest add @saas/audit-log
user-invocable: true
metadata:
  author: saas-template
  version: "1.0.0"
  epic: E323
---

# Install Audit Log Module

Installs `@saas/audit-log` — an immutable, append-only audit trail. INSERT-only (no
update/delete path), with a **denormalized actor snapshot** (`actorRole` / `actorLabel`
captured at write time) so a row stays faithful even after the account is renamed,
re-roled, or deleted.

> Note: the table is `audit_log_entries` — it sits ALONGSIDE the template's baked-in
> lightweight `audit_log` (E269), it does not replace or collide with it. If you want the
> immutable table to be your only audit surface, migrate call sites off `lib/audit.ts`
> `logAudit()` onto this module's `log()` — that is your choice, not required by install.

## Prerequisites

The `@saas` registry is served by the template app at `/r/*`, so installs need
`SAAS_REGISTRY_URL` pointing at a running origin (`http://localhost:3000` locally with
`pnpm dev`, or your deployed domain).

```bash
npx shadcn@latest add @saas/audit-log
```

This installs:
- `lib/audit-log/schema.ts` — the `audit_log_entries` Drizzle table
- `lib/audit-log/log.ts` — the `log()` write helper
- `registry/audit-log/module.manifest.json` — the manifest

No env vars, no npm dependencies (uses the template's existing `drizzle-orm`, `@/lib/db`,
`@/lib/auth`, `@/lib/queries`).

## Phase 0 — Pre-flight

```bash
cd next-app
test -f lib/audit-log/schema.ts && test -f lib/audit-log/log.ts && echo "files present"
```

## Phase 1 — Wire the schema into the Drizzle barrel (REQUIRED before migrating)

drizzle-kit reads `lib/schema` (see `drizzle.config.ts`) and unions everything re-exported
there. Add the module's table to that union so a migration is generated:

```ts
// lib/schema/index.ts — add this line
export * from "./audit-log/schema"
```

Without this step `pnpm db:generate` will NOT emit a migration for `audit_log_entries`.

## Phase 2 — Generate + apply the migration

```bash
cd next-app
pnpm db:generate   # emits drizzle/NNNN_*.sql creating audit_log_entries
pnpm db:migrate    # applies it
```

## Phase 3 — Record entries from your mutations

Call `log()` AFTER a mutation succeeds. It is fire-and-forget (never throws into the
caller) and resolves the actor from the session when not passed explicitly:

```ts
import { log } from "@/lib/audit-log/log"

await log({
  action: "item.deleted",
  targetType: "item",
  targetId: id,
  targetLabel: item.title,
  before: { title: item.title },
  after: null,
})
```

### Compose with `lib/define-action.ts` (recommended)

The `defineAction()` factory (E323) makes the audit entry a mandatory return field —
either return the entry as the handler's `audit` and let the factory's `logAudit()` write
it, or swap the factory's audit sink to this module's `log()` for the richer before/after +
actor-snapshot columns. For act-on-behalf-of, pass the REAL operator as `actor` — recording
who actually performed the action is the whole point of the table.

## Phase 4 — Verify

```bash
cd next-app
pnpm typecheck && pnpm lint
```

## Notes

- **Immutable by contract.** The module ships no update/delete helper. Do not add one —
  the value of the trail is that rows never change.
- **Retention.** For civil-evidence use cases keep rows for your jurisdiction's limitation
  period; add a partition/archival policy rather than deleting.
