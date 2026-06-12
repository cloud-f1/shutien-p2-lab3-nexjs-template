# E137 — State Machine Mixin [M, 5 SP]

## Goal
Reusable SQLAlchemy mixin for forward-only state machines with transition validation and audit history.

## Deliverables
1. `server/app/models/mixins/state_machine.py` — `StateMachineMixin` with `transition_to()`, `is_terminal`, `available_transitions`
2. `server/app/models/mixins/__init__.py` — re-export
3. `server/tests/unit/test_state_machine.py` — 9+ unit tests using in-memory model

## Design
- Forward-only: transitions defined as `TRANSITIONS` dict (state → list of allowed targets)
- `InvalidTransitionError` raised on illegal moves
- `state_history` JSON column records each transition with actor + timestamp
- New list assignment on history append to trigger SQLAlchemy JSON change detection

## Acceptance Criteria
- All tests pass with `uv run pytest tests/unit/test_state_machine.py -v`
- No DB migration needed — mixin only, consumed by future models
