# E57 — CSP Stripe Fix

> **Phase**: 19 — Post-v1.0.0 Production Hardening
> **Priority**: P0 | **Points**: 3
> **Depends on**: None (independent)
> **Source**: Cycle 6 audit — CSP blocks Stripe.js in strict environments

---

## Problem Statement

`server/app/middleware/security_headers.py` sets a `Content-Security-Policy` with `script-src 'self'` which blocks `https://js.stripe.com`. The `connect-src` is missing `https://api.stripe.com` and `https://q.stripe.com` (Stripe telemetry). `frame-src` is unset, blocking Stripe's hosted payment fields iframe. Any template user building with Stripe.js embedded elements gets silent failures.

## Stories

### E57-S01: Add Stripe CSP Directives (2 pts)

**Task**: Update CSP in `server/app/middleware/security_headers.py` to add Stripe-required directives.

**Changes**:
- `script-src`: add `https://js.stripe.com`
- `connect-src`: add `https://api.stripe.com https://q.stripe.com`
- `frame-src`: add `https://js.stripe.com https://hooks.stripe.com`

**Acceptance Criteria**:
- Given the CSP header is set on all responses
- When a page loads Stripe.js
- Then no CSP violation errors appear in the browser console
- And Stripe Checkout redirect flow works without blocked requests

### E57-S02: CSP Header Tests (1 pt)

**Task**: Add tests in `server/tests/` that verify the CSP header includes Stripe domains.

**Acceptance Criteria**:
- Given a response from any endpoint
- When I parse the `Content-Security-Policy` header
- Then `script-src` contains `https://js.stripe.com`
- And `connect-src` contains `https://api.stripe.com`
- And `frame-src` contains `https://js.stripe.com`

## Risk Notes

- **Zero risk**: Pure middleware config change, no logic modification
- **No breaking changes**: Adding CSP directives is additive

## Dependency Chain

```
E57-S01 (CSP directives) → E57-S02 (tests)
```
