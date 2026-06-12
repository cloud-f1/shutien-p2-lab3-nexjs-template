# E99 — Contract Test Framework & OpenAPI Validation

> **Phase 28** | Priority: P1 | Points: 8 | Size: M
> **Depends on**: none

---

## Problem Statement

The project declares `openapi.yaml` as the single source of truth, and client types are generated from it. But there is no automated verification that server responses actually match the OpenAPI schemas at runtime. A response field renamed in code but not in the spec (or vice versa) passes all existing tests silently.

Additionally, the email provider pattern (console/mailgun/zeabur) defines an implicit contract but has no contract tests verifying interface compliance across providers.

Contract tests close the loop between spec and implementation — the third principle from test-master.md's boundary control layer.

## Stories

### S1: OpenAPI Response Contract Tests

**AC:**
- [ ] New directory `server/tests/contract/` with `conftest.py`
- [ ] Contract test fixture loads `docs/openapi.yaml` and parses response schemas
- [ ] For each endpoint with a defined response schema: test that actual response JSON validates against the OpenAPI schema
- [ ] Cover all existing endpoints: health, auth (register, login, logout, refresh, forgot-password, reset-password, verify), users/me
- [ ] Use `jsonschema` for validation (verify availability first: `pip show jsonschema`; add explicit dep to pyproject.toml if not transitively present)
- [ ] Tests fail if response has extra/missing fields vs spec

### S2: Email Provider Contract Tests

**AC:**
- [ ] Contract test verifies all email providers (console, mailgun, zeabur) implement the same interface
- [ ] Tests check: method signatures match, required parameters present, return types consistent
- [ ] Template pattern documented for adding contract tests when new providers are created

### S3: Contract Test Conftest & Fixtures

**AC:**
- [ ] `server/tests/contract/conftest.py` with reusable fixtures: `openapi_spec`, `schema_validator`
- [ ] Helper function `assert_matches_schema(response, endpoint, method, status_code)` for DRY contract assertions
- [ ] pytest marker `@pytest.mark.contract` for selective execution
- [ ] Add `contract` to pytest markers in `pyproject.toml`

## Risk Notes

- OpenAPI schema validation adds a dependency (`openapi-core` or `jsonschema`) — prefer `jsonschema` (already a transitive dep via other packages)
- Contract tests are slower than unit tests but faster than full integration — run them in CI but not on every keystroke
- Schema drift detection may surface existing spec/code mismatches that need fixing first

## Files to Touch

```
server/tests/contract/              — new: directory with conftest.py + test files
server/tests/contract/conftest.py   — new: OpenAPI schema fixtures
server/tests/contract/test_openapi_contract.py  — new: endpoint response validation
server/tests/contract/test_email_provider_contract.py — new: provider interface check
server/pyproject.toml               — update: add contract marker + jsonschema dep (if not transitive)
```
