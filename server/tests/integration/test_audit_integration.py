"""Integration tests for audit logging in auth endpoints."""

import logging

import pytest


@pytest.fixture()
async def registered_user(client):
    """Register a user and return the credentials."""
    await client.post(
        "/auth/register",
        json={
            "email": "audit@example.com",
            "password": "AuditPass1",
            "display_name": "Auditor",
        },
    )
    return {"email": "audit@example.com", "password": "AuditPass1"}


async def test_login_success_emits_audit_log(client, registered_user, caplog):
    """Successful login emits LOGIN_SUCCESS audit event."""
    with caplog.at_level(logging.INFO, logger="audit"):
        r = await client.post(
            "/auth/jwt/login",
            data={"username": registered_user["email"], "password": registered_user["password"]},
        )
    assert r.status_code == 200
    audit_records = [
        rec for rec in caplog.records if getattr(rec, "event", None) == "LOGIN_SUCCESS"
    ]
    assert len(audit_records) >= 1
    assert audit_records[0].email == registered_user["email"]


async def test_login_failure_emits_audit_log(client, caplog):
    """Failed login emits LOGIN_FAILURE audit event."""
    with caplog.at_level(logging.INFO, logger="audit"):
        r = await client.post(
            "/auth/jwt/login",
            data={"username": "nonexistent@example.com", "password": "WrongPass1"},
        )
    assert r.status_code == 400
    audit_records = [
        rec for rec in caplog.records if getattr(rec, "event", None) == "LOGIN_FAILURE"
    ]
    assert len(audit_records) >= 1
    assert audit_records[0].success is False


async def test_logout_emits_audit_log(client, registered_user, caplog):
    """Logout emits LOGOUT audit event."""
    login_r = await client.post(
        "/auth/jwt/login",
        data={"username": registered_user["email"], "password": registered_user["password"]},
    )
    tokens = login_r.json()
    with caplog.at_level(logging.INFO, logger="audit"):
        r = await client.post(
            "/auth/jwt/logout",
            json={"refresh_token": tokens["refresh_token"]},
            headers={"Authorization": f"Bearer {tokens['access_token']}"},
        )
    assert r.status_code == 204
    audit_records = [rec for rec in caplog.records if getattr(rec, "event", None) == "LOGOUT"]
    assert len(audit_records) >= 1


async def test_token_refresh_emits_audit_log(client, registered_user, caplog):
    """Successful token refresh emits TOKEN_REFRESH audit event."""
    login_r = await client.post(
        "/auth/jwt/login",
        data={"username": registered_user["email"], "password": registered_user["password"]},
    )
    tokens = login_r.json()
    with caplog.at_level(logging.INFO, logger="audit"):
        r = await client.post(
            "/auth/refresh",
            json={"refresh_token": tokens["refresh_token"]},
        )
    assert r.status_code == 200
    audit_records = [
        rec for rec in caplog.records if getattr(rec, "event", None) == "TOKEN_REFRESH"
    ]
    assert len(audit_records) >= 1


async def test_token_refresh_failure_emits_audit_log(client, caplog):
    """Failed token refresh emits TOKEN_REFRESH_FAILURE audit event."""
    with caplog.at_level(logging.INFO, logger="audit"):
        r = await client.post(
            "/auth/refresh",
            json={"refresh_token": "invalid.token.here"},
        )
    assert r.status_code == 401
    audit_records = [
        rec for rec in caplog.records if getattr(rec, "event", None) == "TOKEN_REFRESH_FAILURE"
    ]
    assert len(audit_records) >= 1


async def test_register_emits_audit_log(client, caplog):
    """Registration emits REGISTER audit event."""
    with caplog.at_level(logging.INFO, logger="audit"):
        r = await client.post(
            "/auth/register",
            json={
                "email": "newaudit@example.com",
                "password": "NewAudit1",
                "display_name": "New Auditor",
            },
        )
    assert r.status_code == 201
    audit_records = [rec for rec in caplog.records if getattr(rec, "event", None) == "REGISTER"]
    assert len(audit_records) >= 1
    assert audit_records[0].email == "newaudit@example.com"
