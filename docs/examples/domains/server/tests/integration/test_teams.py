"""Team CRUD, member management, and RBAC tests."""

from httpx import AsyncClient


async def _register_and_login(
    client: AsyncClient, email: str, password: str = "Secure#Pass1"
) -> dict:
    await client.post("/auth/register", json={"email": email, "password": password})
    resp = await client.post(
        "/auth/jwt/login",
        data={"username": email, "password": password},
    )
    return resp.json()


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


TEAM_DATA = {"name": "Test Team", "slug": "test-team"}


# ── Team CRUD ────────────────────────────────────────────────────


async def test_create_team(client: AsyncClient):
    data = await _register_and_login(client, "team1@test.com")
    resp = await client.post("/teams/", json=TEAM_DATA, headers=_auth(data["access_token"]))
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Test Team"
    assert body["slug"] == "test-team"
    assert body["member_count"] == 1
    assert "id" in body


async def test_create_team_auto_slug(client: AsyncClient):
    data = await _register_and_login(client, "team2@test.com")
    resp = await client.post(
        "/teams/", json={"name": "My Cool Team"}, headers=_auth(data["access_token"])
    )
    assert resp.status_code == 201
    assert resp.json()["slug"] == "my-cool-team"


async def test_create_team_duplicate_slug(client: AsyncClient):
    data = await _register_and_login(client, "team3@test.com")
    headers = _auth(data["access_token"])
    await client.post("/teams/", json={"name": "A", "slug": "dup-slug"}, headers=headers)
    resp = await client.post("/teams/", json={"name": "B", "slug": "dup-slug"}, headers=headers)
    assert resp.status_code == 409
    assert resp.json()["detail"] == "TEAM_SLUG_EXISTS"


async def test_list_teams(client: AsyncClient):
    data = await _register_and_login(client, "team4@test.com")
    headers = _auth(data["access_token"])
    await client.post("/teams/", json={"name": "Team A", "slug": "list-a"}, headers=headers)
    await client.post("/teams/", json={"name": "Team B", "slug": "list-b"}, headers=headers)

    resp = await client.get("/teams/", headers=headers)
    assert resp.status_code == 200
    teams = resp.json()
    slugs = [t["slug"] for t in teams]
    assert "list-a" in slugs
    assert "list-b" in slugs
    # Should include my_role
    for t in teams:
        if t["slug"] in ("list-a", "list-b"):
            assert t["my_role"] == "owner"


