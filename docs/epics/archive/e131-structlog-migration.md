# E131 — Structlog Migration [M, 8 SP]

## Goal
Replace the custom `JSONFormatter` in `server/app/core/logging_config.py` with `structlog`,
gaining structured logging with processor chains, contextvars-based correlation, and
dev/prod renderer toggling.

## Changes
1. Add `structlog>=24.1.0` runtime dependency to `server/pyproject.toml`
2. Rewrite `logging_config.py` — structlog processor chain with JSON/console renderer toggle
3. Update `request_logging.py` — use `structlog.get_logger()` with `.bind()`
4. Update `correlation.py` — bind/unbind correlation_id via `structlog.contextvars`
5. Update `test_logging.py` — verify JSON and console renderer output

## Constraints
- Preserve `LOG_FORMAT` setting toggle (json vs console)
- Keep quiet loggers (uvicorn.access, sqlalchemy.engine)
- Do not break Sentry integration
