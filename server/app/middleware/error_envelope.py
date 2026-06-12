"""Standardized error envelope handlers (E132).

Registers FastAPI exception handlers that wrap ALL error responses
in a Stripe-style ``{error: {type, code, message}}`` envelope.
"""

from enum import Enum

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.requests import Request
from starlette.responses import JSONResponse


def _to_str(detail: object) -> str:
    """Convert detail to a plain string, unwrapping enums (e.g. fastapi-users ErrorCode)."""
    if isinstance(detail, Enum):
        return str(detail.value)
    return str(detail)


def _classify_error(status_code: int) -> str:
    """Map HTTP status code to a Stripe-style error type."""
    if status_code == 401:
        return "authentication_error"
    if status_code == 403:
        return "authorization_error"
    if status_code == 404:
        return "not_found_error"
    if status_code == 409:
        return "conflict_error"
    if status_code == 422:
        return "validation_error"
    if status_code == 429:
        return "rate_limit_error"
    if 400 <= status_code < 500:
        return "invalid_request_error"
    return "api_error"


def _extract_code(detail: object) -> str:
    """Best-effort extraction of a machine-readable code from *detail*."""
    raw = _to_str(detail) if not isinstance(detail, dict) else ""
    if isinstance(detail, (str, Enum)):
        return raw.upper().replace(" ", "_")[:64]
    if isinstance(detail, dict):
        return str(detail.get("code", "ERROR"))
    return "ERROR"


async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    """Wrap ``HTTPException`` (including fastapi-users errors) in the envelope."""
    if isinstance(exc.detail, (str, Enum)):
        message = _to_str(exc.detail)
    else:
        message = exc.detail
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "type": _classify_error(exc.status_code),
                "code": _extract_code(exc.detail),
                "message": message,
            }
        },
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Wrap ``RequestValidationError`` with per-field details."""
    errors = exc.errors()
    first = errors[0] if errors else {}
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "type": "validation_error",
                "code": first.get("type", "invalid_input"),
                "param": ".".join(str(loc) for loc in first.get("loc", [])),
                "message": first.get("msg", "Validation error"),
                "details": [
                    {
                        "param": ".".join(str(loc) for loc in e.get("loc", [])),
                        "message": e.get("msg", ""),
                    }
                    for e in errors
                ],
            }
        },
    )


def register_error_handlers(app: FastAPI) -> None:
    """Register all error envelope handlers on *app*."""
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
