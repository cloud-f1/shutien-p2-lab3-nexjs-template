from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    version: str = "1.0.0"
    database: str = "unknown"


class ErrorDetail(BaseModel):
    """Legacy error detail — kept for backward compatibility."""

    code: str
    message: str
    field: str | None = None


class ErrorEnvelopeDetail(BaseModel):
    """Stripe-style error detail (E132)."""

    type: str
    code: str
    message: str
    param: str | None = None
    details: list[dict[str, str]] | None = None


class ErrorEnvelope(BaseModel):
    """Standardized error envelope: ``{error: {type, code, message}}``."""

    error: ErrorEnvelopeDetail


class ErrorResponse(BaseModel):
    error: ErrorDetail
