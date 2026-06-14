---
title: Installing a Module via AI
description: Use MCP + install-* skills to install and wire @saas registry modules automatically with Claude Code.
---

# Installing a Module via AI

This guide explains how to use **Claude Code with the shadcn MCP server** to browse, install, and
fully wire `@saas` registry modules — hands-free. The AI agent handles the shadcn CLI install,
reads the `module.manifest.json`, and drives all post-install steps using the module's paired `install-*` skill.

## Prerequisites

- Claude Code installed and running in this repo
- Node.js >= 18
- `next-app/` dependencies installed: `pnpm install` inside `next-app/`
- Dev server running locally: `pnpm dev` inside `next-app/` (registry endpoint at `http://localhost:3000/r`)

## 1. MCP Server Configuration

The repo ships a `.mcp.json` at the root that connects Claude Code to the local `@saas` registry:

```json
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["-y", "@shadcn/mcp-server@latest"],
      "env": {
        "REGISTRY_URL": "http://localhost:3000/r",
        "REGISTRY_NAME": "saas"
      }
    }
  }
}
```

Claude Code auto-discovers `.mcp.json` at session start — no manual init needed.

## 2. Browse Available Modules

Ask Claude Code to list available modules:

> "What @saas modules are available?"

The agent will invoke the shadcn MCP `list` tool against `http://localhost:3000/r/registry.json`
and display the catalog. You can also browse the [Module Catalog](/modules/) in these docs.

Inspect a specific module before installing:

```bash
curl http://localhost:3000/r/landing.json | jq '{name, title, registryDependencies, envVars: .files[].target}'
```

## 3. Install a Module

### Option A — AI-driven (recommended)

Tell Claude Code to install the module:

> "Install @saas/account"

The agent will:
1. Run `npx shadcn@latest add @saas/account` from `next-app/`
2. Confirm the files landed in the correct target paths
3. Parse `module.manifest.json` for wiring requirements
4. Invoke the paired `install-account` skill automatically

### Option B — Manual CLI install

```bash
cd next-app
npx shadcn@latest add @saas/account
```

Then invoke the install skill in Claude Code:
```
/install-account
```

## 4. Paired `install-*` Skills

Every `@saas` module has a companion Claude Code skill that drives the post-install wiring.

| Module | Install Skill |
|---|---|
| `@saas/landing` | `/install-landing` |
| `@saas/account` | `/install-account` |
| `@saas/admin` | `/install-admin` |
| `@saas/billing-stripe` | `/install-stripe-billing` |
| `@saas/billing-ecpay` | `/install-ecpay-billing` |
| `@saas/hello-module` | _(no post-install steps)_ |

Each skill:

1. Reads `module.manifest.json` to verify all `files[].target` paths exist
2. Checks for required env vars in `.env.local`
3. Runs DB migrations if `dbTables` is non-empty
4. Walks through each `postInstall` step in order
5. Confirms `pnpm typecheck && pnpm lint` pass before declaring success

## 5. What Gets Installed

When you run `npx shadcn@latest add @saas/<id>`, the shadcn CLI:

1. Downloads the item JSON from `http://localhost:3000/r/<id>.json`
2. Resolves and installs `registryDependencies` (shadcn/ui components or other `@saas/*` modules)
3. Writes all module files to their `target` paths inside `next-app/`
4. Installs any `npmDependencies` listed in the manifest (via pnpm)

The `install-*` skill then handles everything the CLI **cannot** do automatically:
- Setting env vars
- Running DB migrations (Drizzle Kit)
- Manual wiring (sidebar nav, branding, pricing tiers)
- Verification (`typecheck` + `lint`)

## 6. End-to-End Example — Install `@saas/landing`

### Tell Claude Code:

> "Install the landing page module and wire it up."

### What the agent does:

**Step 1 — Browse:** Queries `http://localhost:3000/r/landing.json`. Sees:
- `registryDependencies`: `["button", "badge", "card"]`
- `envVars: []` — no secrets needed
- `dbTables: []` — no migrations

**Step 2 — Install:**
```bash
cd next-app && npx shadcn@latest add @saas/landing
```

Expected output:
```
Installing registry dependencies: button, badge, card
Installing @saas/landing...
  + components/marketing/hero.tsx
  + components/marketing/features.tsx
  + components/marketing/pricing.tsx
  + app/(marketing)/layout.tsx
  + app/(marketing)/page.tsx
Done.
```

**Step 3 — Read manifest:**
```bash
cat next-app/registry/landing/module.manifest.json | jq '.postInstall[].description'
```

**Step 4 — Invoke skill:**
```
/install-landing
```

The skill walks through:
1. Pre-flight: confirms `app/(marketing)/page.tsx` exists
2. Remove placeholder: archives `app/page.tsx`
3. Branding: updates site name in `marketing-nav.tsx` and `marketing-footer.tsx`
4. Hero copy: updates headline/subheadline
5. Verify: runs `pnpm typecheck && pnpm lint`

**Step 5 — Verify:**
```bash
cd next-app && pnpm dev
# open http://localhost:3000
```

The landing page renders at `/` with full dark mode support.

## 7. Uninstall

> The registry/MCP provide **no automated uninstall**. Each module's docs page includes a
> **manual uninstall checklist** derived from its `module.manifest.json`.

To uninstall, follow the "Uninstall (Manual Checklist)" section in the module's docs page:
1. Delete files listed in `module.manifest.json` → `files`
2. Drop DB tables via a down-migration (`pnpm db:generate` + edit the SQL)
3. Unset env vars from `.env.local` and your deployment environment
4. Remove npm packages if no longer needed

## 8. Hosted Registry

If the registry is hosted (Cloudflare Pages / Zeabur), update `.mcp.json` and `next-app/components.json`:

```json
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["-y", "@shadcn/mcp-server@latest"],
      "env": {
        "REGISTRY_URL": "https://your-registry.example.com/r",
        "REGISTRY_NAME": "saas",
        "REGISTRY_TOKEN": "${SAAS_REGISTRY_TOKEN}"
      }
    }
  }
}
```

The install command remains the same — `npx shadcn@latest add @saas/<id>`.

## Reference

| Path | Purpose |
|---|---|
| `.mcp.json` | MCP server config — points shadcn MCP at the `@saas` registry |
| `next-app/public/r/registry.json` | Registry index — lists all available modules |
| `next-app/public/r/<module>.json` | Per-module item JSON |
| `next-app/registry/<module>/module.manifest.json` | Manifest — env/db/post-install wiring spec |
| `.claude/skills/install-<module>/SKILL.md` | Paired install skill for each module |

## See Also

- [Module Catalog](/modules/) — all available `@saas` modules
- [Authoring a Module](/docs/guides/authoring-a-module) — build a new module
