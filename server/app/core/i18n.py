"""Server-side i18n message key mapping.

Maps existing error detail codes to i18n translation keys.
The client uses these keys to display localized error messages.
"""

# Maps existing detail codes to i18n message keys
ERROR_MESSAGE_KEYS: dict[str, str] = {
    # Auth
    "LOGIN_BAD_CREDENTIALS": "error.auth.invalid_credentials",
    "REGISTER_USER_ALREADY_EXISTS": "error.auth.user_already_exists",
    "INVALID_REFRESH_TOKEN": "error.auth.invalid_refresh_token",
    "RESET_PASSWORD_BAD_TOKEN": "error.auth.reset_bad_token",
    "VERIFY_USER_BAD_TOKEN": "error.auth.verify_bad_token",
}


def get_message_key(detail: str) -> str | None:
    """Look up i18n message key for an error detail code.

    Args:
        detail: The machine-readable error code from the API response.

    Returns:
        The i18n translation key if mapped, or None for unknown codes.
    """
    return ERROR_MESSAGE_KEYS.get(detail)


def enrich_error_response(detail: str) -> dict[str, str | None]:
    """Create an error response dict with optional message_key.

    Args:
        detail: The machine-readable error code.

    Returns:
        Dict with 'detail' and nullable 'message_key' fields.
    """
    return {
        "detail": detail,
        "message_key": get_message_key(detail),
    }
