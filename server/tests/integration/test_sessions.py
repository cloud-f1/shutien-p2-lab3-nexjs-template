"""Session management tests — creation, rotation, revocation, listing."""

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.tokens import hash_token
from app.models.session import Session


async def _register_and_login(
    client: AsyncClient, email: str, password: str = "Secure#Pass1"
) -> dict:
    await client.post("/auth/register", json={"email": email, "password": password})
    resp = await client.post(
        "/auth/jwt/login",
        data={"username": email, "password": password},
    )
    return resp.json()


async def test_login_creates_session(client: AsyncClient, db: AsyncSession):
    data = await _register_and_login(client, "sess1@test.com")
    token_h = hash_token(data["refresh_token"])
    result = await db.execute(select(Session).where(Session.token_hash == token_h))
    session = result.scalar_one_or_none()
    assert session is not None
    assert session.is_revoked is False


async def test_refresh_rotates_session_hash(client: AsyncClient, db: AsyncSession):
    """E161: rotation marks the old session row revoked (keeps the hash) and
    creates a NEW row with a fresh hash + same family_id. Old behaviour was
    to overwrite the hash in place — that prevented reuse detection."""
    data = await _register_and_login(client, "sess2@test.com")
    old_hash = hash_token(data["refresh_token"])

    resp = await client.post("/auth/refresh", json={"refresh_token": data["refresh_token"]})
    assert resp.status_code == 200
    new_data = resp.json()
    new_hash = hash_token(new_data["refresh_token"])

    # Old session row still exists but is now revoked (so future reuse triggers family-revoke).
    old_result = await db.execute(select(Session).where(Session.token_hash == old_hash))
    old_session = old_result.scalar_one_or_none()
    assert old_session is not None
    assert old_session.is_revoked is True
    assert old_session.revoked_at is not None

    # New session row exists with the rotated hash and links back via parent_hash.
    new_result = await db.execute(select(Session).where(Session.token_hash == new_hash))
    new_session = new_result.scalar_one_or_none()
    assert new_session is not None
    assert new_session.is_revoked is False
    assert new_session.parent_hash == old_hash
    assert new_session.family_id == old_session.family_id


async def test_replay_detection_revokes_all(client: AsyncClient, db: AsyncSession):
    """Using an old refresh token after rotation revokes ALL user sessions."""
    data = await _register_and_login(client, "sess3@test.com")
    old_refresh = data["refresh_token"]

    # Rotate once — old token is now stale
    resp = await client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert resp.status_code == 200

    # Try to use the OLD token again — should trigger replay detection
    resp2 = await client.post("/auth/refresh", json={"refresh_token": old_refresh})
    assert resp2.status_code == 401

    # The new session from rotation should also be revoked by replay detection
    new_hash = hash_token(resp.json()["refresh_token"])
    revoked_result = await db.execute(select(Session).where(Session.token_hash == new_hash))
    revoked_session = revoked_result.scalar_one_or_none()
    assert revoked_session is not None
    assert revoked_session.is_revoked is True


async def test_list_sessions(client: AsyncClient):
    data = await _register_and_login(client, "sess4@test.com")
    access = data["access_token"]

    resp = await client.get(
        "/users/me/sessions/",
        headers={"Authorization": f"Bearer {access}"},
    )
    assert resp.status_code == 200
    sessions = resp.json()
    assert len(sessions) >= 1
    assert "device_info" in sessions[0]
    assert "expires_at" in sessions[0]


async def test_revoke_session(client: AsyncClient, db: AsyncSession):
    data = await _register_and_login(client, "sess5@test.com")
    access = data["access_token"]

    # Get session list
    resp = await client.get(
        "/users/me/sessions/",
        headers={"Authorization": f"Bearer {access}"},
    )
    sessions = resp.json()
    session_id = sessions[0]["id"]

    # Revoke it
    resp2 = await client.delete(
        f"/users/me/sessions/{session_id}",
        headers={"Authorization": f"Bearer {access}"},
    )
    assert resp2.status_code == 204

    # Verify revoked in DB
    result = await db.execute(select(Session).where(Session.id == session_id))
    session = result.scalar_one_or_none()
    assert session is not None
    assert session.is_revoked is True


async def test_revoke_other_users_session_returns_404(client: AsyncClient):
    """Cannot revoke another user's session."""
    data1 = await _register_and_login(client, "sess6a@test.com")
    data2 = await _register_and_login(client, "sess6b@test.com")

    # Get user1's session
    resp1 = await client.get(
        "/users/me/sessions/",
        headers={"Authorization": f"Bearer {data1['access_token']}"},
    )
    session_id = resp1.json()[0]["id"]

    # Try to revoke with user2's token
    resp2 = await client.delete(
        f"/users/me/sessions/{session_id}",
        headers={"Authorization": f"Bearer {data2['access_token']}"},
    )
    assert resp2.status_code == 404


async def test_logout_revokes_session(client: AsyncClient, db: AsyncSession):
    data = await _register_and_login(client, "sess7@test.com")
    token_h = hash_token(data["refresh_token"])

    resp = await client.post(
        "/auth/jwt/logout",
        headers={"Authorization": f"Bearer {data['access_token']}"},
        json={"refresh_token": data["refresh_token"]},
    )
    assert resp.status_code == 204

    result = await db.execute(select(Session).where(Session.token_hash == token_h))
    session = result.scalar_one_or_none()
    assert session is not None
    assert session.is_revoked is True
