---
title: "Admin Dashboard Module"
description: "User management admin panel gated by 3-tier RBAC (admin-only). Provides user table, role selector, and delete-user action."
---

# 🛡️ Admin Dashboard

<div class="module-card-tags" style="margin-bottom: 1rem;"><span class="module-card-tag">Database</span> <span class="module-card-tag">Server Actions</span> <span class="module-card-tag">Auth Required</span> <span class="module-card-tag">RBAC</span></div>

> **Module ID:** `@saas/admin` | **Version:** 1.0.0

User management admin panel gated by 3-tier RBAC (admin-only). Provides user table, role selector, and delete-user action.

## Installation

```bash
npx shadcn@latest add @saas/admin
```

## Dependencies

- `@saas/auth`
- `@saas/rbac`

## Routes

- `(dashboard)/admin/page.tsx`

## Server Actions

- `actions/admin.ts`

## Database Tables

- `users`

## Post-Install Steps

**Step 1** (manual): Verify the role enum migration is present. The users table must have a 'role' pgEnum column with values ['admin', 'editor', 'viewer']. Run: pnpm db:generate && pnpm db:migrate if the column is missing.

**Step 2** (manual): Wire the admin nav link in your sidebar. Add a conditional link to '/dashboard/admin' visible only when isAdmin(session.user.role) is true. Import isAdmin from '@/lib/is-admin'.

## Live Demo

<DemoIframe path="/demo/admin" title="Admin Dashboard — Live Demo" :height="550" />

## API Demonstration

<ApiPlayground
  defaultEndpoint="/api/demo/admin/users"
  defaultMethod="GET"
  liveAppPath="/demo/admin"
/>

> **Server Actions note:** Server Actions (`"use server"`) are not callable
> cross-origin. Use the "Try in Live App" link above to interact with them.
