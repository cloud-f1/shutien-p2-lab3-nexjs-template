from unittest.mock import AsyncMock, MagicMock, patch

from app.services.email.base import EmailResult
from app.services.user_manager import UserManager


async def test_on_after_register_triggers_verify():
    user_db = MagicMock()
    manager = UserManager(user_db)
    manager.request_verify = AsyncMock()

    mock_user = MagicMock()
    mock_user.id = "test-id"
    mock_user.is_verified = False

    await manager.on_after_register(mock_user)
    manager.request_verify.assert_called_once_with(mock_user, None)


async def test_on_after_register_skips_verify_when_already_verified():
    """OAuth users with is_verified_by_default=True skip verification email."""
    user_db = MagicMock()
    manager = UserManager(user_db)
    manager.request_verify = AsyncMock()

    mock_user = MagicMock()
    mock_user.id = "test-id"
    mock_user.is_verified = True

    await manager.on_after_register(mock_user)
    manager.request_verify.assert_not_called()


async def test_on_after_forgot_password_sends_email():
    user_db = MagicMock()
    mock_provider = AsyncMock()
    mock_provider.send.return_value = EmailResult(
        success=True, provider="mock", message_id="test-id"
    )

    with patch("app.services.user_manager.get_email_provider", return_value=mock_provider):
        manager = UserManager(user_db)

    mock_user = MagicMock()
    mock_user.email = "test@example.com"

    await manager.on_after_forgot_password(mock_user, "reset-token-123")
    mock_provider.send.assert_called_once()
    call_kwargs = mock_provider.send.call_args.kwargs
    assert call_kwargs["to"] == "test@example.com"
    assert call_kwargs["subject"] == "Reset your password"
    assert "reset-token-123" in call_kwargs["html"]


async def test_on_after_request_verify_sends_email():
    user_db = MagicMock()
    mock_provider = AsyncMock()
    mock_provider.send.return_value = EmailResult(
        success=True, provider="mock", message_id="test-id"
    )

    with patch("app.services.user_manager.get_email_provider", return_value=mock_provider):
        manager = UserManager(user_db)

    mock_user = MagicMock()
    mock_user.email = "verify@example.com"

    await manager.on_after_request_verify(mock_user, "verify-token-456")
    mock_provider.send.assert_called_once()
    call_kwargs = mock_provider.send.call_args.kwargs
    assert call_kwargs["to"] == "verify@example.com"
    assert call_kwargs["subject"] == "Verify your email"
    assert "verify-token-456" in call_kwargs["html"]


# ── Password validation tests ──────────────────────────────────────


async def test_validate_password_rejects_short():
    import pytest
    from fastapi_users.exceptions import InvalidPasswordException

    manager = UserManager(MagicMock())
    with pytest.raises(InvalidPasswordException):
        await manager.validate_password("Short1")


async def test_validate_password_rejects_letters_only():
    import pytest
    from fastapi_users.exceptions import InvalidPasswordException

    manager = UserManager(MagicMock())
    with pytest.raises(InvalidPasswordException):
        await manager.validate_password("abcdefghij")


async def test_validate_password_rejects_digits_only():
    import pytest
    from fastapi_users.exceptions import InvalidPasswordException

    manager = UserManager(MagicMock())
    with pytest.raises(InvalidPasswordException):
        await manager.validate_password("12345678")


async def test_validate_password_accepts_valid():
    manager = UserManager(MagicMock())
    await manager.validate_password("MyPass123")
