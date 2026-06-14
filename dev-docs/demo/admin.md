# Admin Panel Demo

The `@saas/admin` module provides a user management admin panel, gated by the `admin` role.

**Module:** `@saas/admin` · **Route:** `/dashboard/admin` · [Docs](/modules/admin) · [Install Guide](/modules/admin#installation)

## Live Demo

> Sign in as `admin@example.com` / `Admin123!` to access the admin panel.

<DemoIframe path="/dashboard/admin" title="Admin Panel — Live Demo" :height="600" />

## Features

| Feature | Component | Server Action |
|---------|-----------|--------------|
| User Table | `admin-user-table.tsx` | `listUsers()` |
| Role Selector | `admin-role-selector.tsx` | `updateUserRole()` |
| Delete User | `admin-delete-user-button.tsx` | `deleteUser()` |

## RBAC Gate

The admin panel is protected at three levels:

1. **Middleware** — non-authenticated users are redirected to `/login`
2. **Page level** — `requireRole('admin')` redirects non-admin users to 404
3. **Server Action level** — each action calls `requireRole('admin')` independently

This defense-in-depth ensures no admin operation can be performed without the correct role, even if the page-level check is bypassed.

## API Demo

<ApiPlayground
  defaultEndpoint="/api/demo/admin/users"
  defaultMethod="GET"
  liveAppPath="/dashboard/admin"
/>

> Note: The demo endpoint requires an admin session. Sign in at `/login` first.
