"""Tests for structlog-based logging configuration."""

import json
import logging
from io import StringIO
from unittest.mock import patch

import structlog

from app.core.logging_config import setup_logging


def _capture_log_output(logger_name: str = "test.logger", **bind_kwargs) -> str:
    """Set up logging, emit a log line, and return the captured output."""
    setup_logging()
    stream = StringIO()
    handler = logging.StreamHandler(stream)
    # Copy formatter from root handler
    root = logging.getLogger()
    handler.setFormatter(root.handlers[0].formatter)
    test_logger = logging.getLogger(logger_name)
    test_logger.handlers = [handler]
    test_logger.setLevel(logging.INFO)
    test_logger.propagate = False

    log = structlog.get_logger(logger_name)
    if bind_kwargs:
        log = log.bind(**bind_kwargs)
    log.info("hello world")

    return stream.getvalue()


class TestJSONRenderer:
    """Tests for JSON renderer mode (LOG_FORMAT=json)."""

    def test_json_output_has_required_fields(self):
        """JSON output contains timestamp, level, and event."""
        with patch("app.core.logging_config.settings") as mock_settings:
            mock_settings.LOG_FORMAT = "json"
            output = _capture_log_output()

        data = json.loads(output)
        assert data["level"] == "info"
        assert data["event"] == "hello world"
        assert "timestamp" in data

    def test_json_output_includes_bound_fields(self):
        """Bound fields (correlation_id, method, etc.) appear in JSON output."""
        with patch("app.core.logging_config.settings") as mock_settings:
            mock_settings.LOG_FORMAT = "json"
            output = _capture_log_output(
                correlation_id="abc-123",
                method="GET",
                path="/health",
                status_code=200,
                duration_ms=12.5,
            )

        data = json.loads(output)
        assert data["correlation_id"] == "abc-123"
        assert data["method"] == "GET"
        assert data["path"] == "/health"
        assert data["status_code"] == 200
        assert data["duration_ms"] == 12.5

    def test_json_output_omits_unbound_fields(self):
        """Fields not explicitly bound do not appear in output."""
        with patch("app.core.logging_config.settings") as mock_settings:
            mock_settings.LOG_FORMAT = "json"
            output = _capture_log_output()

        data = json.loads(output)
        assert "correlation_id" not in data
        assert "user_id" not in data

    def test_json_output_includes_exception(self):
        """Log records with exceptions include traceback info."""
        with patch("app.core.logging_config.settings") as mock_settings:
            mock_settings.LOG_FORMAT = "json"
            setup_logging()

        stream = StringIO()
        handler = logging.StreamHandler(stream)
        root = logging.getLogger()
        handler.setFormatter(root.handlers[0].formatter)
        err_logger = logging.getLogger("test.exc")
        err_logger.handlers = [handler]
        err_logger.setLevel(logging.ERROR)
        err_logger.propagate = False

        log = structlog.get_logger("test.exc")
        try:
            raise ValueError("boom")
        except ValueError:
            log.exception("error happened")

        output = stream.getvalue()
        data = json.loads(output)
        assert "ValueError" in data.get("exception", "")
        assert "boom" in data.get("exception", "")


class TestConsoleRenderer:
    """Tests for console renderer mode (LOG_FORMAT=console)."""

    def test_console_output_contains_event(self):
        """Console renderer outputs human-readable text with the event."""
        with patch("app.core.logging_config.settings") as mock_settings:
            mock_settings.LOG_FORMAT = "console"
            output = _capture_log_output()

        assert "hello world" in output

    def test_console_output_contains_level(self):
        """Console renderer includes the log level."""
        with patch("app.core.logging_config.settings") as mock_settings:
            mock_settings.LOG_FORMAT = "console"
            output = _capture_log_output()

        assert "info" in output.lower()


class TestCorrelationIdInLogs:
    """Verify correlation_id flows through structlog contextvars."""

    def test_contextvars_correlation_id_in_json(self):
        """correlation_id bound via contextvars appears in JSON output."""
        with patch("app.core.logging_config.settings") as mock_settings:
            mock_settings.LOG_FORMAT = "json"
            setup_logging()

        stream = StringIO()
        handler = logging.StreamHandler(stream)
        root = logging.getLogger()
        handler.setFormatter(root.handlers[0].formatter)
        ctx_logger = logging.getLogger("test.ctx")
        ctx_logger.handlers = [handler]
        ctx_logger.setLevel(logging.INFO)
        ctx_logger.propagate = False

        structlog.contextvars.bind_contextvars(correlation_id="ctx-789")
        try:
            log = structlog.get_logger("test.ctx")
            log.info("with_context")
        finally:
            structlog.contextvars.unbind_contextvars("correlation_id")

        output = stream.getvalue()
        data = json.loads(output)
        assert data["correlation_id"] == "ctx-789"


class TestSetupLogging:
    """Tests for the setup_logging() function itself."""

    def test_quiet_loggers(self):
        """uvicorn.access and sqlalchemy.engine are set to WARNING."""
        with patch("app.core.logging_config.settings") as mock_settings:
            mock_settings.LOG_FORMAT = "console"
            setup_logging()

        assert logging.getLogger("uvicorn.access").level == logging.WARNING
        assert logging.getLogger("sqlalchemy.engine").level == logging.WARNING

    def test_root_logger_has_handler(self):
        """Root logger has exactly one handler after setup."""
        with patch("app.core.logging_config.settings") as mock_settings:
            mock_settings.LOG_FORMAT = "console"
            setup_logging()

        root = logging.getLogger()
        assert len(root.handlers) == 1
