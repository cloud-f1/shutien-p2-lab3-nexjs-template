# E161 — Auth Adapter Removal + Session Store + Reuse Detection (One-Shot)

> Phase 40 — Self-Review Improvements | Size: L (8 SP) | Deps: none
> Source: self-review 2026-04-24 — close auth tech debt in a single bundled epic, no sunset dance

## Problem

Client `src/api/auth.ts` contains an adapter layer that:

- Composes `{ user } + { access_token, refresh_token }` into the client's expected `AuthResponse` shape
- Auto-logs-in after register (calling login endpoint internally)
- Existed historically because backend didn't return refresh tokens

Per `MEMORY.md`: *"Refresh token shim removed — backend now returns refresh tokens."* Yet the adapter is still load-bearing, and several risks accumulate:

1. **No sunset date in `decisions.md`** — so no one knows when to delete it
2. **Token rotation** — refresh rotates on use, but there's no session-id store, so **remote logout** ("log me out of all devices") is impossible
3. **Token theft** — no detection of reused refresh tokens (classic session-hijack indicator)
4. **Client token cache** — `tokenCache.ts` (in-memory) is the right design, but has no tests for the edge cases (tab reload, multi-tab sync, clock skew)

## Solution — one epic, one PR, no tracks

The user directive is to **finish this end-to-end in one go, not split into a sunset plan**. Deliver in a single bundled PR:

### Part A — Align backend response shape + delete adapter

- `docs/openapi.yaml` — `POST /auth/register`, `POST /auth/jwt/login`, `POST /auth/refresh` all return identical `AuthResponse` shape: `{ user, access_token, refresh_token, token_type, expires_in }`
- Server: update endpoints to return `AuthResponse` directly (no partial returns, no "compose at client")
- Client `src/api/auth.ts` — **delete** all adapter/composition functions; replace with thin typed wrappers that return the server shape verbatim
- Client `src/hooks/useAuth.ts` — consume `AuthResponse` directly, drop the register auto-login workaround

### Part B — Session store + remote logout

- `server/app/models/session.py` — `UserSession(id, user_id, refresh_token_hash, created_at, last_used_at, ip, user_agent, revoked_at)`
- `POST /auth/refresh` — verifies refresh_token hash against active session, rotates, updates `last_used_at`
- `POST /auth/logout-all` — revokes all sessions for current user (superuser UI + user-facing "sign out everywhere")
- `GET /auth/sessions` — user sees active sessions (last N), can revoke one

### Part C — Reuse detection

- If a refresh token arrives for an already-rotated session (reuse) → revoke **entire session family** (all refresh tokens descended from the same login) and force re-auth
- Log `SecurityEvent{type: "refresh_reuse", user_id, ip}` to Sentry breadcrumb + `health-log.md`

## Key Files

| File | Action |
|------|--------|
| `docs/context/decisions.md` | Edit — single entry `AUTH_UNIFIED_RESPONSE_SHAPE` documenting the decision + completion date |
| `client/src/api/auth.ts` | **Delete adapter functions** — replace with straight-through wrappers |
| `client/src/hooks/useAuth.ts` | Edit — remove register auto-login workaround, consume AuthResponse directly |
| `docs/openapi.yaml` | Edit FIRST — unified `AuthResponse`, add `/auth/sessions`, `/auth/logout-all` |
| `server/alembic/versions/<rev>_user_sessions.py` | New — migration (paired with E157 review gate!) |
| `server/app/models/session.py` | New |
| `server/app/api/v1/endpoints/auth.py` | Edit — session lifecycle + reuse detection |
| `server/app/core/security.py` | Edit — `hash_refresh_token`, `verify_refresh_token` |
| `server/tests/integration/test_auth_sessions.py` | New — remote logout, reuse detection, multi-device |
| `client/src/api/sessions.ts` | New — service for session list/revoke |
| `client/src/pages/dashboard/SecuritySessionsView.tsx` | New — dashboard view |

## Implementation Highlights

### Session model (sketch)

