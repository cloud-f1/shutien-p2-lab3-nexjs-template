# API Guide

This guide covers the Next.js route handlers and Server Actions that power the @saas template.

## Route Handlers

Route handlers live in `next-app/app/api/` and follow the Next.js App Router convention
(`route.ts` files).

### Health Check

```
GET /api/health
```

Returns `{ status: "ok", timestamp: "..." }`. Use this to verify the deployed app is reachable
and the interactive API playground is pointed at the right base URL.

### Auth Endpoints (NextAuth v5)

```
GET  /api/auth/session          → current session (or null)
POST /api/auth/signin           → credential sign-in
POST /api/auth/signout          → sign out
GET  /api/auth/callback/:provider → OAuth callback
```

NextAuth v5 uses the JWT strategy — sessions are stateless. The session object is:

```ts
type Session = {
  user: {
    id: string
    email: string
    name: string | null
    role: 'viewer' | 'editor' | 'admin'
  }
  expires: string
}
```

## Server Actions

Server Actions (`"use server"`) run on the server and are invoked directly from React
components or client forms. They **cannot** be called cross-origin.

### Account Actions (`actions/account.ts`)

```ts
updateProfile(data: { name: string }): Promise<ActionResult>
changePassword(data: { currentPassword: string; newPassword: string }): Promise<ActionResult>
deleteAccount(): Promise<ActionResult>
```

### Admin Actions (`actions/admin.ts`)

> Requires `admin` role. Returns 403 Forbidden for lower roles.

```ts
listUsers(): Promise<User[]>
updateUserRole(data: { userId: string; role: Role }): Promise<ActionResult>
deleteUser(data: { userId: string }): Promise<ActionResult>
```

## RBAC Guard Pattern

All gated Server Actions use the `requireRole` helper:

```ts
import { requireRole } from '@/lib/permissions'

export async function adminAction() {
  'use server'
  const session = await requireRole('admin')  // throws 403 if insufficient role
  // ... admin logic
}
```

## Error Envelope

All route handlers and Server Actions return a consistent error shape:

```ts
type ActionResult<T = void> = 
  | { success: true; data?: T }
  | { success: false; error: string; code?: string }
```

## Interactive Playground

Test live endpoints against your deployed Next.js app:

<ApiPlayground
  defaultEndpoint="/api/health"
  defaultMethod="GET"
  liveAppPath="/"
/>
