# Authoring an `install-<module-id>` Consumer Skill

Every `@saas` registry module ships with a **paired install skill** that executes the
declarative `postInstall` steps from `module.manifest.json`. The registry cannot run
migrations, wire env vars, or call external APIs — the install skill is the execution layer.

---

## Naming Convention

```
.claude/skills/install-<module-id>/SKILL.md
```

Examples:
- `.claude/skills/install-billing/SKILL.md`
- `.claude/skills/install-notifications/SKILL.md`
- `.claude/skills/install-user-profile/SKILL.md`

---

## SKILL.md Frontmatter

```yaml
---
name: install-<module-id>
description: >
  Install the @saas/<module-id> module into this project. Reads module.manifest.json,
  wires env vars to .env.local, runs Drizzle migrations, and performs any manual steps.
  Use after: npx shadcn@latest add @saas/<module-id>
user-invocable: true
metadata:
  author: saas-template
  version: "1.0.0"
---
```

- `user-invocable: true` — the skill can be invoked directly by a user or agent
- The description should mention what the skill does after `npx shadcn@latest add`

---

## Skill Structure

The install skill must execute these phases in order:

### Phase 0 — Pre-flight check

```bash
# Verify the registry files were installed
ls components/<module-id>/ 2>/dev/null || echo "WARN: registry files may not be installed yet."
# Remind the user to install the registry item first
```

### Phase 1 — Read the manifest

```bash
cat registry/<module-id>/module.manifest.json | jq .
```

Or in the skill narrative: "Read `registry/<module-id>/module.manifest.json` and list all
`envVars`, `dbTables`, and `postInstall` steps."

### Phase 2 — Wire environment variables

For each entry in `module.manifest.json#envVars`:
1. Check if the variable already exists in `.env.local`
2. If not, append `VAR_NAME=<example or placeholder>` to `.env.local`
3. Print a reminder to set the real value

```bash
# Pseudocode for each envVar:
if ! grep -q "^STRIPE_SECRET_KEY=" .env.local 2>/dev/null; then
  echo "STRIPE_SECRET_KEY=sk_test_REPLACE_ME" >> .env.local
  echo "Added STRIPE_SECRET_KEY to .env.local — replace with real value."
fi
```

Rule: **Never overwrite an existing value.** Always check first.

### Phase 3 — Run Drizzle migrations

If `module.manifest.json#db.schemaFragmentPath` is set:

1. Verify the schema fragment is installed at the target path
2. Import it in `lib/schema.ts` (manual step — the skill should instruct the user)
3. Run generate and migrate:

```bash
cd next-app && pnpm db:generate
cd next-app && pnpm db:migrate
```

### Phase 4 — Execute `postInstall` steps in order

Iterate `module.manifest.json#postInstall[]` by `step` number:

| action | What the install skill does |
|--------|-----------------------------|
| `env-wire` | Already done in Phase 2 |
| `db-generate` | Run `pnpm db:generate` (or the `command` field) |
| `db-migrate` | Run `pnpm db:migrate` (or the `command` field) |
| `db-seed` | Run the `command` field |
| `command` | Run the `command` field directly |
| `manual` | Print the `description` and pause for user confirmation |
| `docs` | Print the `docs` URL and summarize what the user should read |

### Phase 5 — Verification

Run the project to confirm the module is wired correctly:

```bash
cd next-app && pnpm typecheck
cd next-app && pnpm lint
```

If the module adds a route, navigate to it and confirm it renders.

---

## Example: `install-billing` Skill Body

```markdown
# Install Billing Module

Installs the @saas/billing module after `npx shadcn@latest add @saas/billing`.

## Prerequisites

Run first:
\`\`\`bash
npx shadcn@latest add @saas/billing
\`\`\`

## Steps

### 1. Wire environment variables

Add these to `next-app/.env.local` (do not overwrite existing values):

\`\`\`bash
STRIPE_SECRET_KEY=sk_test_REPLACE_WITH_REAL_KEY
STRIPE_WEBHOOK_SECRET=whsec_REPLACE_WITH_REAL_SECRET
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_REPLACE_WITH_REAL_KEY
STRIPE_PRICE_ID_PRO_MONTHLY=price_REPLACE_WITH_REAL_PRICE_ID
\`\`\`

### 2. Import the billing schema fragment

In `next-app/lib/schema.ts`, add:
\`\`\`typescript
export * from "./billing/schema"
\`\`\`

### 3. Generate and apply migrations

\`\`\`bash
cd next-app
pnpm db:generate
pnpm db:migrate
\`\`\`

### 4. Configure Stripe webhook (manual)

1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `<your-domain>/api/webhooks/stripe`
3. Select events: `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `checkout.session.completed`
4. Copy the signing secret to `STRIPE_WEBHOOK_SECRET` in `.env.local`

### 5. Verify

\`\`\`bash
cd next-app && pnpm typecheck && pnpm lint
\`\`\`

Navigate to `/billing` and confirm the billing page renders.
```

---

## Key Constraints

1. **The registry does NOT execute scripts.** The `postInstall` array is declarative — only
   the install skill actually runs commands.
2. **Never overwrite existing env vars.** Always check `.env.local` before writing.
3. **Schema import is always manual.** The install skill instructs the user to add
   `export * from "./billing/schema"` to `lib/schema.ts` — it cannot do this automatically
   since schema.ts is not a registry file.
4. **One skill per module.** Each module gets exactly one `install-<module-id>` skill.
   Do not create generic install skills.
