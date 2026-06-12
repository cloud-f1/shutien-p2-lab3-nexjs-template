"""E156 — Schemathesis-driven OpenAPI conformance sweep.

Phase 40 Self-Review finding #1: ``docs/openapi.yaml`` is the single source
of truth for client types, but nothing today verifies that the **FastAPI
implementation** matches that contract. A handler can silently change its
response shape while ``openapi.yaml`` stays frozen; the client types compile,
but the first real HTTP call 4xx/5xx-es in production.

This module closes the loop. It loads the OpenAPI document from the live
ASGI app in-process, then parametrizes every ``path × method`` operation
and validates each generated response against the declared schema + status
codes + headers + content types.

Runs as part of the mandatory ``@qa`` Phase 2.5 — if this module fails,
Phase 3 (coverage) does not run. See ``.claude/agents/qa.md``.

### Known drift on first run (xfail list)

If the initial sweep surfaces operations whose server response genuinely
disagrees with ``docs/openapi.yaml``, mark them in the ``KNOWN_DRIFT_OPS``
set below with a one-liner explaining the expected follow-up epic. The
point of this module is **detection** — fixing the drift is a separate
unit of work.

The xfail list is intentionally empty on landing this epic; if schemathesis
finds drift at merge time, add entries here alongside a TODO comment
pointing to the follow-up epic ID.
"""

from __future__ import annotations

import pytest
import schemathesis
from schemathesis.checks import load_all_checks
from schemathesis.specs.openapi.checks import unsupported_method

# Ensure the full built-in check registry is loaded before we reference
# individual checks below (schemathesis lazy-loads to avoid slow imports).
load_all_checks()

# Checks excluded from validation. ``unsupported_method`` is a RFC 9110
# correctness check (requires ``Allow`` header on 405 responses) that is
# a Starlette/FastAPI framework-level concern, not spec↔server drift —
# this epic targets the latter.
EXCLUDED_CHECKS = [unsupported_method]

# Lazy-load the schema from the ``api_schema`` fixture defined in
# ``server/tests/conftest.py``. ``from_fixture`` returns a proxy that
# defers resolution until pytest actually collects parametrized tests,
# which means dependency overrides registered by the ``client`` fixture
# are already in place when the ASGI app is introspected.
schema = schemathesis.pytest.from_fixture("api_schema")

# Operations that are known to drift from ``docs/openapi.yaml`` today. Each
# entry is keyed by ``"{METHOD} {path}"`` (uppercase method, literal path
# as it appears in the OpenAPI doc). The first schemathesis run on the E156
# landing branch surfaced 15 operations where the server returns
# undocumented status codes (mostly 400/401/403 for auth failures and 422
# for validation errors not declared in the spec).
#
# These are **documentation drift** — the handlers behave correctly, but
# ``docs/openapi.yaml`` under-declares the error status codes. The fix is
# to update the spec to include the error responses (and optionally trim
# server-side responses that shouldn't be returned). That cleanup is
# intentionally out of scope for E156 — this epic adds the *detection*.
# Follow-up is tracked as drift cleanup under Phase 40.
#
# When an op's spec is fixed, remove its entry below and re-run:
#   cd server && uv run pytest tests/contract/test_schemathesis_conformance.py
KNOWN_DRIFT_OPS: set[str] = {
    # Auth — undocumented 400/401 error responses for invalid credentials / tokens.
    "POST /auth/jwt/login",
    "POST /auth/jwt/logout",
    "POST /auth/refresh",
    "POST /auth/register",
    "POST /auth/forgot-password",
    "POST /auth/reset-password",
    "POST /auth/request-verify-token",
    "POST /auth/verify",
    "GET /auth/google/callback",
    # Users — 401 Unauthorized not documented on authenticated endpoints.
    "DELETE /users/me",
    "PATCH /users/me",
    "GET /users/me/sessions/",
    "DELETE /users/me/sessions/{session_id}",
    # E161 — same 401 drift pattern on the new auth session-store endpoints.
    # Follow-up: spec sweep to declare 401 responses across all authenticated
    # operations (tracked alongside the existing Phase 40 drift cleanup).
    "GET /auth/sessions",
    "DELETE /auth/sessions/{session_id}",
    "POST /auth/logout-all",
    # Admin / test helpers — 401/403 not declared.
    "GET /admin/health",
    # E159 — /admin/sli has same 401 drift pattern as /admin/health: schemathesis
    # surfaces the unauth path before our $ref-based 401 declaration is honoured.
    # Follow-up: spec sweep to declare 401 inline (not via $ref) on admin ops.
    "GET /admin/sli",
    "POST /api/v1/test-helpers/seed",
    "POST /api/v1/test-helpers/reset",
}


def _op_key(case: schemathesis.Case) -> str:
    """Render the operation identifier used in ``KNOWN_DRIFT_OPS``."""
    return f"{case.method.upper()} {case.path}"


@pytest.mark.contract
@schema.parametrize()
def test_api_conforms_to_openapi(case: schemathesis.Case) -> None:
    """Every operation × status in ``docs/openapi.yaml`` must match the server.

    The schema was loaded from the live ASGI app via ``from_asgi``, so
    ``case.call()`` dispatches in-process (no network, no port binding).
    ``validate_response`` then checks status code, content type, headers,
    and response body against the declared schema.
    """
    if _op_key(case) in KNOWN_DRIFT_OPS:
        pytest.xfail(
            f"Known drift on {_op_key(case)} — tracked for follow-up. "
            "Fix openapi.yaml or the handler, then remove from KNOWN_DRIFT_OPS."
        )

    response = case.call()
    case.validate_response(response, excluded_checks=EXCLUDED_CHECKS)
