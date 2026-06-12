"""Posts CRUD integration tests."""

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


POST_DATA = {
    "title": "My First Post",
    "body": "This is the body of my first blog post.",
}


async def test_create_post(client: AsyncClient):
    data = await _register_and_login(client, "post1@test.com")
    resp = await client.post(
        "/posts/", json=POST_DATA, headers=_auth(data["access_token"])
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "My First Post"
    assert body["published"] is False
    assert body["published_at"] is None
    assert body["user_id"] is not None
    assert "id" in body


async def test_create_post_published(client: AsyncClient):
    """When created with published=true, published_at should be auto-set."""
    data = await _register_and_login(client, "post1b@test.com")
    resp = await client.post(
        "/posts/",
        json={**POST_DATA, "published": True},
        headers=_auth(data["access_token"]),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["published"] is True
    assert body["published_at"] is not None


async def test_create_post_missing_required(client: AsyncClient):
    data = await _register_and_login(client, "post2@test.com")
    resp = await client.post(
        "/posts/",
        json={},
        headers=_auth(data["access_token"]),
    )
    assert resp.status_code == 422


async def test_list_posts_only_own(client: AsyncClient):
    data1 = await _register_and_login(client, "post3a@test.com")
    data2 = await _register_and_login(client, "post3b@test.com")

    # User 1 creates an item
    await client.post("/posts/", json=POST_DATA, headers=_auth(data1["access_token"]))
    # User 2 creates an item
    await client.post(
        "/posts/",
        json=POST_DATA,
        headers=_auth(data2["access_token"]),
    )

    # User 1 should only see their item
    resp = await client.get("/posts/", headers=_auth(data1["access_token"]))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1


async def test_list_posts_filter_published(client: AsyncClient):
    """Blog-specific: filter by published status."""
    data = await _register_and_login(client, "post3c@test.com")
    headers = _auth(data["access_token"])

    # Create one draft and one published
    await client.post("/posts/", json=POST_DATA, headers=headers)
    await client.post(
        "/posts/",
        json={**POST_DATA, "title": "Published Post", "published": True},
        headers=headers,
    )

    # Filter published only
    resp = await client.get("/posts/?published=true", headers=headers)
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["published"] is True

    # Filter drafts only
    resp2 = await client.get("/posts/?published=false", headers=headers)
    body2 = resp2.json()
    assert body2["total"] == 1
    assert body2["items"][0]["published"] is False

    # No filter — all posts
    resp3 = await client.get("/posts/", headers=headers)
    body3 = resp3.json()
    assert body3["total"] == 2


async def test_list_posts_pagination(client: AsyncClient):
    data = await _register_and_login(client, "post4@test.com")
    headers = _auth(data["access_token"])

    # Create 3 items
    for i in range(3):
        item_data = {**POST_DATA}
        item_data["title"] = f"Post {i}"
        await client.post("/posts/", json=item_data, headers=headers)

    # Page 1, size 2
    resp = await client.get("/posts/?page=1&page_size=2", headers=headers)
    body = resp.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["page"] == 1

    # Page 2, size 2
    resp2 = await client.get("/posts/?page=2&page_size=2", headers=headers)
    body2 = resp2.json()
    assert len(body2["items"]) == 1


async def test_get_post_by_id(client: AsyncClient):
    data = await _register_and_login(client, "post5@test.com")
    headers = _auth(data["access_token"])

    create_resp = await client.post("/posts/", json=POST_DATA, headers=headers)
    item_id = create_resp.json()["id"]

    resp = await client.get(f"/posts/{item_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == item_id


async def test_get_other_users_post_returns_404(client: AsyncClient):
    data1 = await _register_and_login(client, "post6a@test.com")
    data2 = await _register_and_login(client, "post6b@test.com")

    create_resp = await client.post(
        "/posts/", json=POST_DATA, headers=_auth(data1["access_token"])
    )
    item_id = create_resp.json()["id"]

    resp = await client.get(f"/posts/{item_id}", headers=_auth(data2["access_token"]))
    assert resp.status_code == 404


async def test_update_post(client: AsyncClient):
    data = await _register_and_login(client, "post7@test.com")
    headers = _auth(data["access_token"])

    create_resp = await client.post("/posts/", json=POST_DATA, headers=headers)
    item_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/posts/{item_id}",
        json={"title": "Updated Title"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated Title"


async def test_update_post_publish_sets_published_at(client: AsyncClient):
    """Blog-specific: first publish auto-sets published_at."""
    data = await _register_and_login(client, "post7b@test.com")
    headers = _auth(data["access_token"])

    create_resp = await client.post("/posts/", json=POST_DATA, headers=headers)
    item_id = create_resp.json()["id"]
    assert create_resp.json()["published_at"] is None

    resp = await client.patch(
        f"/posts/{item_id}",
        json={"published": True},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["published"] is True
    assert resp.json()["published_at"] is not None


async def test_update_other_users_post_returns_404(client: AsyncClient):
    data1 = await _register_and_login(client, "post8a@test.com")
    data2 = await _register_and_login(client, "post8b@test.com")

    create_resp = await client.post(
        "/posts/", json=POST_DATA, headers=_auth(data1["access_token"])
    )
    item_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/posts/{item_id}",
        json={"title": "Hacked"},
        headers=_auth(data2["access_token"]),
    )
    assert resp.status_code == 404


async def test_delete_post(client: AsyncClient):
    data = await _register_and_login(client, "post9@test.com")
    headers = _auth(data["access_token"])

    create_resp = await client.post("/posts/", json=POST_DATA, headers=headers)
    item_id = create_resp.json()["id"]

    resp = await client.delete(f"/posts/{item_id}", headers=headers)
    assert resp.status_code == 204

    # Verify deleted
    resp2 = await client.get(f"/posts/{item_id}", headers=headers)
    assert resp2.status_code == 404


async def test_delete_other_users_post_returns_404(client: AsyncClient):
    data1 = await _register_and_login(client, "post10a@test.com")
    data2 = await _register_and_login(client, "post10b@test.com")

    create_resp = await client.post(
        "/posts/", json=POST_DATA, headers=_auth(data1["access_token"])
    )
    item_id = create_resp.json()["id"]

    resp = await client.delete(
        f"/posts/{item_id}", headers=_auth(data2["access_token"])
    )
    assert resp.status_code == 404
