"""E161 — auth session store + reuse detection integration tests.

Covers:
  * GET  /auth/sessions       — list active sessions for the current user
  * DELETE /auth/sessions/{id} — revoke a single session
  * POST /auth/logout-all     — revoke all sessions in one transaction
  * POST /auth/refresh        — rotation chains + reuse-detection family revoke
"""

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_refresh_token, verify_refresh_token
from app.core.tokens import hash_token
from app.models.session import Session


async def _register(client: AsyncClient, email: str, password: str = "Secure#Pass1") -> dict:
    """Register a user and return the unified AuthResponse payload."""
    resp = await client.post("/auth/register", json={"email": email, "password": password})
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _login(client: AsyncClient, email: str, password: str = "Secure#Pass1") -> dict:
    resp = await client.post(
        "/auth/jwt/login",
        data={"username": email, "password": password},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


# ── /auth/refresh: normal rotation ───────────────────────────────────


async def test_refresh_normal_rotation_marks_old_revoked(client: AsyncClient, db: AsyncSession):
    """A successful rotation returns a new pair AND leaves the old session
    row in the table marked as revoked (with a populated ``revoked_at``)."""
    data = await _register(client, "rotate1@test.com")
    old_rt = data["refresh_token"]

    resp = await client.post("/auth/refresh", json={"refresh_token": old_rt})
    assert resp.status_code == 200
    new_data = resp.json()
    assert new_data["refresh_token"] != old_rt
    assert new_data["user"]["email"] == "rotate1@test.com"

    # Old session row is now revoked.
    old_row = (
        await db.execute(select(Session).where(Session.token_hash == hash_token(old_rt)))
    ).scalar_one()
    assert old_row.is_revoked is True
    assert old_row.revoked_at is not None

    # New session row is active and chained back to the old via parent_hash.
    new_row = (
        await db.execute(
            select(Session).where(Session.token_hash == hash_token(new_data["refresh_token"]))
        )
    ).scalar_one()
    assert new_row.is_revoked is False
    assert new_row.parent_hash == hash_token(old_rt)
    assert new_row.family_id == old_row.family_id


# ── /auth/refresh: reuse detection → family revoke ──────────────────


async def test_refresh_reuse_revokes_entire_family(client: AsyncClient, db: AsyncSession):
    """Sending an already-rotated RT must revoke every session sharing the
    same family_id and respond 401 ``SESSION_REVOKED``."""
    data = await _register(client, "reuse1@test.com")
    rt0 = data["refresh_token"]

    # First rotation — yields rt1, marks rt0's row revoked.
    r1 = await client.post("/auth/refresh", json={"refresh_token": rt0})
    assert r1.status_code == 200
    rt1 = r1.json()["refresh_token"]

    # Second rotation off rt1 — yields rt2. Family now has 3 rows.
    r2 = await client.post("/auth/refresh", json={"refresh_token": rt1})
    assert r2.status_code == 200
    rt2 = r2.json()["refresh_token"]

    # Reuse the long-rotated rt0 — classic theft signal.
    bad = await client.post("/auth/refresh", json={"refresh_token": rt0})
    assert bad.status_code == 401
    assert bad.json()["error"]["message"] == "SESSION_REVOKED"

    # Every session in this family must now be revoked, including the
    # currently-active rt2 row.
    family_id = (
        (await db.execute(select(Session).where(Session.token_hash == hash_token(rt0))))
        .scalar_one()
        .family_id
    )

    rows = (await db.execute(select(Session).where(Session.family_id == family_id))).scalars().all()
    assert len(rows) == 3
    assert all(r.is_revoked for r in rows), [(str(r.id), r.is_revoked, r.revoked_at) for r in rows]

    # Using rt2 (which the attacker wouldn't have stolen yet) must also fail.
    after = await client.post("/auth/refresh", json={"refresh_token": rt2})
    assert after.status_code == 401


async def test_refresh_unknown_token_revokes_all_user_sessions(
    client: AsyncClient, db: AsyncSession
):
    """A signed-but-unknown RT (e.g. attacker forged via a stolen secret, or a
    token from an already-purged family) is treated as reuse: revoke every
    session for that user_id."""
    data = await _register(client, "unknown1@test.com")
    legit_rt = data["refresh_token"]

    # Sanity: the security helpers behave symmetrically.
    assert verify_refresh_token(legit_rt, hash_refresh_token(legit_rt)) is True

    # Forge a "twin" RT by re-issuing one server-side. It is signature-valid
    # but corresponds to no row in the sessions table.
    from app.core.tokens import create_refresh_token, verify_refresh_token as jwt_verify

    uid = jwt_verify(legit_rt)
    forged = create_refresh_token(uid)
    # The forged token is signature-valid but has no session row.
    bad = await client.post("/auth/refresh", json={"refresh_token": forged})
    assert bad.status_code == 401
    assert bad.json()["error"]["message"] == "SESSION_REVOKED"

    # All sessions for the user are now revoked (defensive sweep).
    rows = (await db.execute(select(Session).where(Session.user_id == uid))).scalars().all()
    assert rows
    assert all(r.is_revoked for r in rows)


# ── /auth/sessions: list ─────────────────────────────────────────────


async def test_list_sessions_returns_active_only(client: AsyncClient):
    """GET /auth/sessions returns the rows the user can revoke from the UI."""
    data = await _register(client, "list1@test.com")
    access = data["access_token"]

    # Login a second time → second active session.
    await _login(client, "list1@test.com")

    resp = await client.get(
        "/auth/sessions",
        headers={"Authorization": f"Bearer {access}"},
    )
    assert resp.status_code == 200
    sessions = resp.json()
    assert len(sessions) >= 2
    for s in sessions:
        assert "id" in s
        assert "created_at" in s
        assert "last_used_at" in s


async def test_list_sessions_excludes_revoked(client: AsyncClient, db: AsyncSession):
    data = await _register(client, "list2@test.com")
    access = data["access_token"]

    # Revoke this user's sessions directly to verify the filter.
    from datetime import datetime, timezone

    from sqlalchemy import update

    from app.models.user import User

    uid = (await db.execute(select(User.id).where(User.email == "list2@test.com"))).scalar_one()
    await db.execute(
        update(Session)
        .where(Session.user_id == uid)
        .values(is_revoked=True, revoked_at=datetime.now(timezone.utc))
    )
    await db.commit()

    resp = await client.get(
        "/auth/sessions",
        headers={"Authorization": f"Bearer {access}"},
    )
    # Access token still verifies (stateless JWT) but no active session rows remain.
    assert resp.status_code == 200
    assert resp.json() == []


# ── /auth/sessions/{id}: revoke single ───────────────────────────────


async def test_revoke_single_session(client: AsyncClient, db: AsyncSession):
    data = await _register(client, "rev1@test.com")
    access = data["access_token"]

    listing = await client.get(
        "/auth/sessions",
        headers={"Authorization": f"Bearer {access}"},
    )
    sid = listing.json()[0]["id"]

    resp = await client.delete(
        f"/auth/sessions/{sid}",
        headers={"Authorization": f"Bearer {access}"},
    )
    assert resp.status_code == 204

    row = (await db.execute(select(Session).where(Session.id == sid))).scalar_one()
    assert row.is_revoked is True
    assert row.revoked_at is not None


async def test_revoke_other_users_session_is_404(client: AsyncClient):
    a = await _register(client, "rev-a@test.com")
    b = await _register(client, "rev-b@test.com")

    a_sessions = (
        await client.get(
            "/auth/sessions",
            headers={"Authorization": f"Bearer {a['access_token']}"},
        )
    ).json()
    a_sid = a_sessions[0]["id"]

    resp = await client.delete(
        f"/auth/sessions/{a_sid}",
        headers={"Authorization": f"Bearer {b['access_token']}"},
    )
    assert resp.status_code == 404


# ── /auth/logout-all ─────────────────────────────────────────────────


async def test_logout_all_revokes_every_session(client: AsyncClient, db: AsyncSession):
    """Sign-out-everywhere flips every active session for the user in a single
    transaction and leaves the access token usable until it expires (stateless)."""
    data = await _register(client, "logoutall@test.com")
    access = data["access_token"]

    # Spin up two more login sessions.
    await _login(client, "logoutall@test.com")
    await _login(client, "logoutall@test.com")

    # Sanity: at least 3 active sessions.
    pre = await client.get("/auth/sessions", headers={"Authorization": f"Bearer {access}"})
    assert len(pre.json()) >= 3

    resp = await client.post("/auth/logout-all", headers={"Authorization": f"Bearer {access}"})
    assert resp.status_code == 204

    post = await client.get("/auth/sessions", headers={"Authorization": f"Bearer {access}"})
    assert post.json() == []

    # Refresh tokens are now useless — the rt rows are revoked and a reuse
    # attempt on any of them collapses the (single-row) families.
    bad = await client.post("/auth/refresh", json={"refresh_token": data["refresh_token"]})
    assert bad.status_code == 401


# ── /auth/sessions auth gate ─────────────────────────────────────────


async def test_session_endpoints_require_auth(client: AsyncClient):
    assert (await client.get("/auth/sessions")).status_code == 401
    import uuid

    fake = uuid.uuid4()
    assert (await client.delete(f"/auth/sessions/{fake}")).status_code == 401
    assert (await client.post("/auth/logout-all")).status_code == 401
