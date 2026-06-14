# Auth Endpoints

NextAuth v5 exposes the following route handlers under `/api/auth/`.

## GET /api/auth/session

Returns the current session or `null` if not authenticated.

**Response (authenticated):**

```json
{
  "user": {
    "id": "uuid-v4",
    "email": "user@example.com",
    "name": "Alice",
    "role": "viewer"
  },
  "expires": "2026-07-14T12:00:00.000Z"
}
```

**Response (unauthenticated):**

```json
null
```

<ApiPlayground
  defaultEndpoint="/api/auth/session"
  defaultMethod="GET"
  liveAppPath="/dashboard"
/>

## POST /api/auth/signin

Sign in with email and password.

**Request body:**

```json
{
  "email": "user@example.com",
  "password": "User123!",
  "redirect": false
}
```

**Response (success):**

Sets a session cookie and redirects (or returns JSON if `redirect: false`).

<ApiPlayground
  defaultEndpoint="/api/auth/signin"
  defaultMethod="POST"
  defaultBody='{"email":"user@example.com","password":"User123!","redirect":false}'
  liveAppPath="/login"
/>

## POST /api/auth/signout

Sign out the current user. Clears the session cookie.

## GET /api/auth/callback/:provider

OAuth callback. Called by the OAuth provider after user authorization.

- `/api/auth/callback/google`
- `/api/auth/callback/github`

These are handled automatically by NextAuth — you do not call them directly.

## Roles

| Role | Permissions |
|------|-------------|
| `viewer` | Read-only access |
| `editor` | Create and edit content |
| `admin` | Full access including user management |
