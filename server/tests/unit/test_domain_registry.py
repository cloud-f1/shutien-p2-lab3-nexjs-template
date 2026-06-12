"""Domain registry discovery tests."""

from app.domains import DomainConfig, discover_domains


def test_discover_returns_empty_list_when_no_domains():
    """With no domain packages, discover returns empty list."""
    domains = discover_domains()
    assert isinstance(domains, list)
    assert len(domains) == 0


def test_domain_config_is_frozen():
    """DomainConfig instances are immutable."""
    from dataclasses import FrozenInstanceError

    from fastapi import APIRouter

    config = DomainConfig(router=APIRouter(), prefix="/test", tags=["test"], models=[])
    try:
        config.prefix = "/changed"  # type: ignore[misc]
        assert False, "Should have raised FrozenInstanceError"
    except FrozenInstanceError:
        pass
