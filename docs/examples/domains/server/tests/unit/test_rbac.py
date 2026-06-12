"""Unit tests for RBAC role hierarchy and utility functions."""

from app.domains.teams.models import Role, role_gte, ROLE_HIERARCHY


def test_role_hierarchy_values():
    """Ensure hierarchy order is correct."""
    assert ROLE_HIERARCHY[Role.viewer] < ROLE_HIERARCHY[Role.editor]
    assert ROLE_HIERARCHY[Role.editor] < ROLE_HIERARCHY[Role.admin]
    assert ROLE_HIERARCHY[Role.admin] < ROLE_HIERARCHY[Role.owner]


def test_role_gte_same_role():
    """A role should always be >= itself."""
    for role in Role:
        assert role_gte(role, role)


def test_role_gte_higher_role():
    """Higher roles should satisfy lower requirements."""
    assert role_gte(Role.owner, Role.viewer)
    assert role_gte(Role.owner, Role.editor)
    assert role_gte(Role.owner, Role.admin)
    assert role_gte(Role.admin, Role.viewer)
    assert role_gte(Role.admin, Role.editor)
    assert role_gte(Role.editor, Role.viewer)


def test_role_gte_lower_role():
    """Lower roles should not satisfy higher requirements."""
    assert not role_gte(Role.viewer, Role.editor)
    assert not role_gte(Role.viewer, Role.admin)
    assert not role_gte(Role.viewer, Role.owner)
    assert not role_gte(Role.editor, Role.admin)
    assert not role_gte(Role.editor, Role.owner)
    assert not role_gte(Role.admin, Role.owner)


def test_role_enum_values():
    """Ensure Role enum values match expected strings."""
    assert Role.viewer.value == "viewer"
    assert Role.editor.value == "editor"
    assert Role.admin.value == "admin"
    assert Role.owner.value == "owner"


def test_role_is_str_enum():
    """Role values can be compared as strings."""
    assert Role.viewer == "viewer"
    assert Role("admin") == Role.admin
