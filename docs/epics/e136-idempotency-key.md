# E136 — Idempotency Key Middleware [L, 8 SP]

## Goal

Provide a decorator-based idempotency mechanism for POST/PATCH endpoints.
When a client sends an `Idempotency-Key` header, the server caches the
response and replays it on duplicate requests, preventing double-processing.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Decorator vs global middleware | Decorator (`@idempotent`) | Most endpoints don't need it; opt-in is cleaner |
| Storage | In-memory dict (TTL 24h) | No Redis dependency yet; swap later via adapter |
| Concurrency | `asyncio.Lock` guards the store | Prevents race between concurrent duplicate calls |
| Missing key | Normal execution (no caching) | Non-breaking for existing clients |
| Concurrent duplicate | 409 Conflict | Matches Stripe's idempotency semantics |

## Files

| File | Action |
|------|--------|
| `server/app/middleware/idempotency.py` | New — decorator + in-memory store |
| `server/tests/unit/test_idempotency.py` | New — 6 test cases |
| `docs/openapi.yaml` | Add reusable `Idempotency-Key` parameter component |
| `server/app/main.py` | Add header to CORS allow_headers |

## Test Plan

1. First request with key → normal execution, response cached
2. Second request with same key → cached response replayed
3. Request without key → normal execution, no caching
4. Concurrent requests with same key → 409 conflict
5. Expired entries cleaned up after TTL
6. Different keys → independent responses
