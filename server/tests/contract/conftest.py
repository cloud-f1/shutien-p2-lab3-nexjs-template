"""Contract test fixtures — OpenAPI schema loading and validation helpers."""

import copy
from pathlib import Path

import pytest
import yaml
from jsonschema import validate
from jsonschema.exceptions import ValidationError

# Path to the single source of truth
OPENAPI_PATH = Path(__file__).resolve().parents[3] / "docs" / "openapi.yaml"


@pytest.fixture(scope="session")
def openapi_spec() -> dict:
    """Load and return the full OpenAPI spec as a dict."""
    with open(OPENAPI_PATH) as f:
        return yaml.safe_load(f)


def _resolve_ref(spec: dict, ref: str) -> dict:
    """Resolve a $ref string like '#/components/schemas/UserRead' to the actual schema."""
    parts = ref.lstrip("#/").split("/")
    node = spec
    for part in parts:
        node = node[part]
    return copy.deepcopy(node)


def _resolve_all_refs(spec: dict, schema: dict) -> dict:
    """Recursively resolve all $ref pointers in a schema."""
    if isinstance(schema, dict):
        if "$ref" in schema:
            resolved = _resolve_ref(spec, schema["$ref"])
            return _resolve_all_refs(spec, resolved)
        return {k: _resolve_all_refs(spec, v) for k, v in schema.items()}
    if isinstance(schema, list):
        return [_resolve_all_refs(spec, item) for item in schema]
    return schema


def get_response_schema(
    spec: dict,
    path: str,
    method: str = "get",
    status_code: str = "200",
) -> dict:
    """Extract and fully resolve a response schema from the OpenAPI spec.

    Args:
        spec: The full OpenAPI spec dict.
        path: API path (e.g. '/health').
        method: HTTP method (lowercase).
        status_code: Response status code as string.

    Returns:
        Fully resolved JSON Schema dict.

    Raises:
        KeyError: If path/method/status not found in spec.
    """
    response = spec["paths"][path][method]["responses"][status_code]

    # Resolve response-level $ref (e.g. '#/components/responses/Unauthorized')
    if "$ref" in response:
        response = _resolve_ref(spec, response["$ref"])

    schema = response["content"]["application/json"]["schema"]
    return _resolve_all_refs(spec, schema)


def assert_matches_schema(response_json: dict | list, schema: dict) -> None:
    """Validate response JSON against a resolved OpenAPI schema.

    Raises:
        jsonschema.exceptions.ValidationError: If validation fails.
    """
    # OpenAPI 3.1 uses JSON Schema 2020-12 draft, but jsonschema defaults
    # work well enough for structural validation. We intentionally skip
    # format validation (e.g. uuid, email) to focus on shape compliance.
    try:
        validate(instance=response_json, schema=schema)
    except ValidationError as exc:
        # Re-raise with a cleaner message showing the path
        path = " -> ".join(str(p) for p in exc.absolute_path) if exc.absolute_path else "(root)"
        raise AssertionError(
            f"Schema mismatch at {path}: {exc.message}\n"
            f"Instance: {exc.instance!r}\n"
            f"Schema: {exc.schema!r}"
        ) from exc
