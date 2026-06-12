"""Places CRUD + nearby query tests."""

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


PLACE_DATA = {
    "name": "Test Place",
    "address": "123 Test St",
    "description": "A test place",
    "latitude": 25.033,
    "longitude": 121.565,
    "category": "restaurant",
}


async def test_create_place(client: AsyncClient):
    data = await _register_and_login(client, "place1@test.com")
    resp = await client.post("/places/", json=PLACE_DATA, headers=_auth(data["access_token"]))
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Test Place"
    assert body["latitude"] == 25.033
    assert body["user_id"] is not None
    assert "id" in body


async def test_create_place_missing_name(client: AsyncClient):
    data = await _register_and_login(client, "place2@test.com")
    resp = await client.post(
        "/places/",
        json={"latitude": 25.0, "longitude": 121.0},
        headers=_auth(data["access_token"]),
    )
    assert resp.status_code == 422


async def test_list_places_only_own(client: AsyncClient):
    data1 = await _register_and_login(client, "place3a@test.com")
    data2 = await _register_and_login(client, "place3b@test.com")

    # User 1 creates a place
    await client.post("/places/", json=PLACE_DATA, headers=_auth(data1["access_token"]))
    # User 2 creates a place
    await client.post(
        "/places/",
        json={**PLACE_DATA, "name": "User2 Place"},
        headers=_auth(data2["access_token"]),
    )

    # User 1 should only see their place
    resp = await client.get("/places/", headers=_auth(data1["access_token"]))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["name"] == "Test Place"


async def test_list_places_pagination(client: AsyncClient):
    data = await _register_and_login(client, "place4@test.com")
    headers = _auth(data["access_token"])

    # Create 3 places
    for i in range(3):
        await client.post(
            "/places/",
            json={**PLACE_DATA, "name": f"Place {i}"},
            headers=headers,
        )

    # Page 1, size 2
    resp = await client.get("/places/?page=1&page_size=2", headers=headers)
    body = resp.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["page"] == 1

    # Page 2, size 2
    resp2 = await client.get("/places/?page=2&page_size=2", headers=headers)
    body2 = resp2.json()
    assert len(body2["items"]) == 1


async def test_get_place_by_id(client: AsyncClient):
    data = await _register_and_login(client, "place5@test.com")
    headers = _auth(data["access_token"])

    create_resp = await client.post("/places/", json=PLACE_DATA, headers=headers)
    place_id = create_resp.json()["id"]

    resp = await client.get(f"/places/{place_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == place_id


async def test_get_other_users_place_returns_404(client: AsyncClient):
    data1 = await _register_and_login(client, "place6a@test.com")
    data2 = await _register_and_login(client, "place6b@test.com")

    create_resp = await client.post(
        "/places/", json=PLACE_DATA, headers=_auth(data1["access_token"])
    )
    place_id = create_resp.json()["id"]

    resp = await client.get(f"/places/{place_id}", headers=_auth(data2["access_token"]))
    assert resp.status_code == 404


async def test_update_place(client: AsyncClient):
    data = await _register_and_login(client, "place7@test.com")
    headers = _auth(data["access_token"])

    create_resp = await client.post("/places/", json=PLACE_DATA, headers=headers)
    place_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/places/{place_id}",
        json={"name": "Updated Place", "category": "cafe"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Place"
    assert resp.json()["category"] == "cafe"
    # Unchanged fields should persist
    assert resp.json()["latitude"] == 25.033


async def test_update_other_users_place_returns_404(client: AsyncClient):
    data1 = await _register_and_login(client, "place8a@test.com")
    data2 = await _register_and_login(client, "place8b@test.com")

    create_resp = await client.post(
        "/places/", json=PLACE_DATA, headers=_auth(data1["access_token"])
    )
    place_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/places/{place_id}",
        json={"name": "Hacked"},
        headers=_auth(data2["access_token"]),
    )
    assert resp.status_code == 404


async def test_delete_place(client: AsyncClient):
    data = await _register_and_login(client, "place9@test.com")
    headers = _auth(data["access_token"])

    create_resp = await client.post("/places/", json=PLACE_DATA, headers=headers)
    place_id = create_resp.json()["id"]

    resp = await client.delete(f"/places/{place_id}", headers=headers)
    assert resp.status_code == 204

    # Verify deleted
    resp2 = await client.get(f"/places/{place_id}", headers=headers)
    assert resp2.status_code == 404


async def test_delete_other_users_place_returns_404(client: AsyncClient):
    data1 = await _register_and_login(client, "place10a@test.com")
    data2 = await _register_and_login(client, "place10b@test.com")

    create_resp = await client.post(
        "/places/", json=PLACE_DATA, headers=_auth(data1["access_token"])
    )
    place_id = create_resp.json()["id"]

    resp = await client.delete(f"/places/{place_id}", headers=_auth(data2["access_token"]))
    assert resp.status_code == 404


async def test_nearby_returns_places_within_radius(client: AsyncClient):
    data = await _register_and_login(client, "place11@test.com")
    headers = _auth(data["access_token"])

    # Taipei 101 area
    await client.post(
        "/places/",
        json={**PLACE_DATA, "name": "Near", "latitude": 25.034, "longitude": 121.564},
        headers=headers,
    )
    # Kaohsiung (far away)
    await client.post(
        "/places/",
        json={**PLACE_DATA, "name": "Far", "latitude": 22.627, "longitude": 120.301},
        headers=headers,
    )

    resp = await client.get(
        "/places/nearby?latitude=25.033&longitude=121.565&radius_km=5",
        headers=headers,
    )
    assert resp.status_code == 200
    names = [p["name"] for p in resp.json()]
    assert "Near" in names
    assert "Far" not in names


async def test_nearby_excludes_distant_places(client: AsyncClient):
    data = await _register_and_login(client, "place12@test.com")
    headers = _auth(data["access_token"])

    # Place in Tokyo
    await client.post(
        "/places/",
        json={**PLACE_DATA, "name": "Tokyo", "latitude": 35.681, "longitude": 139.767},
        headers=headers,
    )

    # Search near Taipei with small radius
    resp = await client.get(
        "/places/nearby?latitude=25.033&longitude=121.565&radius_km=1",
        headers=headers,
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 0
