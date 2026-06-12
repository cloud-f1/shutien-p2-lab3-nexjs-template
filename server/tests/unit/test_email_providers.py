"""Tests for email provider package (E66)."""

import logging
from unittest.mock import AsyncMock, patch, MagicMock

import httpx
import pytest

from app.services.email.base import EmailProvider, EmailResult
from app.services.email.console import ConsoleProvider
from app.services.email.factory import get_email_provider, reset_email_provider
from app.services.email.mailgun import MailgunProvider
from app.services.email.zeabur import ZeaburProvider
from app.services.email.template_renderer import html_to_plain_text, render_template


# ── EmailResult ──────────────────────────────────────────────────


class TestEmailResult:
    def test_success_result(self):
        r = EmailResult(success=True, provider="test", message_id="abc")
        assert r.success is True
        assert r.provider == "test"
        assert r.message_id == "abc"
        assert r.error is None

    def test_failure_result(self):
        r = EmailResult(success=False, provider="test", error="boom")
        assert r.success is False
        assert r.error == "boom"
        assert r.message_id is None


# ── ConsoleProvider ──────────────────────────────────────────────


class TestConsoleProvider:
    async def test_send_logs_email(self, caplog):
        provider = ConsoleProvider()
        assert provider.name == "console"
        with caplog.at_level(logging.INFO):
            result = await provider.send(to="user@test.com", subject="Hello", html="<p>Hi</p>")
        assert result.success is True
        assert result.provider == "console"
        assert result.message_id.startswith("console-")
        assert len(result.message_id) == len("console-") + 8
        assert "user@test.com" in caplog.text
        assert "Hello" in caplog.text

    async def test_send_with_text_only(self, caplog):
        provider = ConsoleProvider()
        with caplog.at_level(logging.INFO):
            result = await provider.send(to="a@b.com", subject="Sub", text="plain text")
        assert result.success is True
        assert "plain text" in caplog.text

    async def test_send_empty_body(self, caplog):
        provider = ConsoleProvider()
        with caplog.at_level(logging.INFO):
            result = await provider.send(to="a@b.com", subject="Sub")
        assert result.success is True
        assert "(empty)" in caplog.text

    async def test_is_email_provider(self):
        assert isinstance(ConsoleProvider(), EmailProvider)


# ── MailgunProvider ──────────────────────────────────────────────


class TestMailgunProvider:
    def _make_provider(self):
        return MailgunProvider(
            api_key="key-test123",
            domain="test.mailgun.org",
            from_addr="noreply@test.com",
        )

    async def test_send_success(self):
        provider = self._make_provider()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"id": "<msg-123@mailgun>"}
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.email.mailgun.httpx.AsyncClient", return_value=mock_client):
            result = await provider.send(
                to="user@test.com",
                subject="Test",
                html="<p>Hello</p>",
                text="Hello",
            )

        assert result.success is True
        assert result.provider == "mailgun"
        assert result.message_id == "<msg-123@mailgun>"
        mock_client.post.assert_called_once()
        call_kwargs = mock_client.post.call_args
        assert call_kwargs.kwargs["auth"] == ("api", "key-test123")

    async def test_send_http_error(self):
        provider = self._make_provider()
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "401", request=MagicMock(), response=mock_response
        )

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.email.mailgun.httpx.AsyncClient", return_value=mock_client):
            result = await provider.send(to="a@b.com", subject="Fail", html="<p>x</p>")

        assert result.success is False
        assert "401" in result.error

    async def test_send_network_error(self):
        provider = self._make_provider()
        mock_client = AsyncMock()
        mock_client.post.side_effect = httpx.ConnectError("connection refused")
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.email.mailgun.httpx.AsyncClient", return_value=mock_client):
            result = await provider.send(to="a@b.com", subject="Fail", html="<p>x</p>")

        assert result.success is False
        assert "connection refused" in result.error

    async def test_is_email_provider(self):
        assert isinstance(self._make_provider(), EmailProvider)


# ── ZeaburProvider ───────────────────────────────────────────────


