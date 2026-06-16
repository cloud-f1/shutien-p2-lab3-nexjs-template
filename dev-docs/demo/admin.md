# Admin Panel Demo

The `@saas/admin` module provides a user management admin panel, gated by the `admin` role.

**Module:** `@saas/admin` · **Route:** `/dashboard/admin` · [Docs](/modules/admin) · [Install Guide](/modules/admin#installation)

## Live Demo

> Sign in as `admin@example.com` / `Admin123!` to access the admin panel.

<DemoIframe path="/dashboard/admin" title="Admin Panel — Live Demo" :height="600" />

## Features

| Feature | Component | Server Action (`actions/admin.ts`) |
|---------|-----------|--------------|
| User Table | `admin-user-table.tsx` | `getAllUsers()` |
| Role Selector | `admin-role-selector.tsx` | `setUserRole(userId, role)` |
| Delete User | `admin-delete-user-button.tsx` | `deleteUser(userId)` |

## RBAC Gate

The admin panel is protected at three levels:

1. **Edge middleware** (`proxy.ts`) — non-authenticated users are redirected to `/login`
2. **Page level** — the page calls `requireAdmin()`, which re-reads the role from the DB and redirects non-admins to `/dashboard`
3. **Server Action level** — each action in `actions/admin.ts` calls `requireAdmin()` independently

This defense-in-depth ensures no admin operation can be performed without the correct role, even if the page-level check is bypassed. Because the guard re-reads the role from the database (not the JWT snapshot), a demotion takes effect immediately.

## Server Actions

User management runs entirely through Server Actions in `actions/admin.ts` (`getAllUsers`,
`setUserRole`, `deleteUser`) — not HTTP endpoints — so there is nothing cross-origin to call.
Each action re-reads the caller's role from the DB via `requireAdmin()`. See the
[API Reference](/api/server-actions#admin-actions) for signatures.

## Live App

<ApiPlayground
  defaultEndpoint="/api/health"
  defaultMethod="GET"
  liveAppPath="/dashboard/admin"
/>

> Note: The admin panel requires an admin session. Sign in as `admin@example.com` first.
