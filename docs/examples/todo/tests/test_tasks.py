"""Tasks CRUD integration tests + batch update."""

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


TASK_DATA = {
    "title": "Buy groceries",
}


async def test_create_task(client: AsyncClient):
    data = await _register_and_login(client, "task1@test.com")
    resp = await client.post(
        "/tasks/", json=TASK_DATA, headers=_auth(data["access_token"])
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "Buy groceries"
    assert body["completed"] is False
    assert body["priority"] == 0
    assert body["is_overdue"] is False
    assert body["user_id"] is not None
    assert "id" in body


async def test_create_task_with_priority(client: AsyncClient):
    data = await _register_and_login(client, "task1b@test.com")
    resp = await client.post(
        "/tasks/",
        json={**TASK_DATA, "priority": 2, "description": "Urgent shopping"},
        headers=_auth(data["access_token"]),
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["priority"] == 2
    assert body["description"] == "Urgent shopping"


async def test_create_task_missing_required(client: AsyncClient):
    data = await _register_and_login(client, "task2@test.com")
    resp = await client.post(
        "/tasks/",
        json={},
        headers=_auth(data["access_token"]),
    )
    assert resp.status_code == 422


async def test_create_task_invalid_priority(client: AsyncClient):
    """Priority must be 0-2."""
    data = await _register_and_login(client, "task2b@test.com")
    resp = await client.post(
        "/tasks/",
        json={**TASK_DATA, "priority": 5},
        headers=_auth(data["access_token"]),
    )
    assert resp.status_code == 422


async def test_list_tasks_only_own(client: AsyncClient):
    data1 = await _register_and_login(client, "task3a@test.com")
    data2 = await _register_and_login(client, "task3b@test.com")

    await client.post("/tasks/", json=TASK_DATA, headers=_auth(data1["access_token"]))
    await client.post("/tasks/", json=TASK_DATA, headers=_auth(data2["access_token"]))

    resp = await client.get("/tasks/", headers=_auth(data1["access_token"]))
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 1


async def test_list_tasks_filter_completed(client: AsyncClient):
    """Todo-specific: filter by completion status."""
    data = await _register_and_login(client, "task3c@test.com")
    headers = _auth(data["access_token"])

    # Create one pending and one completed
    await client.post("/tasks/", json=TASK_DATA, headers=headers)
    await client.post(
        "/tasks/",
        json={**TASK_DATA, "title": "Done task", "completed": True},
        headers=headers,
    )

    # Filter completed only
    resp = await client.get("/tasks/?completed=true", headers=headers)
    body = resp.json()
    assert body["total"] == 1
    assert body["items"][0]["completed"] is True

    # Filter pending only
    resp2 = await client.get("/tasks/?completed=false", headers=headers)
    body2 = resp2.json()
    assert body2["total"] == 1
    assert body2["items"][0]["completed"] is False


async def test_list_tasks_priority_sorting(client: AsyncClient):
    """Todo-specific: tasks sorted by priority DESC, due_date ASC."""
    data = await _register_and_login(client, "task3d@test.com")
    headers = _auth(data["access_token"])

    # Create tasks with different priorities
    await client.post(
        "/tasks/", json={**TASK_DATA, "title": "Low", "priority": 0}, headers=headers
    )
    await client.post(
        "/tasks/", json={**TASK_DATA, "title": "High", "priority": 2}, headers=headers
    )
    await client.post(
        "/tasks/", json={**TASK_DATA, "title": "Med", "priority": 1}, headers=headers
    )

    resp = await client.get("/tasks/", headers=headers)
    body = resp.json()
    assert body["total"] == 3
    # High priority first
    assert body["items"][0]["title"] == "High"
    assert body["items"][1]["title"] == "Med"
    assert body["items"][2]["title"] == "Low"


async def test_list_tasks_pagination(client: AsyncClient):
    data = await _register_and_login(client, "task4@test.com")
    headers = _auth(data["access_token"])

    for i in range(3):
        item_data = {**TASK_DATA}
        item_data["title"] = f"Task {i}"
        await client.post("/tasks/", json=item_data, headers=headers)

    resp = await client.get("/tasks/?page=1&page_size=2", headers=headers)
    body = resp.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    assert body["page"] == 1

    resp2 = await client.get("/tasks/?page=2&page_size=2", headers=headers)
    body2 = resp2.json()
    assert len(body2["items"]) == 1


async def test_get_task_by_id(client: AsyncClient):
    data = await _register_and_login(client, "task5@test.com")
    headers = _auth(data["access_token"])

    create_resp = await client.post("/tasks/", json=TASK_DATA, headers=headers)
    item_id = create_resp.json()["id"]

    resp = await client.get(f"/tasks/{item_id}", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == item_id
    assert "is_overdue" in resp.json()


async def test_get_other_users_task_returns_404(client: AsyncClient):
    data1 = await _register_and_login(client, "task6a@test.com")
    data2 = await _register_and_login(client, "task6b@test.com")

    create_resp = await client.post(
        "/tasks/", json=TASK_DATA, headers=_auth(data1["access_token"])
    )
    item_id = create_resp.json()["id"]

    resp = await client.get(f"/tasks/{item_id}", headers=_auth(data2["access_token"]))
    assert resp.status_code == 404


async def test_update_task(client: AsyncClient):
    data = await _register_and_login(client, "task7@test.com")
    headers = _auth(data["access_token"])

    create_resp = await client.post("/tasks/", json=TASK_DATA, headers=headers)
    item_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/tasks/{item_id}",
        json={"title": "Updated Task"},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated Task"


async def test_update_other_users_task_returns_404(client: AsyncClient):
    data1 = await _register_and_login(client, "task8a@test.com")
    data2 = await _register_and_login(client, "task8b@test.com")

    create_resp = await client.post(
        "/tasks/", json=TASK_DATA, headers=_auth(data1["access_token"])
    )
    item_id = create_resp.json()["id"]

    resp = await client.patch(
        f"/tasks/{item_id}",
        json={"title": "Hacked"},
        headers=_auth(data2["access_token"]),
    )
    assert resp.status_code == 404


async def test_delete_task(client: AsyncClient):
    data = await _register_and_login(client, "task9@test.com")
    headers = _auth(data["access_token"])

    create_resp = await client.post("/tasks/", json=TASK_DATA, headers=headers)
    item_id = create_resp.json()["id"]

    resp = await client.delete(f"/tasks/{item_id}", headers=headers)
    assert resp.status_code == 204

    resp2 = await client.get(f"/tasks/{item_id}", headers=headers)
    assert resp2.status_code == 404


async def test_delete_other_users_task_returns_404(client: AsyncClient):
    data1 = await _register_and_login(client, "task10a@test.com")
    data2 = await _register_and_login(client, "task10b@test.com")

    create_resp = await client.post(
        "/tasks/", json=TASK_DATA, headers=_auth(data1["access_token"])
    )
    item_id = create_resp.json()["id"]

    resp = await client.delete(
        f"/tasks/{item_id}", headers=_auth(data2["access_token"])
    )
    assert resp.status_code == 404


# ── Todo-specific: batch update tests ──


async def test_batch_update_tasks(client: AsyncClient):
    """Batch update completion status."""
    data = await _register_and_login(client, "task11@test.com")
    headers = _auth(data["access_token"])

    # Create 3 tasks
    ids = []
    for i in range(3):
        resp = await client.post(
            "/tasks/", json={**TASK_DATA, "title": f"Batch {i}"}, headers=headers
        )
        ids.append(resp.json()["id"])

    # Batch complete first 2
    resp = await client.patch(
        "/tasks/batch",
        json={"task_ids": ids[:2], "completed": True},
        headers=headers,
    )
    assert resp.status_code == 200
    assert resp.json()["updated"] == 2

    # Verify: task 0 and 1 completed, task 2 still pending
    resp1 = await client.get(f"/tasks/{ids[0]}", headers=headers)
    assert resp1.json()["completed"] is True
    resp2 = await client.get(f"/tasks/{ids[2]}", headers=headers)
    assert resp2.json()["completed"] is False


async def test_batch_update_other_users_tasks(client: AsyncClient):
    """Batch update ignores other users' tasks."""
    data1 = await _register_and_login(client, "task12a@test.com")
    data2 = await _register_and_login(client, "task12b@test.com")

    # User 1 creates a task
    resp = await client.post(
        "/tasks/", json=TASK_DATA, headers=_auth(data1["access_token"])
    )
    task_id = resp.json()["id"]

    # User 2 tries to batch-complete user 1's task
    resp = await client.patch(
        "/tasks/batch",
        json={"task_ids": [task_id], "completed": True},
        headers=_auth(data2["access_token"]),
    )
    assert resp.status_code == 200
    assert resp.json()["updated"] == 0  # No tasks updated
