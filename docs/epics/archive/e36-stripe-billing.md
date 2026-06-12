# E36: Stripe Billing Integration

> **Phase**: 13 | **Size**: L (21 SP) | **Priority**: P1
> **Depends on**: E35 (RBAC — billing is per-team)
> **Source**: Strategy Cycle 2 — RESEARCH gap #2

---

## Problem Statement

Most SaaS templates ship with payment integration. Without Stripe, developers must build billing from scratch — a complex, error-prone task involving webhooks, subscription state machines, and PCI compliance. Competitors (Shipfast, Bedrock, SaaStr Kit) all include Stripe out of the box.

## Stories

### S1: Stripe Models & Config
**As a** SaaS developer,
**I want** subscription plan models and Stripe config,
**So that** I can define pricing tiers for my app.

**Acceptance Criteria:**
- [x] OpenAPI spec updated FIRST with billing schemas
- [ ] `SubscriptionPlan` model: id, name, slug, stripe_price_id, amount, currency, interval, features (JSON), limits (JSON), is_active, display_order
- [ ] `Subscription` model: team_id, plan_id, stripe_subscription_id, stripe_customer_id, status, current_period_start, current_period_end, cancel_at_period_end
- [ ] `WebhookEvent` model: stripe_event_id (unique), event_type, processed_at — for idempotency
- [ ] `server/app/core/config.py` — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`
- [ ] Alembic migration for billing tables
- [ ] Seed data: free plan (no stripe_price_id, amount=0)

### S2: Checkout & Customer Portal
**As a** team admin,
**I want** to subscribe to a plan via Stripe Checkout,
**So that** I can start paying for the service.

**Acceptance Criteria:**
- [ ] `POST /api/v1/billing/checkout` — creates Stripe Checkout Session, returns URL
- [ ] `POST /api/v1/billing/portal` — creates Stripe Customer Portal session
- [ ] `GET /api/v1/billing/subscription/{team_id}` — returns current team subscription status
- [ ] `GET /api/v1/billing/plans` — lists available plans (public, no auth)
- [ ] Checkout success redirects to dashboard with confirmation
- [ ] Only team owner/admin can manage billing (role_gte check)
- [ ] If team has no Stripe customer, create one on first checkout

### S3: Webhook Handler
**As the** system,
**I want** to process Stripe webhooks reliably,
**So that** subscription status stays in sync.

**Acceptance Criteria:**
- [ ] `POST /api/v1/billing/webhook` — Stripe signature verification
- [ ] Handles: `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`
- [ ] Idempotent processing via `WebhookEvent` table (replay-safe)
- [ ] Structured log entry for each webhook event (correlation ID)
- [ ] Subscription status updated in DB on each event

### S4: Billing UI
**As a** team admin,
**I want** a billing page in the dashboard,
**So that** I can view my plan, usage, and manage subscription.

**Acceptance Criteria:**
- [ ] Pricing page with plan comparison (public, no auth required)
- [ ] Billing settings page in dashboard (current plan, next billing date, upgrade/downgrade)
- [ ] "Manage Subscription" button → Stripe Customer Portal
- [ ] Plan feature gates: `useFeatureGate(feature)` hook
- [ ] Graceful degradation: if no Stripe keys configured, billing UI is hidden
- [ ] Accessibility: keyboard navigation, ARIA attrs on all interactive elements
- [ ] CSS uses design-system tokens (never raw hex)

### S5: Tests
**Acceptance Criteria:**
- [ ] Server: webhook signature verification, checkout session creation, subscription CRUD
- [ ] Client: billing page render, feature gate hook, pricing page
- [ ] Mock Stripe API in tests (no real charges)
- [ ] MSW handlers for all billing endpoints
- [ ] `userEvent` (not `fireEvent`) in all client tests
- [ ] `satisfies z.ZodType<ApiType>` on every new Zod schema
- [ ] Coverage >= 80% on new code

## Risk Notes

- Stripe test mode only in development — never real charges in dev/test
- Webhook endpoint must be excluded from CSRF protection and rate limiting
- PCI compliance: we never handle card data directly (Stripe Checkout handles it)
- Feature gating is optional — template ships with example but doesn't enforce

---

## Technical Design

### OpenAPI Additions (done)

**Tag**: `billing`

**Paths** (4 endpoints):
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/billing/plans` | None | List available plans (public) |
| POST | `/billing/checkout` | Bearer (admin/owner) | Create Stripe Checkout session |
| POST | `/billing/portal` | Bearer (admin/owner) | Create Stripe Customer Portal session |
| GET | `/billing/subscription/{team_id}` | Bearer (member) | Get current subscription |
| POST | `/billing/webhook` | None (Stripe signature) | Process Stripe webhook events |

**Schemas** (8 new):
- `SubscriptionStatus` — enum: active, past_due, canceled, incomplete, trialing, unpaid, paused, free
- `PlanRead` — plan details with features/limits JSON
- `SubscriptionRead` — current subscription state
- `CheckoutSessionCreate` — request: team_id + plan_id
- `CheckoutSessionRead` — response: checkout_url + session_id
- `PortalSessionCreate` — request: team_id
- `PortalSessionRead` — response: portal_url

### Database Models

