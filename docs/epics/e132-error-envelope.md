# E132 — Standardized Error Envelope

> **Size**: M (5 SP) | **Phase**: 34 | **Deps**: none

## Goal

Standardize ALL error responses to a Stripe-style `{error: {type, code, message}}` envelope via FastAPI exception handlers.

## Deliverables

1. `server/app/middleware/error_envelope.py` — exception handlers for `HTTPException` + `RequestValidationError`
2. Updated `server/app/schemas/auth.py` — `ErrorDetail` gains `type`, `code`, `param` fields
3. Updated `docs/openapi.yaml` — `ErrorEnvelope` schema with nested error object
4. Handlers registered in `server/app/main.py`
5. `client/src/api/errors.ts` — `extractApiError()` parses new envelope, `extractApiDetail()` backward-compat
6. `server/tests/unit/test_error_envelope.py` — classification, shape, validation errors

## Error Type Classification

| Status | Type |
|--------|------|
| 401 | `authentication_error` |
| 403 | `authorization_error` |
| 404 | `not_found_error` |
| 409 | `conflict_error` |
| 422 | `validation_error` |
| 429 | `rate_limit_error` |
| 4xx | `invalid_request_error` |
| 5xx | `api_error` |
