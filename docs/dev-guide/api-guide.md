# API Guide

> Full endpoint reference with DB design and security: [../techstack/server.md](../techstack/server.md).
> OpenAPI spec (single source of truth): [../openapi.yaml](../openapi.yaml).

## Auth Endpoints (`/auth`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | -- | Create account, return token pair |
| `POST` | `/auth/login` | -- | Email + password login |
| `POST` | `/auth/refresh` | -- | Rotate token pair (old token invalidated) |
| `POST` | `/auth/logout` | Bearer | Revoke refresh token |
| `GET` | `/auth/verify-email` | -- | `?token=` email confirmation |
| `POST` | `/auth/forgot-password` | -- | Send reset link (always 200 — prevents email enumeration) |
| `POST` | `/auth/reset-password` | -- | Set new password with token |
| `GET` | `/auth/social/{provider}` | -- | OAuth2 redirect (Google) |
| `GET` | `/auth/social/{provider}/callback` | -- | OAuth2 callback -> JWT |

## User Endpoints (`/users`)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/users/me` | Bearer | Get current user |
| `PATCH` | `/users/me` | Bearer | Update profile (display_name, avatar_url) |
| `GET` | `/users/me/sessions` | Bearer | List active sessions (expired auto-pruned) |
| `DELETE` | `/users/me/sessions/{id}` | Bearer | Terminate session (remote logout) |

## Health Endpoint

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | -- | Service health check |

## Error Codes

| HTTP | Code | Description |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Request schema mismatch |
| 401 | `INVALID_TOKEN` | JWT invalid or expired |
| 401 | `INVALID_CREDENTIALS` | Wrong email or password |
| 403 | `EMAIL_NOT_VERIFIED` | Email not verified |
| 404 | `USER_NOT_FOUND` | User does not exist |
| 429 | `RATE_LIMITED` | Auth route rate limit exceeded (5 req/min) |

## Rate Limiting

Auth routes are protected by `slowapi` at 5 requests/minute per IP. Exceeding the limit returns `429` with a `Retry-After` header.

## Code Examples

See [../techstack/server.md](../techstack/server.md#security-architecture) for server route patterns and [../techstack/client.md](../techstack/client.md#api-client--interceptors) for client API usage.
