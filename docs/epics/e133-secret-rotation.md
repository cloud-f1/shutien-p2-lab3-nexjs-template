# E133 — Secret Rotation Overlap

**Status:** done
**Size:** S (3 SP)

## Goal
Allow JWT verification to accept both current and previous secrets during a rotation window, enabling zero-downtime secret rotation.

## Scope
1. Add `SECRET_KEY_PREVIOUS` and `REFRESH_SECRET_KEY_PREVIOUS` to `Settings`
2. Subclass `JWTStrategy` to try previous key on `InvalidSignatureError`
3. Update `verify_refresh_token` with same dual-key fallback
4. Create `docs/SECRET_ROTATION.md` runbook
5. Unit tests for all rotation scenarios

## Out of Scope
- Automated rotation scheduling
- Key management service integration
