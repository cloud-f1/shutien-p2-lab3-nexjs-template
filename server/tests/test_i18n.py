"""Tests for server-side i18n message key mapping."""

from app.core.i18n import (
    ERROR_MESSAGE_KEYS,
    get_message_key,
    enrich_error_response,
)


class TestGetMessageKey:
    """Tests for get_message_key utility."""

    def test_returns_key_for_known_auth_errors(self):
        assert get_message_key("LOGIN_BAD_CREDENTIALS") == "error.auth.invalid_credentials"
        assert get_message_key("REGISTER_USER_ALREADY_EXISTS") == "error.auth.user_already_exists"
        assert get_message_key("INVALID_REFRESH_TOKEN") == "error.auth.invalid_refresh_token"
        assert get_message_key("RESET_PASSWORD_BAD_TOKEN") == "error.auth.reset_bad_token"
        assert get_message_key("VERIFY_USER_BAD_TOKEN") == "error.auth.verify_bad_token"

    def test_returns_none_for_unknown_code(self):
        assert get_message_key("UNKNOWN_ERROR") is None
        assert get_message_key("") is None
        assert get_message_key("some random text") is None

    def test_all_mapped_keys_follow_naming_convention(self):
        """All message keys should follow error.{domain}.{code} format."""
        for detail, key in ERROR_MESSAGE_KEYS.items():
            parts = key.split(".")
            assert len(parts) == 3, (
                f"Key '{key}' for '{detail}' doesn't follow error.domain.code format"
            )
            assert parts[0] == "error", f"Key '{key}' doesn't start with 'error.'"


class TestEnrichErrorResponse:
    """Tests for enrich_error_response utility."""

    def test_includes_message_key_for_known_code(self):
        result = enrich_error_response("LOGIN_BAD_CREDENTIALS")
        assert result == {
            "detail": "LOGIN_BAD_CREDENTIALS",
            "message_key": "error.auth.invalid_credentials",
        }

    def test_message_key_is_none_for_unknown_code(self):
        result = enrich_error_response("UNKNOWN_ERROR")
        assert result == {
            "detail": "UNKNOWN_ERROR",
            "message_key": None,
        }

    def test_preserves_original_detail(self):
        result = enrich_error_response("LOGIN_BAD_CREDENTIALS")
        assert result["detail"] == "LOGIN_BAD_CREDENTIALS"
        assert result["message_key"] == "error.auth.invalid_credentials"
