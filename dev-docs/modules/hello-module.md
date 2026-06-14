---
title: "Hello Module"
description: "Smoke-test registry item that proves the @saas registry install loop end-to-end."
---

# 👋 Hello Module

> **Module ID:** `@saas/hello-module` | **Version:** 1.0.0 | **Purpose:** Smoke test / reference

Smoke-test registry item that proves the `@saas` registry install loop end-to-end. Use this as the minimal "does my registry work?" check and as a reference for authoring new modules.

## Installation

```bash
npx shadcn@latest add @saas/hello-module
```

## Dependencies

_No dependencies_

## Routes

_No routes_

## Server Actions

_No server actions_

## Database Tables

_No database tables_

## Environment Variables

_No environment variables_

## Files Installed

| File | Target Path |
|---|---|
| `components/hello-banner.tsx` | Renders a simple "Hello from @saas registry" banner |
| `lib/hello-utils.ts` | Utility helpers shipped with the module |

## Post-Install Steps

_No post-install steps — files are ready to use immediately after install._

Verify the files landed:

```bash
ls next-app/components/hello-banner.tsx
ls next-app/lib/hello-utils.ts
```

## Use as a Template

The hello-module is the canonical minimal module reference. Copy its structure when authoring a new module:

```
registry/
  hello-module/
    module.manifest.json    # declares id, files, deps
    components/
      hello-banner.tsx      # component file
    lib/
      hello-utils.ts        # utility file
```

See the [Authoring a Module guide](/docs/guides/authoring-a-module) for the full scaffolding workflow.

## Uninstall (Manual Checklist)

1. Delete `next-app/components/hello-banner.tsx`
2. Delete `next-app/lib/hello-utils.ts`
3. Remove any import references to these files from your app code
