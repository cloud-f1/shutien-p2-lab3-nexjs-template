---
title: "Account Settings Module"
description: "User profile, password change, and danger-zone (delete account) settings module for the @saas stack."
---

# 👤 Account Settings

<div class="module-card-tags" style="margin-bottom: 1rem;"><span class="module-card-tag">Database</span> <span class="module-card-tag">Server Actions</span> <span class="module-card-tag">Auth Required</span></div>

> **Module ID:** `@saas/account` | **Version:** 1.0.0

User profile, password change, and danger-zone (delete account) settings module for the @saas stack.

## Installation

```bash
npx shadcn@latest add @saas/account
```

## Dependencies

- `@saas/auth`

## Routes

- `(dashboard)/dashboard/settings/page.tsx`

## Server Actions

- `actions/account.ts`

## Database Tables

- `users`

## Post-Install Steps

**Step 1** (manual): Wire the settings route into the dashboard sidebar navigation (nav-main.tsx or app-sidebar.tsx) by adding a link to '/dashboard/settings'.

**Step 2** (manual): Ensure auth primitives (lib/permissions.ts, lib/password.ts, lib/db.ts, lib/schema.ts with usersTable) are present — this module depends on them.

## Live Demo

<DemoIframe path="/dashboard/settings" title="Account Settings — Live Demo" :height="550" />

## API Demonstration

<ApiPlayground
  defaultEndpoint="/api/health"
  defaultMethod="GET"
  liveAppPath="/dashboard/settings"
/>

> **Server Actions note:** Server Actions (`"use server"`) are not callable
> cross-origin. Use the "Try in Live App" link above to interact with them.
