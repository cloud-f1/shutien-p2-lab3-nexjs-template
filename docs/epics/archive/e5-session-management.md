# E5: Session Management — Spec

> **Goal**: Add server-side session tracking with refresh token storage, enabling single-device logout, session listing, and replay detection.

## Current State

- Stateless JWT: refresh tokens are self-verifying JWTs (no server-side storage)
- No session revocation: logout just returns 204 (client discards token)
- No device tracking or session listing
- `tokens.py` already includes `jti` in refresh tokens (prepared for revocation)
- Client has working silent refresh via 401 interceptor + deduplication

## OpenAPI Changes

Added to `docs/openapi.yaml`:
- `GET /users/me/sessions` — list active sessions for current user
- `DELETE /users/me/sessions/{session_id}` — revoke a specific session
- `SessionRead` schema — id, device_info, ip_address, created_at, last_used_at, expires_at, is_current

## Implementation Plan

### 1. Session Model

**New file**: `server/app/models/session.py`

```python
class Session(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "sessions"

    user_id: Mapped[uuid.UUID] = mapped_column(GUID(), ForeignKey("user.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    device_info: Mapped[str] = mapped_column(String(256), default="")
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
```

**Key decisions**:
- `token_hash`: SHA-256 of the refresh token JWT — never store raw tokens
- `is_revoked`: soft-delete for audit trail
- `ondelete="CASCADE"`: user deletion cleans up sessions
- `ip_address`: max 45 chars (IPv6 with zone ID)

### 2. Alembic Migration

**New file**: `server/alembic/versions/002_add_sessions_table.py`

Creates `sessions` table with indexes on `user_id` and `token_hash`.

### 3. Modify Login — Create Session

**Modify**: `server/app/api/v1/endpoints/auth.py`

On successful login:
1. Generate refresh token (existing)
2. Hash the refresh token: `hashlib.sha256(token.encode()).hexdigest()`
3. Create `Session` row with user_id, token_hash, device_info (from User-Agent), ip_address, expires_at
4. Return tokens as before

### 4. Modify Refresh — Rotate Session

**Modify**: `server/app/api/v1/endpoints/auth.py`

On refresh:
1. Verify JWT (existing)
2. Look up session by `token_hash` of incoming refresh token
3. If not found or `is_revoked=True`: **replay detection** — revoke ALL user sessions, return 401
4. If found and valid: issue new tokens, update session's `token_hash` to new token hash, update `last_used_at`

### 5. Modify Logout — Revoke Session

**Modify**: `server/app/api/v1/endpoints/auth.py`

On logout (now requires the refresh token in request body):
1. Hash the provided refresh token
2. Set `is_revoked=True` on matching session
3. Return 204

### 6. New Endpoints — Session Management

**New file**: `server/app/api/v1/endpoints/sessions.py`

```python
@router.get("/", response_model=list[SessionRead])
async def list_sessions(user=Depends(current_active_user), db=Depends(get_db)):
    # Query sessions WHERE user_id = user.id AND is_revoked = False AND expires_at > now
    # Mark is_current based on request's refresh token hash

@router.delete("/{session_id}", status_code=204)
async def revoke_session(session_id: uuid.UUID, user=Depends(current_active_user), db=Depends(get_db)):
    # Find session WHERE id = session_id AND user_id = user.id
    # Set is_revoked = True, return 204 (or 404)
```

Wire in `main.py`: `app.include_router(sessions.router, prefix="/users/me/sessions", tags=["users"])`

### 7. Session Schema

**New file or modify**: `server/app/schemas/session.py`

```python
class SessionRead(BaseModel):
    id: uuid.UUID
    device_info: str
    ip_address: str | None
    created_at: datetime
    last_used_at: datetime
    expires_at: datetime
    is_current: bool
```

### 8. Client — Proactive Refresh

**Modify**: `client/src/api/client.ts`

Add proactive refresh timer:
- On receiving new access token, decode `exp` claim (base64, no verification needed)
- Set `setTimeout` to refresh 60 seconds before expiry
- Clear timer on logout
- Keep existing 401 interceptor as fallback

### 9. Client — Logout Sends Refresh Token

**Modify**: `client/src/api/auth.ts`

Change logout to send refresh token in request body so server can revoke the session.

## Test Plan

### Server Tests

| Test | File | What |
|------|------|------|
| Login creates session row | `test_sessions.py` | After login, session exists in DB with correct user_id |
| Refresh rotates session hash | `test_sessions.py` | After refresh, session token_hash changes |
| Replay detection revokes all | `test_sessions.py` | Using old refresh token after rotation → 401 + all sessions revoked |
| List sessions returns active | `test_sessions.py` | GET /users/me/sessions returns non-revoked, non-expired sessions |
| Revoke session sets is_revoked | `test_sessions.py` | DELETE /users/me/sessions/{id} → session.is_revoked = True |
| Revoke other user's session → 404 | `test_sessions.py` | Can't revoke another user's session |
| Logout revokes session | `test_auth_logout.py` | Logout with refresh token → session marked revoked |

### Client Tests

| Test | File | What |
|------|------|------|
| Proactive refresh fires before expiry | `test_client.ts` | Timer set to (exp - 60s), calls refresh |
| Logout sends refresh token | `test_auth.ts` | logout() includes refresh_token in body |

### Existing Tests

All existing server + client tests must pass. Login/refresh/logout test changes allowed (they need to account for session creation).

## Acceptance Criteria

- [ ] `sessions` table with migration
- [ ] Login creates session, stores hashed refresh token
- [ ] Refresh rotates session token hash, updates last_used_at
- [ ] Replay detection: old token → revoke all user sessions → 401
- [ ] `GET /users/me/sessions` — list active sessions
- [ ] `DELETE /users/me/sessions/{id}` — single-device logout
- [ ] Logout revokes session (sends refresh token)
- [ ] Client proactive refresh (60s before exp)
- [ ] All existing tests pass (with minimal adaptation)

## Out of Scope

- Concurrent login limits (max N sessions per user)
- Session idle timeout (separate from token expiry)
- Admin session management (admin viewing other users' sessions)
- Geolocation from IP (just store raw IP)