```
server/app/domains/billing/models.py
```

**SubscriptionPlan** (table: `subscription_plans`)
```python
class SubscriptionPlan(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "subscription_plans"
    name: Mapped[str]              # "Free", "Pro", "Enterprise"
    slug: Mapped[str]              # "free", "pro", "enterprise" (unique)
    stripe_price_id: Mapped[str | None]  # null for free plan
    amount: Mapped[int]            # cents (0 for free)
    currency: Mapped[str]          # "usd"
    interval: Mapped[str]          # "month" | "year"
    features: Mapped[dict]         # JSON — {"analytics": true, ...}
    limits: Mapped[dict | None]    # JSON — {"max_members": 5, ...}
    is_active: Mapped[bool]        # available for new subscriptions
    display_order: Mapped[int]     # pricing page sort
```

**Subscription** (table: `subscriptions`)
```python
class Subscription(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "subscriptions"
    team_id: Mapped[uuid.UUID]     # FK → teams.id (unique — 1 subscription per team)
    plan_id: Mapped[uuid.UUID]     # FK → subscription_plans.id
    stripe_subscription_id: Mapped[str | None]  # sub_xxx
    stripe_customer_id: Mapped[str | None]      # cus_xxx
    status: Mapped[str]            # SubscriptionStatus enum value
    current_period_start: Mapped[datetime | None]
    current_period_end: Mapped[datetime | None]
    cancel_at_period_end: Mapped[bool]  # default False
```

**WebhookEvent** (table: `webhook_events`)
```python
class WebhookEvent(Base, UUIDMixin):
    __tablename__ = "webhook_events"
    stripe_event_id: Mapped[str]   # evt_xxx (unique index)
    event_type: Mapped[str]        # "checkout.session.completed"
    processed_at: Mapped[datetime] # server_default=func.now()
```

### Team Model Addition

Add `stripe_customer_id` to Team model:
```python
# In server/app/domains/teams/models.py
stripe_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
```
This links a team to its Stripe Customer for portal sessions.

### Webhook Handler Design

```
POST /api/v1/billing/webhook
```

1. **Read raw body** (not parsed JSON) for signature verification
2. **Verify signature** via `stripe.Webhook.construct_event(payload, sig_header, webhook_secret)`
3. **Idempotency check**: query `WebhookEvent` by `stripe_event_id` — skip if exists
4. **Route by event type**:
   - `checkout.session.completed` → create/update Subscription, set status=active
   - `invoice.paid` → update current_period_start/end
   - `invoice.payment_failed` → set status=past_due
   - `customer.subscription.updated` → sync status, period, cancel_at_period_end
   - `customer.subscription.deleted` → set status=canceled
5. **Insert WebhookEvent** record (idempotency marker)
6. **Return 200** `{"status": "ok"}`

### Feature Gate Pattern (Client)

```typescript
// src/hooks/useFeatureGate.ts
function useFeatureGate(feature: string): {
  allowed: boolean;
  limit: number | null;
  currentUsage: number | null;
}
```

- Reads subscription from React Query cache (team context)
- Checks `plan.features[feature]` for boolean gates
- Checks `plan.limits[feature]` for numeric limits
- Returns `{ allowed, limit, currentUsage }`

### Config Additions

```python
# server/app/core/config.py
STRIPE_SECRET_KEY: str = ""           # sk_test_xxx or sk_live_xxx
STRIPE_PUBLISHABLE_KEY: str = ""      # pk_test_xxx or pk_live_xxx
STRIPE_WEBHOOK_SECRET: str = ""       # whsec_xxx
```

When `STRIPE_SECRET_KEY` is empty, all billing endpoints return 503 (billing not configured). Client checks `VITE_STRIPE_PUBLISHABLE_KEY` — if empty, billing UI is hidden.

### Client Environment

```
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
```

### File Structure

```
server/app/domains/billing/
  __init__.py
  models.py          # SubscriptionPlan, Subscription, WebhookEvent
  schemas.py         # Pydantic schemas (from OpenAPI)
  service.py         # Business logic (checkout, portal, webhook processing)
  router.py          # FastAPI router (5 endpoints)

client/src/
  api/services/billing.ts    # createService + custom checkout/portal methods
  hooks/useFeatureGate.ts    # Feature gate hook
  pages/billing/
    PricingPage.tsx           # Public pricing comparison
    BillingSettingsPage.tsx   # Dashboard billing settings
  tests/handlers/billing.ts  # MSW handlers
```

### QA Checklist (from qa-patterns.md)

- [ ] `satisfies z.ZodType<ApiType>` on PlanRead, SubscriptionRead, CheckoutSessionRead, PortalSessionRead Zod schemas
- [ ] Explicit return types on exported billing functions
- [ ] DashboardLayout comment block preserved when adding billing view
- [ ] New CSS selectors use design-system tokens (never raw hex)
- [ ] All interactive elements: keyboard handler + ARIA attrs
- [ ] Images / icon-only buttons: `aria-label` or `aria-hidden`
- [ ] New pages: skip-nav target, landmark roles
- [ ] MSW handler for every billing endpoint (5 total)
- [ ] `userEvent` (not `fireEvent`) in all client tests
- [ ] Coverage >= 80% per module