```python
# server/app/models/session.py
from sqlalchemy import Column, DateTime, ForeignKey, String, Boolean
from sqlalchemy.orm import relationship
from app.db.base_class import Base
from app.db.types import GUID
import uuid

class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    family_id = Column(GUID, nullable=False, index=True)  # rotation family
    refresh_token_hash = Column(String, nullable=False, unique=True, index=True)
    parent_hash = Column(String, nullable=True)  # previous token in rotation chain
    created_at = Column(DateTime, nullable=False)
    last_used_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True, index=True)
    ip = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)

    user = relationship("User", back_populates="sessions")
```

### Reuse detection flow

```
POST /auth/refresh with RT_old
  - lookup session by hash(RT_old)
  - if session.revoked_at IS NOT NULL:
      → revoke ALL sessions with same family_id
      → log SecurityEvent(refresh_reuse)
      → return 401 with body {"code": "session_revoked"}
  - else:
      → mark current session revoked
      → create new session (same family_id, parent_hash=hash(RT_old))
      → return new access + refresh pair
```

### openapi.yaml contract additions

```yaml
paths:
  /auth/sessions:
    get:
      summary: List active sessions for current user
      responses:
        '200':
          content:
            application/json:
              schema:
                type: array
                items: { $ref: '#/components/schemas/UserSessionRead' }
  /auth/sessions/{session_id}:
    delete:
      summary: Revoke a specific session
      responses: { '204': { description: Revoked } }
  /auth/logout-all:
    post:
      summary: Revoke all sessions for current user
      responses: { '204': { description: All sessions revoked } }
```

## Alignment / Cross-Epic Hooks

- **Gated by E156**: new unified `AuthResponse` must pass Schemathesis contract conformance (runs in @qa Phase 2.5). Any drift fails the epic.
- **Gated by E157**: `user_sessions` table migration triggers @qa Phase 2.6 migration review. @dba signoff required due to `CREATE TABLE` + foreign-key + unique-index red flags.
- **Emits to E159**: refresh-token reuse detection fires `SecurityEvent{type:"refresh_reuse"}` as a Sentry breadcrumb (requires E159 Sentry init landed; if not, falls back to `health-log.md` only).
- **Removes**: `decisions.md` entry for `AUTH_ADAPTER_SUNSET` dance (we're doing it now, not sunsetting)
- **Adds**: `decisions.md` entry `AUTH_UNIFIED_RESPONSE_SHAPE` marked `Status: COMPLETED`
- **Does NOT bump** Stop-verifier rule count
- **Agent team**: no new agents (uses existing @qa, @dba)

## Acceptance Criteria

- [ ] `openapi.yaml` edited first — unified `AuthResponse` across register/login/refresh + session endpoints
- [ ] `client/src/api/auth.ts` adapter functions **deleted** (not commented, not marked TODO — removed)
- [ ] `useAuth.ts` register path no longer does implicit login (server now returns tokens)
- [ ] `decisions.md` records `AUTH_UNIFIED_RESPONSE_SHAPE` as completed (not pending)
- [ ] Migration reviewed via E157 `scripts/migration-review.sh` with @dba sign-off
- [ ] `POST /auth/refresh` with reused RT returns 401 `session_revoked` and revokes the entire family
- [ ] `POST /auth/logout-all` revokes all active sessions in single transaction
- [ ] `GET /auth/sessions` returns list excluding revoked
- [ ] Dashboard Security → Sessions view renders + supports per-row revoke
- [ ] Integration tests cover: normal rotation, reuse → family revoke, logout-all, concurrent refresh race (optimistic lock), register returns same shape as login
- [ ] E156 contract conformance passes against the new `AuthResponse`
- [ ] No localStorage use added (reuse `tokenCache.ts` + in-memory only)
- [ ] Zero references to "adapter" / "compose" remain in `api/auth.ts` or `useAuth.ts`

## Out of Scope

- Passkey / WebAuthn — separate future epic
- Device fingerprinting beyond `user_agent` + `ip`
