"""Contacts CRUD integration tests + multi-field search."""

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


CONTACT_DATA = {
    "name": "John Doe",
}


async def test_create_contact(client: AsyncClient):
    data = await _register_and_login(client, "contact1@test.com")
    resp = await client.post(
        "/contacts/", json=CONTACT_DATA, headers=_auth(data["access_token"])
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "John Doe"
    assert body["email"] is None
    assert body["phone"] is None
    assert body["company"] is None
    assert body["notes"] is None
    assert body["user_id"] is not None
    assert "id" in body


async def test_create_contact_with_email(client: AsyncClient):
    """Email is optional but must be valid if provided."""
    data = await _register_and_login(client, "contact1b@test.com")
    resp = await client.post(
        "/contacts/",
        json={**CONTACT_DATA, "email": "john@example.com", "company": "Acme Corp"},
        headers=_auth(data["access_token"]),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "john@example.com"
    assert body["company"] == "Acme Corp"


async def test_create_contact_invalid_email(client: AsyncClient):
    """Invalid email format should return 422."""
    data = await _register_and_login(client, "contact1c@test.com")
    resp = await client.post(
        "/contacts/",
        json={**CONTACT_DATA, "email": "not-an-email"},
        headers=_auth(data["access_token"]),
    )
    assert resp.status_code == 422


async def test_create_contact_missing_required(client: AsyncClient):
    data = await _register_and_login(client, "contact2@test.com")
    resp = await client.post(
        "/contacts/",
        json={},
        headers=_auth(data["access_token"]),
    )
    assert resp.status_code == 422


async def test_list_contacts_only_own(client: AsyncClient):
    data1 = await _register_and_login(client, "contact3a@test.com")
    data2 = await _register_and_login(client, "contact3b@test.com")

    await client.post(
        "/contacts/", json=CONTACT_DATA, headers=_auth(data1["access_token"])
    )
    await client.post(
        "/contacts/",
        json=CONTACT_DATA,
        headers=_auth(data2["access_token"]),
    )

    resp = await client.get("/contacts/", headers=_auth(data1["access_token"]))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1


async def test_list_contacts_search(client: AsyncClient):
    """CRM-specific: multi-field search with ?q= parameter."""
    data = await _register_and_login(client, "contact3c@test.com")
    headers = _auth(data["access_token"])

    # Create contacts with different data
    await client.post(
        "/contacts/",
        json={"name": "Alice Smith", "email": "alice@acme.com", "company": "Acme Corp"},
        headers=headers,
    )
    await client.post(
        "/contacts/",
        json={"name": "Bob Jones", "email": "bob@widgets.com", "company": "Widget Inc"},
        headers=headers,
    )
    await client.post(
        "/contacts/",
        json={"name": "Charlie Acme", "company": "Other Corp"},
        headers=headers,
    )

    # Search by company name
    resp = await client.get("/contacts/?q=Acme", headers=headers)
    body = resp.json()
    assert body["total"] == 2  # Alice (company=Acme) + Charlie (name=Acme)

    # Search by email domain
    resp2 = await client.get("/contacts/?q=widgets", headers=headers)
    body2 = resp2.json()
    assert body2["total"] == 1
    assert body2["items"][0]["name"] == "Bob Jones"

    # No match
    resp3 = await client.get("/contacts/?q=nonexistent", headers=headers)
    body3 = resp3.json()
    assert body3["total"] == 0


async def test_list_contacts_notes_preview(client: AsyncClient):
    """CRM-specific: notes_preview is truncated to 200 chars."""
    data = await _register_and_login(client, "contact3d@test.com")
    headers = _auth(data["access_token"])

    long_notes = "A" * 500
    await client.post(
        "/contacts/",
        json={**CONTACT_DATA, "notes": long_notes},
        headers=headers,
    )

    resp = await client.get("/contacts/", headers=headers)
    body = resp.json()
    item = body["items"][0]
    assert item["notes_preview"] is not None
    assert len(item["notes_preview"]) == 203  # 200 chars + "..."
    assert item["notes_preview"].endswith("...")


async def test_list_contacts_pagination(client: AsyncClient):
    data = await _register_and_login(client, "contact4@test.com")
    headers = _auth(data["access_token"])

    for i in range(3):
        item_data = {**CONTACT_DATA}
        item_data["name"] = f"Contact {i}"
        await client.post("/contacts/", json=item_data, headers=headers)

    resp = await client.get("/contacts/?page=1&page_size=2", headers=headers)
    body = resp.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["page"] == 1

    resp2 = await client.get("/contacts/?page=2&page_size=2", headers=headers)
    body2 = resp2.json()
    assert len(body2["items"]) == 1


async def test_get_contact_by_id(client: AsyncClient):
    data = await _register_and_login(client, "contact5@test.com")
    headers = _auth(data["access_token"])

    create_resp = await client.post("/contacts/", json=CONTACT_DATA, headers=headers)
    item_id = create_resp.json()["id"]

    resp = await client.get(f"/contacts/{item_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == item_id


async def test_get_contact_full_notes(client: AsyncClient):
    """Detail endpoint returns full notes (not truncated)."""
    data = await _register_and_login(client, "contact5b@test.com")
    headers = _auth(data["access_token"])

    long_notes = "B" * 500
    create_resp = await client.post(
        "/contacts/",
        json={**CONTACT_DATA, "notes": long_notes},
        headers=headers,
    )
    item_id = create_resp.json()["id"]

    resp = await client.get(f"/contacts/{item_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["notes"] == long_notes
    assert len(resp.json()["notes"]) == 500


async def test_get_other_users_contact_returns_404(client: AsyncClient):
    data1 = await _register_and_login(client, "contact6a@test.com")
    data2 = await _register_and_login(client, "contact6b@test.com")

    create_resp = await client.post(
        "/contacts/", json=CONTACT_DATA, headers=_auth(data1["access_token"])
    )
    item_id = create_resp.json()["id"]

    resp = await client.get(
        f"/contacts/{item_id}", headers=_auth(data2["access_token"])
    )
    assert resp.status_code == 404


async def test_update_contact(client: AsyncClient):
    data = await _register_and_login(client, "contact7@test.com")
    headers = _auth(data["access_token"])

    create_resp = await client.post("/contacts/", json=CONTACT_DATA, headers=headers)
    item_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/contacts/{item_id}",
        json={"name": "Jane Doe"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Jane Doe"


async def test_update_other_users_contact_returns_404(client: AsyncClient):
    data1 = await _register_and_login(client, "contact8a@test.com")
    data2 = await _register_and_login(client, "contact8b@test.com")

    create_resp = await client.post(
        "/contacts/", json=CONTACT_DATA, headers=_auth(data1["access_token"])
    )
    item_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/contacts/{item_id}",
        json={"name": "Hacked"},
        headers=_auth(data2["access_token"]),
    )
    assert resp.status_code == 404


async def test_delete_contact(client: AsyncClient):
    data = await _register_and_login(client, "contact9@test.com")
    headers = _auth(data["access_token"])

    create_resp = await client.post("/contacts/", json=CONTACT_DATA, headers=headers)
    item_id = create_resp.json()["id"]

    resp = await client.delete(f"/contacts/{item_id}", headers=headers)
    assert resp.status_code == 204

    resp2 = await client.get(f"/contacts/{item_id}", headers=headers)
    assert resp2.status_code == 404


async def test_delete_other_users_contact_returns_404(client: AsyncClient):
    data1 = await _register_and_login(client, "contact10a@test.com")
    data2 = await _register_and_login(client, "contact10b@test.com")

    create_resp = await client.post(
        "/contacts/", json=CONTACT_DATA, headers=_auth(data1["access_token"])
    )
    item_id = create_resp.json()["id"]

    resp = await client.delete(
        f"/contacts/{item_id}", headers=_auth(data2["access_token"])
    )
    assert resp.status_code == 404