class TestZeaburProvider:
    def _make_provider(self):
        return ZeaburProvider(
            api_key="zbr-test-key",
            from_addr="noreply@test.com",
        )

    async def test_send_success(self):
        provider = self._make_provider()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"email_id": "zbr-email-789"}
        mock_response.raise_for_status = MagicMock()

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.email.zeabur.httpx.AsyncClient", return_value=mock_client):
            result = await provider.send(
                to="user@test.com",
                subject="Hello",
                html="<p>Hi</p>",
                text="Hi",
            )

        assert result.success is True
        assert result.provider == "zeabur"
        assert result.message_id == "zbr-email-789"
        call_kwargs = mock_client.post.call_args
        assert "Bearer zbr-test-key" in call_kwargs.kwargs["headers"]["Authorization"]
        payload = call_kwargs.kwargs["json"]
        assert payload["to"] == ["user@test.com"]

    async def test_send_http_error(self):
        provider = self._make_provider()
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"
        mock_response.raise_for_status.side_effect = httpx.HTTPStatusError(
            "500", request=MagicMock(), response=mock_response
        )

        mock_client = AsyncMock()
        mock_client.post.return_value = mock_response
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.email.zeabur.httpx.AsyncClient", return_value=mock_client):
            result = await provider.send(to="a@b.com", subject="Fail", html="<p>x</p>")

        assert result.success is False
        assert "500" in result.error

    async def test_send_network_error(self):
        provider = self._make_provider()
        mock_client = AsyncMock()
        mock_client.post.side_effect = httpx.ConnectError("timeout")
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)

        with patch("app.services.email.zeabur.httpx.AsyncClient", return_value=mock_client):
            result = await provider.send(to="a@b.com", subject="Fail", html="<p>x</p>")

        assert result.success is False
        assert "timeout" in result.error

    async def test_is_email_provider(self):
        assert isinstance(self._make_provider(), EmailProvider)


# ── Factory ──────────────────────────────────────────────────────


class TestFactory:
    def setup_method(self):
        reset_email_provider()

    def teardown_method(self):
        reset_email_provider()

    def test_default_is_console(self):
        with patch("app.services.email.factory.settings") as mock_settings:
            mock_settings.EMAIL_PROVIDER = "console"
            provider = get_email_provider(force_new=True)
        assert isinstance(provider, ConsoleProvider)

    def test_unknown_falls_back_to_console(self, caplog):
        with patch("app.services.email.factory.settings") as mock_settings:
            mock_settings.EMAIL_PROVIDER = "unknown_provider"
            with caplog.at_level(logging.WARNING):
                provider = get_email_provider(force_new=True)
        assert isinstance(provider, ConsoleProvider)
        assert "Unknown EMAIL_PROVIDER" in caplog.text

    def test_mailgun_requires_config(self):
        with patch("app.services.email.factory.settings") as mock_settings:
            mock_settings.EMAIL_PROVIDER = "mailgun"
            mock_settings.MAILGUN_API_KEY = ""
            mock_settings.MAILGUN_DOMAIN = ""
            with pytest.raises(ValueError, match="MAILGUN_API_KEY"):
                get_email_provider(force_new=True)

    def test_mailgun_creates_provider(self):
        with patch("app.services.email.factory.settings") as mock_settings:
            mock_settings.EMAIL_PROVIDER = "mailgun"
            mock_settings.MAILGUN_API_KEY = "key-123"
            mock_settings.MAILGUN_DOMAIN = "mg.test.com"
            mock_settings.EMAIL_FROM = "noreply@test.com"
            provider = get_email_provider(force_new=True)
        assert isinstance(provider, MailgunProvider)

    def test_zeabur_requires_config(self):
        with patch("app.services.email.factory.settings") as mock_settings:
            mock_settings.EMAIL_PROVIDER = "zeabur"
            mock_settings.ZEABUR_EMAIL_API_KEY = ""
            with pytest.raises(ValueError, match="ZEABUR_EMAIL_API_KEY"):
                get_email_provider(force_new=True)

    def test_zeabur_creates_provider(self):
        with patch("app.services.email.factory.settings") as mock_settings:
            mock_settings.EMAIL_PROVIDER = "zeabur"
            mock_settings.ZEABUR_EMAIL_API_KEY = "zbr-key"
            mock_settings.EMAIL_FROM = "noreply@test.com"
            provider = get_email_provider(force_new=True)
        assert isinstance(provider, ZeaburProvider)

    def test_singleton_caching(self):
        with patch("app.services.email.factory.settings") as mock_settings:
            mock_settings.EMAIL_PROVIDER = "console"
            p1 = get_email_provider(force_new=True)
            p2 = get_email_provider()
        assert p1 is p2

    def test_reset_clears_cache(self):
        with patch("app.services.email.factory.settings") as mock_settings:
            mock_settings.EMAIL_PROVIDER = "console"
            p1 = get_email_provider(force_new=True)
            reset_email_provider()
            p2 = get_email_provider(force_new=True)
        assert p1 is not p2


# ── Template Renderer ────────────────────────────────────────────


