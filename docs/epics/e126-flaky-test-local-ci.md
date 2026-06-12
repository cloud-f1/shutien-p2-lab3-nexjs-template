# E126 — Flaky Test Detection & Local CI [S, 3 SP]

## Goal
Two Makefile targets for developer convenience: detect flaky tests and run full CI locally.

## Design

### `make flaky`
- Run server pytest 3x, client vitest 3x, capturing per-test pass/fail to `/tmp`
- Server: `uv run pytest --tb=no -q` → parse test names + outcomes
- Client: `pnpm test:run` → parse test names + outcomes
- Diff results across runs; report inconsistent tests by name
- Clean up temp files on exit

### `make ci-all`
- Sequential: `make lint` → `make test-server` → `make test-client`
- `&&` chaining — stop on first failure
- Print summary banner: "CI-ALL: PASSED" or "CI-ALL: FAILED at {step}"

## Acceptance Criteria
- [x] Both targets in `.PHONY`
- [x] `make help` shows both targets
- [x] `make -n ci-all` shows correct command sequence
- [x] `make flaky` cleans up temp files
