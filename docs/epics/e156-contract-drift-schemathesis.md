# E156 — Contract Drift Detection via Schemathesis

> Phase 40 — Self-Review Improvements | Size: M (5 SP) | Deps: none
> Source: self-review 2026-04-24 — spec↔server drift is a silent failure today

## Problem

Today `openapi-typescript` generates client types from `docs/openapi.yaml`, so the **client** cannot drift from spec. But there is **no check that the FastAPI implementation matches the spec**:

- A route handler changes response shape, forgets to update `openapi.yaml` → client types compile fine (frozen spec), but runtime gets a 422/400 on the first real call.
- `@qa` Phase 2 runs unit + integration tests but neither crosses the HTTP boundary against the spec.
- Contract tests under `server/tests/contract/` (E99) validate a hand-picked subset but don't sweep every path × method × status.

Result: spec-first discipline is enforced at the entry (edit-openapi-first Stop rule) but not at the exit. Drift is discovered by users, not CI.

## Solution

Make **contract conformance a first-class `@qa` phase** — not an optional deploy gate. The @qa agent is already the quality authority; drift detection belongs there so every PR gets swept before human review.

1. Add mandatory `@qa` **Phase 2.5 — Contract Conformance**: boot ASGI app in-process, run `schemathesis.from_asgi()` against every operation
2. Schemathesis fuzzes: status codes, response schemas, header types, enum values, required fields, parameter types
3. Fail @qa **before** coverage gate — no merge without green contract
4. Stop-verifier Rule enforcement: if `docs/openapi.yaml` changed in the PR but contract tests weren't re-run, block Stop

The deploy gate is secondary defense; the primary enforcement is @qa.

## Key Files

| File | Action |
|------|--------|
| `server/pyproject.toml` | Edit — add `schemathesis>=3.36` to `[project.optional-dependencies] dev` |
| `server/tests/contract/test_schemathesis_conformance.py` | New — in-process ASGI harness |
| `server/conftest.py` | Edit — add `api_schema` fixture that loads from ASGI (no network) |
| `.claude/agents/qa.md` | **Major edit** — promote contract to mandatory Phase 2.5 (blocks coverage gate on fail) |
| `.claude/commands/athena/qa.md` | Edit — add `--contract-only` flag for quick drift check during development |
| `scripts/hooks/stop-verifier.sh` | Edit — new Rule #20: `openapi.yaml` changes require `tests/contract/` re-run evidence in audit log |
| `scripts/hooks/pre-deploy-guard.sh` | Edit — thin defense layer (re-run contract as Gate 7) |
| `docs/context/qa-patterns.md` | Append — "Schemathesis conformance pattern" entry |

## Implementation

### pyproject.toml

```toml
[project.optional-dependencies]
dev = [
  # ... existing ...
  "schemathesis>=3.36",
]
```

### test harness (state machine)

```python
# server/tests/contract/test_schemathesis_conformance.py
import pytest
import schemathesis
from schemathesis import Case

schema = schemathesis.from_pytest_fixture("api_schema")

@pytest.fixture
def api_schema(client):
    return schemathesis.from_asgi("/openapi.json", client.app)

@schema.parametrize()
def test_api_conforms_to_openapi(case: Case, client):
    response = case.call_asgi(client.app)
    case.validate_response(response)
```

### Deploy gate

Append to `scripts/hooks/pre-deploy-guard.sh`:

```bash
echo "Gate 7: OpenAPI contract conformance (schemathesis)…"
cd server && uv run pytest tests/contract/test_schemathesis_conformance.py -q || {
  echo "❌ Schemathesis found spec↔server drift. Fix openapi.yaml or server before deploy." >&2
  exit 1
}
```

### @qa agent rewrite (Phase 2.5 — mandatory, blocks coverage gate)

In `.claude/agents/qa.md`, restructure execution order:

```
Phase 1  — Static checks (ruff, mypy, eslint)
Phase 2  — Unit + integration tests
Phase 2.5 — Contract Conformance   ← NEW, blocks Phase 3 on failure
Phase 3  — Coverage gate (>=80%)
Phase 4  — Test Quality Score
```

Phase 2.5 body:
- Run `uv run pytest tests/contract/test_schemathesis_conformance.py -v --tb=short`
- On failure: write to `docs/context/qa-patterns.md` under "Contract Drift" section with the exact failing operation + schema diff
- Report in audit log: `{"contract_ops_checked": N, "contract_failures": M, "schema_diff_file": "..."}`
- FAIL @qa — do not proceed to coverage; humans must fix spec or server first
- No `--skip-contract` escape hatch — this is an enforcement rule, not a suggestion

### Stop-verifier Rule #20

```bash
rule_20_openapi_contract_evidence() {
  local branch; branch=$(git branch --show-current 2>/dev/null) || return 0
  [[ "$branch" =~ ^feat/e[0-9]+ ]] || return 0

  # Did this PR touch openapi.yaml?
  git diff --name-only origin/main...HEAD | grep -q '^docs/openapi.yaml$' || return 0

  # Require recent contract-test audit entry on this branch
  local last_contract_run
  last_contract_run=$(jq -r 'select(.event=="qa_contract" and .result=="pass") | .ts' \
    .claude/audit.jsonl 2>/dev/null | tail -1)

  if [[ -z "$last_contract_run" ]]; then
    echo "Rule 20: openapi.yaml changed but no green contract run in audit log." >&2
    echo "  Run: /athena:qa --contract-only" >&2
    return 1
  fi
}
```

## Alignment / Cross-Epic Hooks

- **Writes to**: `.claude/audit.jsonl` event `qa_contract` (read by E164 autopilot for spec confidence)
- **Enforces on**: E161's new unified `AuthResponse` — contract test must pass before E161 can merge
- **Downstream of**: (none — E156 is a root capability)
- **Bumps**: Stop-verifier rule count from 18 → adds Rule #20 (openapi.yaml requires contract evidence). After Phase 40, count = 20.
- **CLAUDE.md**: update rule count line to reflect new total
- **Phase 40 siblings**: runs before E157 in @qa execution order (Phase 2.5 → Phase 2.6)

## Acceptance Criteria

- [ ] `schemathesis>=3.36` in `server/pyproject.toml` dev extras
- [ ] `tests/contract/test_schemathesis_conformance.py` runs green on current main
- [ ] Introducing deliberate spec drift (e.g., change a response field name in an endpoint) causes the test to FAIL with a clear diff
- [ ] Pre-deploy guard blocks deploy when drift exists
- [ ] Audit log entry after `@qa` includes `{"contract_ops_checked": N}`
- [ ] `docs/context/qa-patterns.md` documents the pattern for future domains

## Out of Scope

- Running schemathesis in CI separate from deploy gate (can be added later)
- Contract tests for client → server (reverse direction) — covered by E116 Zod bridge