class TestTemplateRenderer:
    def test_render_verification_template(self):
        html = render_template("verification.html", link="https://example.com/verify?token=abc")
        assert "https://example.com/verify?token=abc" in html
        assert "Verify Email" in html
        assert "Verify your email" in html

    def test_render_password_reset_template(self):
        html = render_template("password_reset.html", link="https://example.com/reset?token=xyz")
        assert "https://example.com/reset?token=xyz" in html
        assert "Reset Password" in html
        assert "Reset your password" in html

    def test_html_to_plain_text_strips_tags(self):
        html = "<p>Hello <strong>World</strong></p>"
        text = html_to_plain_text(html)
        assert "Hello World" in text
        assert "<" not in text

    def test_html_to_plain_text_preserves_newlines(self):
        html = "<p>Para 1</p><p>Para 2</p>"
        text = html_to_plain_text(html)
        assert "Para 1" in text
        assert "Para 2" in text

    def test_html_to_plain_text_strips_style(self):
        html = "<style>body{color:red}</style><p>Visible</p>"
        text = html_to_plain_text(html)
        assert "Visible" in text
        assert "color" not in text

    def test_html_to_plain_text_decodes_entities(self):
        html = "<p>A &amp; B &lt; C &gt; D</p>"
        text = html_to_plain_text(html)
        assert "A & B < C > D" in text

    def test_autoescape_prevents_xss(self):
        html = render_template("verification.html", link="<script>alert('xss')</script>")
        assert "<script>" not in html
        assert "&lt;script&gt;" in html


# ── UserManager Integration ──────────────────────────────────────


class TestUserManagerIntegration:
    async def test_send_email_uses_provider(self):
        """UserManager._send_email delegates to the email provider."""
        from app.services.user_manager import UserManager

        mock_db = MagicMock()
        mock_provider = AsyncMock()
        mock_provider.send.return_value = EmailResult(
            success=True, provider="mock", message_id="test-id"
        )

        with patch("app.services.user_manager.get_email_provider", return_value=mock_provider):
            manager = UserManager(mock_db)

        await manager._send_email(
            to="user@test.com",
            token="tok123",
            subject="Verify your email",
            template="verification.html",
        )

        mock_provider.send.assert_called_once()
        call_kwargs = mock_provider.send.call_args.kwargs
        assert call_kwargs["to"] == "user@test.com"
        assert call_kwargs["subject"] == "Verify your email"
        assert "tok123" in call_kwargs["html"]
        assert call_kwargs["text"]  # plain text generated

    async def test_send_email_captures_token_in_dev(self):
        """In non-production, _last_token is set for E2E extraction."""
        import app.services.email.console as console_mod
        from app.services.user_manager import UserManager

        mock_db = MagicMock()
        mock_provider = AsyncMock()
        mock_provider.send.return_value = EmailResult(
            success=True, provider="mock", message_id="test-id"
        )

        with patch("app.services.user_manager.get_email_provider", return_value=mock_provider):
            manager = UserManager(mock_db)

        # Reset before test
        console_mod._last_token = None
        console_mod._last_token_email = None

        await manager._send_email(
            to="dev@test.com",
            token="dev-tok-456",
            subject="Verify your email",
            template="verification.html",
        )

        assert console_mod._last_token == "dev-tok-456"
        assert console_mod._last_token_email == "dev@test.com"

    async def test_verification_link_format(self):
        """Verification email link uses verify-email path."""
        from app.services.user_manager import UserManager

        mock_db = MagicMock()
        mock_provider = AsyncMock()
        mock_provider.send.return_value = EmailResult(
            success=True, provider="mock", message_id="test-id"
        )

        with patch("app.services.user_manager.get_email_provider", return_value=mock_provider):
            manager = UserManager(mock_db)

        await manager._send_email(
            to="user@test.com",
            token="verify-tok",
            subject="Verify your email",
            template="verification.html",
        )

        html = mock_provider.send.call_args.kwargs["html"]
        assert "verify-email?token=verify-tok" in html

    async def test_password_reset_link_format(self):
        """Password reset email link uses reset-password path."""
        from app.services.user_manager import UserManager

        mock_db = MagicMock()
        mock_provider = AsyncMock()
        mock_provider.send.return_value = EmailResult(
            success=True, provider="mock", message_id="test-id"
        )

        with patch("app.services.user_manager.get_email_provider", return_value=mock_provider):
            manager = UserManager(mock_db)

        await manager._send_email(
            to="user@test.com",
            token="reset-tok",
            subject="Reset your password",
            template="password_reset.html",
        )

        html = mock_provider.send.call_args.kwargs["html"]
        assert "reset-password?token=reset-tok" in html
