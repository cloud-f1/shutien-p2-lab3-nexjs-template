---
name: upgrade-stripe
description: Guide for upgrading Stripe API versions and SDKs. Use when upgrading Stripe, updating API version, or migrating between SDK versions.
alwaysApply: false
---

The latest Stripe API version is 2026-02-25.clover - use this version when upgrading unless the user specifies a different target version.

# Upgrading Stripe Versions

This guide covers upgrading Stripe API versions, server-side SDKs, Stripe.js, and mobile SDKs.

## Understanding Stripe API Versioning

Stripe uses date-based API versions (e.g., `2026-02-25.clover`, `2025-08-27.basil`, `2024-12-18.acacia`). Your account's API version determines request/response behavior.

### Types of Changes

**Backward-Compatible Changes** (do not require code updates):
- New API resources
- New optional request parameters
- New properties in existing responses
- Changes to opaque string lengths (e.g., object IDs)
- New webhook event types

**Breaking Changes** (require code updates):
- Field renames or removals
- Behavioral modifications
- Removed endpoints or parameters

Review the [API Changelog](https://docs.stripe.com/changelog.md) for all changes between versions.

## Server-Side SDK Versioning

See [SDK Version Management](https://docs.stripe.com/sdks/set-version.md) for details.

### Dynamically-Typed Languages (Ruby, Python, PHP, Node.js)

**Global Configuration:**
```python
import stripe
stripe.api_version = '2026-02-25.clover'
```

**Per-Request Override:**
```python
stripe.Customer.create(
  email="customer@example.com",
  stripe_version='2026-02-25.clover'
)
```

### Strongly-Typed Languages (Java, Go, .NET)

These use a fixed API version matching the SDK release date. Do not set a different API version for strongly-typed languages. Instead, update the SDK to target a new API version.

### Best Practice

Always specify the API version you're integrating against in your code:

```python
# Good: Explicit version
stripe.api_version = '2026-02-25.clover'

# Avoid: Relying on account default
```

## Upgrade Checklist

1. Review the [API Changelog](https://docs.stripe.com/changelog.md) for changes between your current and target versions
2. Check [Upgrades Guide](https://docs.stripe.com/upgrades.md) for migration guidance
3. Update server-side SDK package version
4. Update the `apiVersion` parameter in your Stripe client initialization
5. Test your integration against the new API version using the `Stripe-Version` header
6. Update webhook handlers to handle new event structures
7. Store Stripe object IDs in databases that accommodate up to 255 characters (case-sensitive collation)
