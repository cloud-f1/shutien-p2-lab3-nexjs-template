# API Reference

The @saas template exposes HTTP endpoints via **Next.js Route Handlers** and server-side logic via **Server Actions**.

## Base URL

All route handler endpoints are relative to your deployed Next.js app URL. Configure the base URL in the interactive playground below.

## Endpoints

### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check — returns `{ status: "ok" }` |

### Auth (NextAuth v5)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/auth/session` | Get current session |
| `POST` | `/api/auth/signin` | Sign in with credentials |
| `POST` | `/api/auth/signout` | Sign out |
| `GET` | `/api/auth/callback/:provider` | OAuth callback (Google, GitHub) |
| `GET` | `/api/auth/csrf` | CSRF token for forms |

### Demo Endpoints (installed with modules)

| Method | Path | Module | Description |
|--------|------|--------|-------------|
| `GET` | `/api/demo/landing` | `@saas/landing` | Landing page API demo |
| `GET` | `/api/demo/admin/users` | `@saas/admin` | Admin users list demo |

## Interactive Playground

Configure your deployed Next.js app URL below, then send real HTTP requests:

<ApiPlayground
  defaultEndpoint="/api/health"
  defaultMethod="GET"
  liveAppPath="/"
/>

## Server Actions

Server Actions are not cross-origin callable. They are invoked directly from React components on the server. For cross-origin access, use the route handler endpoints above.

| Action | Module | Description |
|--------|--------|-------------|
| `updateProfile()` | `@saas/account` | Update user display name |
| `changePassword()` | `@saas/account` | Change password (requires current password) |
| `deleteAccount()` | `@saas/account` | Delete own account (danger zone) |
| `listUsers()` | `@saas/admin` | List all users (admin only) |
| `updateUserRole()` | `@saas/admin` | Change a user's role (admin only) |
| `deleteUser()` | `@saas/admin` | Delete a user (admin only) |

To test Server Actions interactively, use the [Live Demo](/demo/) which is the deployed Next.js app.

## Authentication

Most endpoints require a valid NextAuth session. The session cookie is set automatically when you sign in.

For the API playground, enter your session token in the Authorization field:

1. Sign in at `GET /api/auth/session` to inspect your session
2. Use `POST /api/auth/signin` with `{ email, password }` to get a session cookie
3. Subsequent requests will use the session cookie automatically (for same-origin requests)

> **Note:** Cross-origin requests from this docs site will not automatically carry session cookies. Configure CORS on your Next.js app or use the [Live Demo](/demo/) for full interactive testing.
