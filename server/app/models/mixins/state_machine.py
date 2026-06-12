"""Reusable forward-only state machine mixin for SQLAlchemy models.

Usage:
    class Order(Base, StateMachineMixin):
        __tablename__ = "orders"

        TRANSITIONS = {
            "draft": ["pending"],
            "pending": ["approved", "rejected"],
            "approved": ["fulfilled"],
            "rejected": [],  # terminal state
            "fulfilled": [],  # terminal state
        }
        INITIAL_STATE = "draft"
"""

from datetime import datetime, timezone
from typing import ClassVar

from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column


class InvalidTransitionError(Exception):
    """Raised when a state transition is not allowed."""

    def __init__(self, current: str, target: str, allowed: list[str]):
        self.current = current
        self.target = target
        self.allowed = allowed
        super().__init__(f"Cannot transition from '{current}' to '{target}'. Allowed: {allowed}")


class StateMachineMixin:
    """Mixin adding state machine behavior to SQLAlchemy models."""

    TRANSITIONS: ClassVar[dict[str, list[str]]] = {}
    INITIAL_STATE: ClassVar[str] = ""

    state: Mapped[str] = mapped_column(String(50), nullable=False)
    state_history: Mapped[list] = mapped_column(JSON, default=list, nullable=False)

    def transition_to(self, new_state: str, *, actor: str = "system") -> None:
        """Validate and execute a state transition.

        Raises InvalidTransitionError if the transition is not allowed.
        """
        allowed = self.TRANSITIONS.get(self.state, [])
        if new_state not in allowed:
            raise InvalidTransitionError(self.state, new_state, allowed)

        old_state = self.state
        self.state = new_state

        # Append to history
        entry = {
            "from": old_state,
            "to": new_state,
            "actor": actor,
            "at": datetime.now(timezone.utc).isoformat(),
        }
        # Must create new list to trigger SQLAlchemy change detection on JSON
        self.state_history = [*self.state_history, entry]

    @property
    def is_terminal(self) -> bool:
        """True if current state has no outgoing transitions."""
        return len(self.TRANSITIONS.get(self.state, [])) == 0

    @property
    def available_transitions(self) -> list[str]:
        """List of states reachable from current state."""
        return list(self.TRANSITIONS.get(self.state, []))
