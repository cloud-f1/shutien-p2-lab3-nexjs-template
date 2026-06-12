"""Contract tests — verify all email providers implement the EmailProvider interface.

Checks method signatures, return type annotations, and property compliance
across all concrete provider classes.
"""

import inspect

import pytest

from app.services.email.base import EmailProvider, EmailResult
from app.services.email.console import ConsoleProvider
from app.services.email.mailgun import MailgunProvider
from app.services.email.zeabur import ZeaburProvider

# All concrete providers that must comply with the EmailProvider contract
PROVIDERS = [ConsoleProvider, MailgunProvider, ZeaburProvider]


def _get_send_signature(cls: type) -> inspect.Signature:
    """Extract the 'send' method signature from a provider class."""
    method = getattr(cls, "send", None)
    assert method is not None, f"{cls.__name__} missing 'send' method"
    return inspect.signature(method)


@pytest.mark.contract
class TestEmailProviderInterface:
    """All email providers must be subclasses of EmailProvider."""

    @pytest.mark.parametrize("provider_cls", PROVIDERS, ids=lambda c: c.__name__)
    def test_inherits_from_base(self, provider_cls):
        assert issubclass(provider_cls, EmailProvider), (
            f"{provider_cls.__name__} must inherit from EmailProvider"
        )

    @pytest.mark.parametrize("provider_cls", PROVIDERS, ids=lambda c: c.__name__)
    def test_has_name_property(self, provider_cls):
        """Each provider must define a 'name' property."""
        assert isinstance(inspect.getattr_static(provider_cls, "name"), property), (
            f"{provider_cls.__name__} must define 'name' as a property"
        )

    @pytest.mark.parametrize("provider_cls", PROVIDERS, ids=lambda c: c.__name__)
    def test_has_send_method(self, provider_cls):
        """Each provider must define an async 'send' method."""
        send = getattr(provider_cls, "send", None)
        assert send is not None, f"{provider_cls.__name__} missing 'send' method"
        assert inspect.iscoroutinefunction(send), f"{provider_cls.__name__}.send must be async"


@pytest.mark.contract
class TestEmailProviderSendSignature:
    """All providers must accept the same keyword arguments as the base class."""

    def test_base_send_parameters(self):
        """Verify the base class defines the expected parameters."""
        sig = _get_send_signature(EmailProvider)
        params = list(sig.parameters.keys())
        # Should have: self, to, subject, html, text
        assert "to" in params
        assert "subject" in params
        assert "html" in params
        assert "text" in params

    @pytest.mark.parametrize("provider_cls", PROVIDERS, ids=lambda c: c.__name__)
    def test_send_parameters_match_base(self, provider_cls):
        """Each provider's send() must accept the same keyword args as the base."""
        base_sig = _get_send_signature(EmailProvider)
        provider_sig = _get_send_signature(provider_cls)

        base_params = {name: param for name, param in base_sig.parameters.items() if name != "self"}
        provider_params = {
            name: param for name, param in provider_sig.parameters.items() if name != "self"
        }

        # Provider must accept all base parameters
        for name in base_params:
            assert name in provider_params, (
                f"{provider_cls.__name__}.send() missing parameter '{name}'"
            )

        # Check keyword-only enforcement matches
        for name, base_param in base_params.items():
            prov_param = provider_params[name]
            assert prov_param.kind == base_param.kind, (
                f"{provider_cls.__name__}.send() parameter '{name}' "
                f"kind mismatch: expected {base_param.kind.name}, "
                f"got {prov_param.kind.name}"
            )

    @pytest.mark.parametrize("provider_cls", PROVIDERS, ids=lambda c: c.__name__)
    def test_send_return_annotation(self, provider_cls):
        """Each provider's send() must declare EmailResult as return type."""
        sig = _get_send_signature(provider_cls)
        assert sig.return_annotation is EmailResult, (
            f"{provider_cls.__name__}.send() return annotation must be EmailResult, "
            f"got {sig.return_annotation!r}"
        )
