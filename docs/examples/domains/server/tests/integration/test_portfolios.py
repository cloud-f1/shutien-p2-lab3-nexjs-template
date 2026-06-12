"""Portfolio CRUD, membership, and analytics tests."""

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
    "latitude": 25.033,
    "longitude": 121.565,
    "category": "residential",
}

PORTFOLIO_DATA = {"name": "My Portfolio", "description": "Test portfolio"}


async def _create_place(client: AsyncClient, headers: dict, **overrides) -> dict:
    resp = await client.post("/places/", json={**PLACE_DATA, **overrides}, headers=headers)
    assert resp.status_code == 201
    return resp.json()


async def _create_portfolio(client: AsyncClient, headers: dict, **overrides) -> dict:
    resp = await client.post("/portfolios/", json={**PORTFOLIO_DATA, **overrides}, headers=headers)
    assert resp.status_code == 201
    return resp.json()


# ---------------------------------------------------------------------------
# Portfolio CRUD
# ---------------------------------------------------------------------------


async def test_create_portfolio(client: AsyncClient):
    data = await _register_and_login(client, "pf1@test.com")
    headers = _auth(data["access_token"])

    resp = await client.post("/portfolios/", json=PORTFOLIO_DATA, headers=headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "My Portfolio"
    assert body["description"] == "Test portfolio"
    assert body["place_count"] == 0
    assert body["total_value"] == "0.00"
    assert "id" in body


async def test_create_portfolio_missing_name(client: AsyncClient):
    data = await _register_and_login(client, "pf2@test.com")
    resp = await client.post(
        "/portfolios/", json={"description": "no name"}, headers=_auth(data["access_token"])
    )
    assert resp.status_code == 422


async def test_list_portfolios_pagination(client: AsyncClient):
    data = await _register_and_login(client, "pf3@test.com")
    headers = _auth(data["access_token"])

    for i in range(3):
        await _create_portfolio(client, headers, name=f"Portfolio {i}")

    resp = await client.get("/portfolios/?page=1&page_size=2", headers=headers)
    body = resp.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["pages"] == 2

    resp2 = await client.get("/portfolios/?page=2&page_size=2", headers=headers)
    assert len(resp2.json()["items"]) == 1


async def test_get_portfolio_detail(client: AsyncClient):
    data = await _register_and_login(client, "pf4@test.com")
    headers = _auth(data["access_token"])

    portfolio = await _create_portfolio(client, headers)
    place = await _create_place(client, headers)

    # Add place with investment data
    await client.post(
        f"/portfolios/{portfolio['id']}/places",
        json={"place_id": place["id"], "purchase_price": 1000000, "current_value": 1200000},
        headers=headers,
    )

    resp = await client.get(f"/portfolios/{portfolio['id']}", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["place_count"] == 1
    assert body["total_value"] == "1200000.00"
    assert body["total_purchase"] == "1000000.00"
    assert body["gain_loss"] == "200000.00"
    assert body["gain_loss_pct"] == "20.00"
    assert len(body["places"]) == 1


async def test_update_portfolio(client: AsyncClient):
    data = await _register_and_login(client, "pf5@test.com")
    headers = _auth(data["access_token"])

    portfolio = await _create_portfolio(client, headers)
    resp = await client.patch(
        f"/portfolios/{portfolio['id']}",
        json={"name": "Renamed"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["name"] == "Renamed"
    assert resp.json()["description"] == "Test portfolio"  # unchanged


async def test_delete_portfolio(client: AsyncClient):
    data = await _register_and_login(client, "pf6@test.com")
    headers = _auth(data["access_token"])

    portfolio = await _create_portfolio(client, headers)
    resp = await client.delete(f"/portfolios/{portfolio['id']}", headers=headers)
    assert resp.status_code == 204

    resp2 = await client.get(f"/portfolios/{portfolio['id']}", headers=headers)
    assert resp2.status_code == 404


async def test_cross_user_isolation(client: AsyncClient):
    data1 = await _register_and_login(client, "pf7a@test.com")
    data2 = await _register_and_login(client, "pf7b@test.com")

    portfolio = await _create_portfolio(client, _auth(data1["access_token"]))

    # User 2 can't see user 1's portfolio
    resp = await client.get(f"/portfolios/{portfolio['id']}", headers=_auth(data2["access_token"]))
    assert resp.status_code == 404

    # User 2's list is empty
    resp2 = await client.get("/portfolios/", headers=_auth(data2["access_token"]))
    assert resp2.json()["total"] == 0


# ---------------------------------------------------------------------------
# Portfolio <-> Place membership
# ---------------------------------------------------------------------------


async def test_add_place_to_portfolio(client: AsyncClient):
    data = await _register_and_login(client, "pf8@test.com")
    headers = _auth(data["access_token"])

    portfolio = await _create_portfolio(client, headers)
    place = await _create_place(client, headers)

    resp = await client.post(
        f"/portfolios/{portfolio['id']}/places",
        json={"place_id": place["id"], "purchase_price": 500000, "current_value": 600000},
        headers=headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["purchase_price"] == "500000.00"
    assert body["current_value"] == "600000.00"
    assert body["gain_loss"] == "100000.00"
    assert body["place"]["name"] == "Test Place"


async def test_add_duplicate_place_returns_409(client: AsyncClient):
    data = await _register_and_login(client, "pf9@test.com")
    headers = _auth(data["access_token"])

    portfolio = await _create_portfolio(client, headers)
    place = await _create_place(client, headers)

    await client.post(
        f"/portfolios/{portfolio['id']}/places",
        json={"place_id": place["id"]},
        headers=headers,
    )
    resp = await client.post(
        f"/portfolios/{portfolio['id']}/places",
        json={"place_id": place["id"]},
        headers=headers,
    )
    assert resp.status_code == 409
    assert resp.json()["detail"] == "PLACE_ALREADY_IN_PORTFOLIO"


async def test_add_other_users_place_returns_404(client: AsyncClient):
    data1 = await _register_and_login(client, "pf10a@test.com")
    data2 = await _register_and_login(client, "pf10b@test.com")

    portfolio = await _create_portfolio(client, _auth(data1["access_token"]))
    place = await _create_place(client, _auth(data2["access_token"]))

    resp = await client.post(
        f"/portfolios/{portfolio['id']}/places",
        json={"place_id": place["id"]},
        headers=_auth(data1["access_token"]),
    )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "PLACE_NOT_FOUND"


async def test_list_portfolio_places(client: AsyncClient):
    data = await _register_and_login(client, "pf11@test.com")
    headers = _auth(data["access_token"])

    portfolio = await _create_portfolio(client, headers)
    place1 = await _create_place(client, headers, name="Place A")
    place2 = await _create_place(client, headers, name="Place B")

    await client.post(
        f"/portfolios/{portfolio['id']}/places",
        json={"place_id": place1["id"]},
        headers=headers,
    )
    await client.post(
        f"/portfolios/{portfolio['id']}/places",
        json={"place_id": place2["id"]},
        headers=headers,
    )

    resp = await client.get(f"/portfolios/{portfolio['id']}/places", headers=headers)
    assert resp.status_code == 200
    assert len(resp.json()) == 2


async def test_update_nonexistent_membership_returns_404(client: AsyncClient):
    data = await _register_and_login(client, "pf11b@test.com")
    headers = _auth(data["access_token"])

    portfolio = await _create_portfolio(client, headers)
    fake_place_id = "00000000-0000-0000-0000-000000000000"

    resp = await client.patch(
        f"/portfolios/{portfolio['id']}/places/{fake_place_id}",
        json={"current_value": 999},
        headers=headers,
    )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "PORTFOLIO_PLACE_NOT_FOUND"


async def test_remove_nonexistent_membership_returns_404(client: AsyncClient):
    data = await _register_and_login(client, "pf11c@test.com")
    headers = _auth(data["access_token"])

    portfolio = await _create_portfolio(client, headers)
    fake_place_id = "00000000-0000-0000-0000-000000000000"

    resp = await client.delete(
        f"/portfolios/{portfolio['id']}/places/{fake_place_id}",
        headers=headers,
    )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "PORTFOLIO_PLACE_NOT_FOUND"


async def test_update_portfolio_place(client: AsyncClient):
    data = await _register_and_login(client, "pf12@test.com")
    headers = _auth(data["access_token"])

    portfolio = await _create_portfolio(client, headers)
    place = await _create_place(client, headers)

    await client.post(
        f"/portfolios/{portfolio['id']}/places",
        json={"place_id": place["id"], "purchase_price": 100000, "current_value": 100000},
        headers=headers,
    )

    resp = await client.patch(
        f"/portfolios/{portfolio['id']}/places/{place['id']}",
        json={"current_value": 150000, "notes": "Appreciated"},
        headers=headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["current_value"] == "150000.00"
    assert body["purchase_price"] == "100000.00"  # unchanged
    assert body["gain_loss"] == "50000.00"
    assert body["notes"] == "Appreciated"


async def test_remove_place_from_portfolio(client: AsyncClient):
    data = await _register_and_login(client, "pf13@test.com")
    headers = _auth(data["access_token"])

    portfolio = await _create_portfolio(client, headers)
    place = await _create_place(client, headers)

    await client.post(
        f"/portfolios/{portfolio['id']}/places",
        json={"place_id": place["id"]},
        headers=headers,
    )

    resp = await client.delete(
        f"/portfolios/{portfolio['id']}/places/{place['id']}", headers=headers
    )
    assert resp.status_code == 204

    # Verify removed
    resp2 = await client.get(f"/portfolios/{portfolio['id']}/places", headers=headers)
    assert len(resp2.json()) == 0


async def test_delete_portfolio_cascades_memberships(client: AsyncClient):
    data = await _register_and_login(client, "pf14@test.com")
    headers = _auth(data["access_token"])

    portfolio = await _create_portfolio(client, headers)
    place = await _create_place(client, headers)

    await client.post(
        f"/portfolios/{portfolio['id']}/places",
        json={"place_id": place["id"]},
        headers=headers,
    )

    await client.delete(f"/portfolios/{portfolio['id']}", headers=headers)

    # Place still exists
    resp = await client.get(f"/places/{place['id']}", headers=headers)
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Analytics
# ---------------------------------------------------------------------------


async def test_analytics_with_places(client: AsyncClient):
    data = await _register_and_login(client, "pf15@test.com")
    headers = _auth(data["access_token"])

    portfolio = await _create_portfolio(client, headers)
    place1 = await _create_place(client, headers, name="Apt A", category="residential")
    place2 = await _create_place(client, headers, name="Shop B", category="commercial")

    await client.post(
        f"/portfolios/{portfolio['id']}/places",
        json={"place_id": place1["id"], "purchase_price": 1000000, "current_value": 1200000},
        headers=headers,
    )
    await client.post(
        f"/portfolios/{portfolio['id']}/places",
        json={"place_id": place2["id"], "purchase_price": 500000, "current_value": 400000},
        headers=headers,
    )

    resp = await client.get(f"/portfolios/{portfolio['id']}/analytics", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_value"] == "1600000.00"
    assert body["total_purchase"] == "1500000.00"
    assert body["gain_loss"] == "100000.00"
    assert body["place_count"] == 2

    # Category allocation
    cats = {c["category"]: c for c in body["category_allocation"]}
    assert "residential" in cats
    assert "commercial" in cats
    assert cats["residential"]["count"] == 1
    assert cats["residential"]["value"] == "1200000.00"

    # Top performers (sorted by gain_loss desc)
    assert len(body["top_performers"]) == 2
    assert body["top_performers"][0]["place_name"] == "Apt A"
    assert body["top_performers"][0]["gain_loss"] == "200000.00"


async def test_analytics_empty_portfolio(client: AsyncClient):
    data = await _register_and_login(client, "pf16@test.com")
    headers = _auth(data["access_token"])

    portfolio = await _create_portfolio(client, headers)

    resp = await client.get(f"/portfolios/{portfolio['id']}/analytics", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_value"] == "0.00"
    assert body["total_purchase"] == "0.00"
    assert body["gain_loss"] == "0.00"
    assert body["gain_loss_pct"] is None
    assert body["place_count"] == 0
    assert body["category_allocation"] == []
    assert body["top_performers"] == []


# ---------------------------------------------------------------------------
# Decimal precision tests
# ---------------------------------------------------------------------------


async def test_decimal_precision_no_float_artifacts(client: AsyncClient):
    """Verify 0.1 + 0.2 = 0.30 (not 0.30000000000000004)."""
    data = await _register_and_login(client, "pf_dec1@test.com")
    headers = _auth(data["access_token"])

    portfolio = await _create_portfolio(client, headers)
    place1 = await _create_place(client, headers, name="Dec A")
    place2 = await _create_place(client, headers, name="Dec B")

    # purchase_price values that would cause float issues: 100.10 + 100.20
    await client.post(
        f"/portfolios/{portfolio['id']}/places",
        json={"place_id": place1["id"], "purchase_price": 100.10, "current_value": 200.20},
        headers=headers,
    )
    await client.post(
        f"/portfolios/{portfolio['id']}/places",
        json={"place_id": place2["id"], "purchase_price": 100.20, "current_value": 200.10},
        headers=headers,
    )

    resp = await client.get(f"/portfolios/{portfolio['id']}/analytics", headers=headers)
    body = resp.json()
    # With Decimal, 100.10 + 100.20 = 200.30 exactly
    assert body["total_purchase"] == "200.30"
    assert body["total_value"] == "400.30"
    assert body["gain_loss"] == "200.00"


async def test_validation_rejects_negative_price(client: AsyncClient):
    """Pydantic validation rejects negative purchase_price."""
    data = await _register_and_login(client, "pf_dec2@test.com")
    headers = _auth(data["access_token"])

    portfolio = await _create_portfolio(client, headers)
    place = await _create_place(client, headers)

    resp = await client.post(
        f"/portfolios/{portfolio['id']}/places",
        json={"place_id": place["id"], "purchase_price": -1, "current_value": 100},
        headers=headers,
    )
    assert resp.status_code == 422


async def test_validation_rejects_over_max(client: AsyncClient):
    """Pydantic validation rejects value exceeding max bound."""
    data = await _register_and_login(client, "pf_dec3@test.com")
    headers = _auth(data["access_token"])

    portfolio = await _create_portfolio(client, headers)
    place = await _create_place(client, headers)

    resp = await client.post(
        f"/portfolios/{portfolio['id']}/places",
        json={"place_id": place["id"], "purchase_price": 99999999999, "current_value": 100},
        headers=headers,
    )
    assert resp.status_code == 422
