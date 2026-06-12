"""Tests for auth event audit logging."""

import logging
import uuid

from app.core.audit import log_auth_event


def test_log_auth_event_login_success(caplog):
    """LOGIN_SUCCESS event is logged with correct fields."""
    uid = uuid.uuid4()
    with caplog.at_level(logging.INFO, logger="audit"):
        log_auth_event(
            "LOGIN_SUCCESS",
            user_id=uid,
            email="test@example.com",
            ip="127.0.0.1",
        )
    assert len(caplog.records) == 1
    record = caplog.records[0]
    assert record.event == "LOGIN_SUCCESS"
    assert record.user_id == str(uid)
    assert record.email == "test@example.com"
    assert record.ip == "127.0.0.1"
    assert record.success is True


def test_log_auth_event_login_failure(caplog):
    """LOGIN_FAILURE event is logged with success=False."""
    with caplog.at_level(logging.INFO, logger="audit"):
        log_auth_event(
            "LOGIN_FAILURE",
            email="bad@example.com",
            ip="10.0.0.1",
            success=False,
        )
    assert len(caplog.records) == 1
    record = caplog.records[0]
    assert record.event == "LOGIN_FAILURE"
    assert record.success is False
    assert record.user_id is None


def test_log_auth_event_with_detail(caplog):
    """Detail field is passed through to log extra."""
    with caplog.at_level(logging.INFO, logger="audit"):
        log_auth_event(
            "TOKEN_REFRESH_FAILURE",
            ip="1.2.3.4",
            success=False,
            detail="Replay detected",
        )
    record = caplog.records[0]
    assert record.detail == "Replay detected"


def test_log_auth_event_timestamp_present(caplog):
    """Each audit event includes an ISO timestamp."""
    with caplog.at_level(logging.INFO, logger="audit"):
        log_auth_event("LOGOUT", user_id=uuid.uuid4(), ip="127.0.0.1")
    record = caplog.records[0]
    assert hasattr(record, "timestamp")
    assert "T" in record.timestamp  # ISO format


def test_log_auth_event_all_event_types(caplog):
    """All defined event types can be logged without error."""
    events = [
        "LOGIN_SUCCESS",
        "LOGIN_FAILURE",
        "LOGOUT",
        "TOKEN_REFRESH",
        "TOKEN_REFRESH_FAILURE",
        "PASSWORD_RESET_REQUEST",
        "PASSWORD_RESET_COMPLETE",
        "REGISTER",
        "EMAIL_VERIFIED",
    ]
    with caplog.at_level(logging.INFO, logger="audit"):
        for event in events:
            log_auth_event(event, user_id=uuid.uuid4())
    assert len(caplog.records) == len(events)


def test_audit_log_contains_correlation_id(caplog):
    """Audit log entries include correlation_id from context."""
    from app.middleware.correlation import correlation_id_var

    cid = "test-corr-id-abc"
    token = correlation_id_var.set(cid)
    try:
        with caplog.at_level(logging.INFO, logger="audit"):
            log_auth_event("LOGIN_SUCCESS", user_id=uuid.uuid4(), ip="127.0.0.1")
        record = caplog.records[0]
        assert record.correlation_id == cid
    finally:
        correlation_id_var.reset(token)