async def test_get_team(client: AsyncClient):
    data = await _register_and_login(client, "team5@test.com")
    headers = _auth(data["access_token"])
    create_resp = await client.post(
        "/teams/", json={"name": "Get Team", "slug": "get-team"}, headers=headers
    )
    team_id = create_resp.json()["id"]

    resp = await client.get(f"/teams/{team_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == team_id


async def test_get_team_non_member_returns_403(client: AsyncClient):
    data1 = await _register_and_login(client, "team6a@test.com")
    data2 = await _register_and_login(client, "team6b@test.com")

    create_resp = await client.post(
        "/teams/",
        json={"name": "Private", "slug": "private-team"},
        headers=_auth(data1["access_token"]),
    )
    team_id = create_resp.json()["id"]

    resp = await client.get(f"/teams/{team_id}", headers=_auth(data2["access_token"]))
    assert resp.status_code == 403


async def test_update_team(client: AsyncClient):
    data = await _register_and_login(client, "team7@test.com")
    headers = _auth(data["access_token"])
    create_resp = await client.post(
        "/teams/", json={"name": "Old Name", "slug": "update-team"}, headers=headers
    )
    team_id = create_resp.json()["id"]

    resp = await client.patch(f"/teams/{team_id}", json={"name": "New Name"}, headers=headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "New Name"


async def test_delete_team(client: AsyncClient):
    data = await _register_and_login(client, "team8@test.com")
    headers = _auth(data["access_token"])
    create_resp = await client.post(
        "/teams/", json={"name": "Delete Me", "slug": "delete-team"}, headers=headers
    )
    team_id = create_resp.json()["id"]

    resp = await client.delete(f"/teams/{team_id}", headers=headers)
    assert resp.status_code == 204

    # Verify deleted
    resp2 = await client.get(f"/teams/{team_id}", headers=headers)
    # After delete, membership doesn't exist -> 403 (not a member)
    assert resp2.status_code in (403, 404)


# ── Member Management ────────────────────────────────────────────


async def test_add_member(client: AsyncClient):
    owner_data = await _register_and_login(client, "team9a@test.com")
    member_data = await _register_and_login(client, "team9b@test.com")

    # Get the user id of the member
    member_resp = await client.get("/users/me", headers=_auth(member_data["access_token"]))
    member_user_id = member_resp.json()["id"]

    # Create team
    create_resp = await client.post(
        "/teams/",
        json={"name": "Member Team", "slug": "member-team"},
        headers=_auth(owner_data["access_token"]),
    )
    team_id = create_resp.json()["id"]

    # Add member
    resp = await client.post(
        f"/teams/{team_id}/members",
        json={"user_id": member_user_id, "role": "editor"},
        headers=_auth(owner_data["access_token"]),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["role"] == "editor"
    assert body["user_id"] == member_user_id
    assert body["user"]["email"] == "team9b@test.com"


async def test_add_member_already_exists(client: AsyncClient):
    owner_data = await _register_and_login(client, "team10a@test.com")
    member_data = await _register_and_login(client, "team10b@test.com")

    member_resp = await client.get("/users/me", headers=_auth(member_data["access_token"]))
    member_user_id = member_resp.json()["id"]

    create_resp = await client.post(
        "/teams/",
        json={"name": "Dup Member", "slug": "dup-member-team"},
        headers=_auth(owner_data["access_token"]),
    )
    team_id = create_resp.json()["id"]

    await client.post(
        f"/teams/{team_id}/members",
        json={"user_id": member_user_id, "role": "viewer"},
        headers=_auth(owner_data["access_token"]),
    )

    # Try adding again
    resp = await client.post(
        f"/teams/{team_id}/members",
        json={"user_id": member_user_id, "role": "editor"},
        headers=_auth(owner_data["access_token"]),
    )
    assert resp.status_code == 409
    assert resp.json()["detail"] == "MEMBER_ALREADY_EXISTS"


async def test_list_members(client: AsyncClient):
    owner_data = await _register_and_login(client, "team11a@test.com")
    member_data = await _register_and_login(client, "team11b@test.com")

    member_resp = await client.get("/users/me", headers=_auth(member_data["access_token"]))
    member_user_id = member_resp.json()["id"]

    create_resp = await client.post(
        "/teams/",
        json={"name": "List Members", "slug": "list-members-team"},
        headers=_auth(owner_data["access_token"]),
    )
    team_id = create_resp.json()["id"]

    await client.post(
        f"/teams/{team_id}/members",
        json={"user_id": member_user_id, "role": "viewer"},
        headers=_auth(owner_data["access_token"]),
    )

    resp = await client.get(f"/teams/{team_id}/members", headers=_auth(owner_data["access_token"]))
    assert resp.status_code == 200
    members = resp.json()
    assert len(members) == 2  # owner + viewer
    roles = {m["role"] for m in members}
    assert "owner" in roles
    assert "viewer" in roles


async def test_update_member_role(client: AsyncClient):
    owner_data = await _register_and_login(client, "team12a@test.com")
    member_data = await _register_and_login(client, "team12b@test.com")

    member_resp = await client.get("/users/me", headers=_auth(member_data["access_token"]))
    member_user_id = member_resp.json()["id"]

    create_resp = await client.post(
        "/teams/",
        json={"name": "Update Role", "slug": "update-role-team"},
        headers=_auth(owner_data["access_token"]),
    )
    team_id = create_resp.json()["id"]

    await client.post(
        f"/teams/{team_id}/members",
        json={"user_id": member_user_id, "role": "viewer"},
        headers=_auth(owner_data["access_token"]),
    )

    resp = await client.patch(
        f"/teams/{team_id}/members/{member_user_id}",
        json={"role": "editor"},
        headers=_auth(owner_data["access_token"]),
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "editor"


async def test_remove_member(client: AsyncClient):
    owner_data = await _register_and_login(client, "team13a@test.com")
    member_data = await _register_and_login(client, "team13b@test.com")

    member_resp = await client.get("/users/me", headers=_auth(member_data["access_token"]))
    member_user_id = member_resp.json()["id"]

    create_resp = await client.post(
        "/teams/",
        json={"name": "Remove Member", "slug": "remove-member-team"},
        headers=_auth(owner_data["access_token"]),
    )
    team_id = create_resp.json()["id"]

    await client.post(
        f"/teams/{team_id}/members",
        json={"user_id": member_user_id, "role": "editor"},
        headers=_auth(owner_data["access_token"]),
    )

    resp = await client.delete(
        f"/teams/{team_id}/members/{member_user_id}",
        headers=_auth(owner_data["access_token"]),
    )
    assert resp.status_code == 204


# ── RBAC / Role Hierarchy ────────────────────────────────────────


async def test_viewer_cannot_update_team(client: AsyncClient):
    owner_data = await _register_and_login(client, "team14a@test.com")
    viewer_data = await _register_and_login(client, "team14b@test.com")

    viewer_resp = await client.get("/users/me", headers=_auth(viewer_data["access_token"]))
    viewer_user_id = viewer_resp.json()["id"]

    create_resp = await client.post(
        "/teams/",
        json={"name": "RBAC Team", "slug": "rbac-team"},
        headers=_auth(owner_data["access_token"]),
    )
    team_id = create_resp.json()["id"]

    await client.post(
        f"/teams/{team_id}/members",
        json={"user_id": viewer_user_id, "role": "viewer"},
        headers=_auth(owner_data["access_token"]),
    )

    # Viewer tries to update team
    resp = await client.patch(
        f"/teams/{team_id}",
        json={"name": "Hacked"},
        headers=_auth(viewer_data["access_token"]),
    )
    assert resp.status_code == 403


async def test_editor_cannot_manage_members(client: AsyncClient):
    owner_data = await _register_and_login(client, "team15a@test.com")
    editor_data = await _register_and_login(client, "team15b@test.com")
    new_user_data = await _register_and_login(client, "team15c@test.com")

    editor_resp = await client.get("/users/me", headers=_auth(editor_data["access_token"]))
    editor_user_id = editor_resp.json()["id"]

    new_user_resp = await client.get("/users/me", headers=_auth(new_user_data["access_token"]))
    new_user_id = new_user_resp.json()["id"]

    create_resp = await client.post(
        "/teams/",
        json={"name": "Editor Team", "slug": "editor-team"},
        headers=_auth(owner_data["access_token"]),
    )
    team_id = create_resp.json()["id"]

    await client.post(
        f"/teams/{team_id}/members",
        json={"user_id": editor_user_id, "role": "editor"},
        headers=_auth(owner_data["access_token"]),
    )

    # Editor tries to add a member
    resp = await client.post(
        f"/teams/{team_id}/members",
        json={"user_id": new_user_id, "role": "viewer"},
        headers=_auth(editor_data["access_token"]),
    )
    assert resp.status_code == 403


async def test_editor_cannot_delete_team(client: AsyncClient):
    owner_data = await _register_and_login(client, "team16a@test.com")
    editor_data = await _register_and_login(client, "team16b@test.com")

    editor_resp = await client.get("/users/me", headers=_auth(editor_data["access_token"]))
    editor_user_id = editor_resp.json()["id"]

    create_resp = await client.post(
        "/teams/",
        json={"name": "No Delete", "slug": "no-delete-team"},
        headers=_auth(owner_data["access_token"]),
    )
    team_id = create_resp.json()["id"]

    await client.post(
        f"/teams/{team_id}/members",
        json={"user_id": editor_user_id, "role": "editor"},
        headers=_auth(owner_data["access_token"]),
    )

    resp = await client.delete(f"/teams/{team_id}", headers=_auth(editor_data["access_token"]))
    assert resp.status_code == 403


async def test_admin_can_update_team(client: AsyncClient):
    owner_data = await _register_and_login(client, "team17a@test.com")
    admin_data = await _register_and_login(client, "team17b@test.com")

    admin_resp = await client.get("/users/me", headers=_auth(admin_data["access_token"]))
    admin_user_id = admin_resp.json()["id"]

    create_resp = await client.post(
        "/teams/",
        json={"name": "Admin Team", "slug": "admin-team"},
        headers=_auth(owner_data["access_token"]),
    )
    team_id = create_resp.json()["id"]

    await client.post(
        f"/teams/{team_id}/members",
        json={"user_id": admin_user_id, "role": "admin"},
        headers=_auth(owner_data["access_token"]),
    )

    resp = await client.patch(
        f"/teams/{team_id}",
        json={"name": "Updated by Admin"},
        headers=_auth(admin_data["access_token"]),
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated by Admin"


async def test_admin_cannot_delete_team(client: AsyncClient):
    owner_data = await _register_and_login(client, "team18a@test.com")
    admin_data = await _register_and_login(client, "team18b@test.com")

    admin_resp = await client.get("/users/me", headers=_auth(admin_data["access_token"]))
    admin_user_id = admin_resp.json()["id"]

    create_resp = await client.post(
        "/teams/",
        json={"name": "Admin No Del", "slug": "admin-no-del"},
        headers=_auth(owner_data["access_token"]),
    )
    team_id = create_resp.json()["id"]

    await client.post(
        f"/teams/{team_id}/members",
        json={"user_id": admin_user_id, "role": "admin"},
        headers=_auth(owner_data["access_token"]),
    )

    resp = await client.delete(f"/teams/{team_id}", headers=_auth(admin_data["access_token"]))
    assert resp.status_code == 403


async def test_cannot_remove_owner(client: AsyncClient):
    owner_data = await _register_and_login(client, "team19@test.com")
    headers = _auth(owner_data["access_token"])

    # Get owner's user ID
    me_resp = await client.get("/users/me", headers=headers)
    owner_user_id = me_resp.json()["id"]

    create_resp = await client.post(
        "/teams/", json={"name": "Owner Test", "slug": "owner-test"}, headers=headers
    )
    team_id = create_resp.json()["id"]

    resp = await client.delete(f"/teams/{team_id}/members/{owner_user_id}", headers=headers)
    assert resp.status_code == 403
    assert resp.json()["detail"] == "CANNOT_REMOVE_OWNER"


async def test_cannot_change_owner_role(client: AsyncClient):
    owner_data = await _register_and_login(client, "team20@test.com")
    headers = _auth(owner_data["access_token"])

    me_resp = await client.get("/users/me", headers=headers)
    owner_user_id = me_resp.json()["id"]

    create_resp = await client.post(
        "/teams/", json={"name": "Owner Role", "slug": "owner-role"}, headers=headers
    )
    team_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/teams/{team_id}/members/{owner_user_id}",
        json={"role": "editor"},
        headers=headers,
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "CANNOT_CHANGE_OWNER_ROLE"


async def test_cannot_assign_owner_role(client: AsyncClient):
    owner_data = await _register_and_login(client, "team21a@test.com")
    member_data = await _register_and_login(client, "team21b@test.com")

    member_resp = await client.get("/users/me", headers=_auth(member_data["access_token"]))
    member_user_id = member_resp.json()["id"]

    create_resp = await client.post(
        "/teams/",
        json={"name": "No Owner Assign", "slug": "no-owner-assign"},
        headers=_auth(owner_data["access_token"]),
    )
    team_id = create_resp.json()["id"]

    # Try to add as owner
    resp = await client.post(
        f"/teams/{team_id}/members",
        json={"user_id": member_user_id, "role": "owner"},
        headers=_auth(owner_data["access_token"]),
    )
    assert resp.status_code == 403


async def test_unauthenticated_create_team(client: AsyncClient):
    resp = await client.post("/teams/", json=TEAM_DATA)
    assert resp.status_code == 401


async def test_viewer_can_read_team(client: AsyncClient):
    owner_data = await _register_and_login(client, "team22a@test.com")
    viewer_data = await _register_and_login(client, "team22b@test.com")

    viewer_resp = await client.get("/users/me", headers=_auth(viewer_data["access_token"]))
    viewer_user_id = viewer_resp.json()["id"]

    create_resp = await client.post(
        "/teams/",
        json={"name": "Viewer Read", "slug": "viewer-read"},
        headers=_auth(owner_data["access_token"]),
    )
    team_id = create_resp.json()["id"]

    await client.post(
        f"/teams/{team_id}/members",
        json={"user_id": viewer_user_id, "role": "viewer"},
        headers=_auth(owner_data["access_token"]),
    )

    # Viewer can read team
    resp = await client.get(f"/teams/{team_id}", headers=_auth(viewer_data["access_token"]))
    assert resp.status_code == 200

    # Viewer can list members
    resp2 = await client.get(
        f"/teams/{team_id}/members", headers=_auth(viewer_data["access_token"])
    )
    assert resp2.status_code == 200
