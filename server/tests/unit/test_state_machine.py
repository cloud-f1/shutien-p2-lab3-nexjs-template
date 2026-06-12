"""Tests for StateMachineMixin — forward-only state machine with history audit."""

import uuid
from datetime import datetime, timezone

import pytest
from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, GUID
from app.models.mixins.state_machine import (
    InvalidTransitionError,
    StateMachineMixin,
)


# ---------- Concrete test model (no migration needed) ----------


class Order(Base, StateMachineMixin):
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=uuid.uuid4)
    label: Mapped[str] = mapped_column(String(100), default="")

    TRANSITIONS = {
        "draft": ["pending"],
        "pending": ["approved", "rejected"],
        "approved": ["fulfilled"],
        "rejected": [],  # terminal
        "fulfilled": [],  # terminal
    }
    INITIAL_STATE = "draft"


def _make_order(**overrides) -> Order:
    """Factory helper — creates an Order with sensible defaults."""
    defaults = {
        "id": uuid.uuid4(),
        "state": Order.INITIAL_STATE,
        "state_history": [],
    }
    defaults.update(overrides)
    return Order(**defaults)


# ---------- Tests ----------


class TestInitialState:
    def test_initial_state_set_correctly(self):
        order = _make_order()
        assert order.state == "draft"

    def test_initial_state_history_is_empty(self):
        order = _make_order()
        assert order.state_history == []


class TestValidTransitions:
    def test_valid_transition_updates_state(self):
        order = _make_order()
        order.transition_to("pending")
        assert order.state == "pending"

    def test_multi_step_transitions(self):
        order = _make_order()
        order.transition_to("pending")
        order.transition_to("approved")
        order.transition_to("fulfilled")
        assert order.state == "fulfilled"

    def test_transition_to_with_custom_actor(self):
        order = _make_order()
        order.transition_to("pending", actor="user@example.com")
        assert order.state_history[-1]["actor"] == "user@example.com"


class TestInvalidTransitions:
    def test_invalid_transition_raises_error(self):
        order = _make_order()
        with pytest.raises(InvalidTransitionError) as exc_info:
            order.transition_to("approved")

        err = exc_info.value
        assert err.current == "draft"
        assert err.target == "approved"
        assert err.allowed == ["pending"]

    def test_invalid_transition_error_message(self):
        order = _make_order()
        with pytest.raises(
            InvalidTransitionError, match="Cannot transition from 'draft' to 'approved'"
        ):
            order.transition_to("approved")

    def test_transition_from_terminal_state_raises(self):
        order = _make_order(state="fulfilled", state_history=[])
        with pytest.raises(InvalidTransitionError) as exc_info:
            order.transition_to("draft")

        assert exc_info.value.allowed == []


class TestStateHistory:
    def test_history_records_transition(self):
        order = _make_order()
        before = datetime.now(timezone.utc)
        order.transition_to("pending")

        assert len(order.state_history) == 1
        entry = order.state_history[0]
        assert entry["from"] == "draft"
        assert entry["to"] == "pending"
        assert entry["actor"] == "system"
        # Timestamp should be parseable and recent
        ts = datetime.fromisoformat(entry["at"])
        assert ts >= before

    def test_history_accumulates_across_transitions(self):
        order = _make_order()
        order.transition_to("pending")
        order.transition_to("approved")
        order.transition_to("fulfilled")

        assert len(order.state_history) == 3
        assert [e["to"] for e in order.state_history] == ["pending", "approved", "fulfilled"]

    def test_history_creates_new_list_each_time(self):
        """Verify new list is created (important for SQLAlchemy JSON change detection)."""
        order = _make_order()
        original = order.state_history
        order.transition_to("pending")
        assert order.state_history is not original


class TestTerminalAndAvailable:
    def test_is_terminal_true_for_terminal_states(self):
        order = _make_order(state="fulfilled", state_history=[])
        assert order.is_terminal is True

        order2 = _make_order(state="rejected", state_history=[])
        assert order2.is_terminal is True

    def test_is_terminal_false_for_non_terminal_states(self):
        order = _make_order(state="draft", state_history=[])
        assert order.is_terminal is False

        order2 = _make_order(state="pending", state_history=[])
        assert order2.is_terminal is False

    def test_available_transitions_returns_correct_list(self):
        order = _make_order(state="pending", state_history=[])
        assert order.available_transitions == ["approved", "rejected"]

    def test_available_transitions_empty_for_terminal(self):
        order = _make_order(state="fulfilled", state_history=[])
        assert order.available_transitions == []


class TestTransitionsValidation:
    def test_all_target_states_exist_as_keys(self):
        """Every state referenced as a transition target must exist as a key in TRANSITIONS."""
        all_keys = set(Order.TRANSITIONS.keys())
        all_targets = set()
        for targets in Order.TRANSITIONS.values():
            all_targets.update(targets)

        missing = all_targets - all_keys
        assert missing == set(), f"Target states missing as keys: {missing}"

    def test_initial_state_exists_in_transitions(self):
        assert Order.INITIAL_STATE in Order.TRANSITIONS
