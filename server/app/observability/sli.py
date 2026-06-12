"""In-memory SLI aggregator for ``GET /admin/sli`` (E159 Part 3).

Design constraints (from spec Out-of-Scope: no external metric store):

- **No external dependencies** — pure stdlib + a small dict per process.
- **Bounded memory** — keep at most ``MAX_SAMPLES`` (default 5000) per process,
  evict oldest samples first. With a 5-min default window the cap is rarely
  hit even at hundreds of req/s; if it is, we trade fidelity for a hard
  memory ceiling. This is fine: SLI is operator triage, not billing.
- **Lock-free for readers** — writers append to a deque; readers iterate a
  defensive ``list(...)`` copy. Two ``record()`` calls racing on the same
  thread can lose at most one sample (acceptable for percentiles).
- **Path normalisation** — collapses obvious id-bearing segments
  (``/users/abc`` -> ``/users/{id}``) so endpoint cardinality stays small.
  Heuristic, not perfect; we keep the original path in the bucket key only
  if no segment looks like an id.

Public API:

- :func:`record` — called by :class:`RequestIDMiddleware` per request.
- :func:`snapshot` — called by ``GET /admin/sli``. Returns a JSON-friendly
  dict with ``success_rate_5m``, ``p50_ms``, ``p95_ms``, top-N endpoints,
  ``window_seconds``, ``sample_count``.
- :func:`reset` — test-only; clears the buffer.

Path-skip list mirrors :mod:`app.middleware.request_logging` so health probes
do not skew the success rate.
"""

from __future__ import annotations

import re
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from typing import Any

# ── Constants ───────────────────────────────────────────────────────────────

MAX_SAMPLES = 5000
DEFAULT_WINDOW_SECONDS = 300  # rolling 5 min
TOP_N_ENDPOINTS = 10
SKIP_PATHS = {"/health", "/healthz", "/readyz", "/openapi.json", "/docs", "/redoc"}

# Crude UUID/int-id detector for path normalisation.
_UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
_INT_RE = re.compile(r"^\d+$")


@dataclass(slots=True)
class _Sample:
    ts: float
    path: str
    status: int
    duration_ms: float


# Module-level state — guarded by ``_lock`` for the writer side. Readers take
# a defensive snapshot so they do not need the lock.
_buffer: deque[_Sample] = deque(maxlen=MAX_SAMPLES)
_lock = threading.Lock()


def _normalise_path(path: str) -> str:
    """Collapse id-bearing segments to ``{id}`` to bound endpoint cardinality."""

    parts = path.split("/")
    out: list[str] = []
    changed = False
    for p in parts:
        if _UUID_RE.match(p) or (_INT_RE.match(p) and len(p) >= 1 and len(p) <= 18):
            out.append("{id}")
            changed = True
        else:
            out.append(p)
    return "/".join(out) if changed else path


def record(*, path: str, status: int, duration_ms: float) -> None:
    """Append a request sample to the rolling window. Cheap; called per-request."""

    if path in SKIP_PATHS:
        return
    sample = _Sample(
        ts=time.time(),
        path=_normalise_path(path),
        status=status,
        duration_ms=duration_ms,
    )
    with _lock:
        _buffer.append(sample)


def _percentile(sorted_values: list[float], pct: float) -> float:
    """Nearest-rank percentile (good enough for an SLI dashboard)."""

    if not sorted_values:
        return 0.0
    k = max(0, min(len(sorted_values) - 1, int(round((pct / 100.0) * (len(sorted_values) - 1)))))
    return round(sorted_values[k], 2)


def snapshot(window_seconds: int = DEFAULT_WINDOW_SECONDS) -> dict[str, Any]:
    """Return aggregated SLI for the trailing ``window_seconds``."""

    cutoff = time.time() - window_seconds
    samples = [s for s in list(_buffer) if s.ts >= cutoff]

    total = len(samples)
    if total == 0:
        return {
            "window_seconds": window_seconds,
            "sample_count": 0,
            "success_rate_5m": 1.0,
            "p50_ms": 0.0,
            "p95_ms": 0.0,
            "top_endpoints": [],
        }

    successes = sum(1 for s in samples if 200 <= s.status < 500)
    durations = sorted(s.duration_ms for s in samples)

    # Per-endpoint aggregation.
    by_path: dict[str, list[_Sample]] = defaultdict(list)
    for s in samples:
        by_path[s.path].append(s)

    top: list[dict[str, Any]] = []
    for path, group in by_path.items():
        group_sorted = sorted(g.duration_ms for g in group)
        group_total = len(group)
        group_success = sum(1 for g in group if 200 <= g.status < 500)
        top.append(
            {
                "path": path,
                "count": group_total,
                "success_rate": round(group_success / group_total, 4),
                "p50_ms": _percentile(group_sorted, 50),
                "p95_ms": _percentile(group_sorted, 95),
            }
        )
    top.sort(key=lambda x: x["count"], reverse=True)

    return {
        "window_seconds": window_seconds,
        "sample_count": total,
        "success_rate_5m": round(successes / total, 4),
        "p50_ms": _percentile(durations, 50),
        "p95_ms": _percentile(durations, 95),
        "top_endpoints": top[:TOP_N_ENDPOINTS],
    }


def reset() -> None:
    """Clear the buffer. Tests only."""

    with _lock:
        _buffer.clear()
