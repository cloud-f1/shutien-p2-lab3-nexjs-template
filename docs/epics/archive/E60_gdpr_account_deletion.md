# E60 — GDPR Account Self-Deletion

> **Phase**: 19 — Post-v1.0.0 Production Hardening
> **Priority**: P1 | **Points**: 8
> **Depends on**: None (independent)
> **Source**: Cycle 6 audit — Privacy page promises deletion but no endpoint exists

---

## Problem Statement

`fastapi-users` includes `DELETE /users/{id}` (superuser-only). But there is no `DELETE /users/me` endpoint for self-service account deletion (GDPR Art. 17 — right to erasure). The Privacy page (`src/pages/legal/PrivacyPage.tsx`) explicitly states users "can request deletion of their account and associated data", but no such endpoint exists.

## Stories

### E60-S01: OpenAPI Spec — DELETE /users/me (1 pt)

**Task**: Add `DELETE /users/me` operation to `docs/openapi.yaml`.

**Spec**:
- Path: `/api/v1/users/me`
- Method: `DELETE`
- Auth: Bearer token required
- Response: `204 No Content`
- Error: `401 Unauthorized`

**Acceptance Criteria**:
- Given `docs/openapi.yaml`
- When I read the `/users/me` path
- Then a DELETE operation is defined with 204 response

### E60-S02: Server Endpoint (3 pts)

**Task**: Implement `DELETE /users/me` in `server/app/api/v1/endpoints/users.py`.

**Behavior**:
- Authenticate current user via JWT
- Cascade delete: sessions, social_accounts, domain data (places, portfolios — already CASCADE via FK)
- Soft-delete or hard-delete (hard-delete for GDPR compliance)
- Return 204

**Acceptance Criteria**:
- Given an authenticated user
- When they call `DELETE /users/me`
- Then their account and all associated data is deleted
- And subsequent requests with the same token return 401
- And the endpoint is tested with ≥80% coverage

### E60-S03: Client — Delete Account UI (3 pts)

**Task**: Add "Delete Account" button to Dashboard Settings view with confirmation modal.

**UI Flow**:
1. Settings view shows "Delete Account" button (danger style)
2. Click opens confirmation modal: "This action is permanent. Type DELETE to confirm."
3. On confirm: call `DELETE /users/me`, redirect to `/signin` with success message
4. On error: show error banner

**Acceptance Criteria**:
- Given a user on the Dashboard Settings view
- When they click "Delete Account" and confirm
- Then their account is deleted and they are redirected to `/signin`
- And the modal has proper ARIA attributes for accessibility

### E60-S04: Update Privacy Page (1 pt)

**Task**: Update Privacy page to reference the self-service deletion feature instead of "request deletion".

**Acceptance Criteria**:
- Given the Privacy page
- When I read the data deletion section
- Then it mentions the Dashboard Settings self-service option

## Risk Notes

- **Medium risk**: Hard-delete is irreversible — confirmation modal is critical
- **FK cascades**: Verify all domain tables have `ondelete="CASCADE"` on user FK
- **Token invalidation**: After deletion, existing JWTs should fail (user no longer exists)

## Dependency Chain

```
E60-S01 (spec) → E60-S02 (server) → E60-S03 (client) → E60-S04 (privacy page)
```
