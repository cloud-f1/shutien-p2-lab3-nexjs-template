"""Billing integration tests — plans, checkout, subscription, webhook."""

import json
import uuid
from unittest.mock import MagicMock, patch

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.domains.billing.models import SubscriptionPlan, WebhookEvent


async def _register_and_login(
    client: AsyncClient, email: str, password: str = "Secure#Pass1"
) -> dict:
    await client.post("/auth/register", json={"email": email, "password": password})
    resp = await client.post(
        "/auth/jwt/login",
        data={"username": email, "password": password},
    )
    return resp.json()


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


async def _create_team(client: AsyncClient, token: str, slug: str) -> dict:
    resp = await client.post(
        "/teams/",
        json={"name": f"Team {slug}", "slug": slug},
        headers=_auth(token),
    )
    return resp.json()


async def _create_plan(db: AsyncSession, slug: str = "pro", amount: int = 2999) -> SubscriptionPlan:
    plan = SubscriptionPlan(
        name=slug.capitalize(),
        slug=slug,
        stripe_price_id=f"price_{slug}" if amount > 0 else None,
        amount=amount,
        currency="usd",
        interval="month",
        features=json.dumps({"analytics": True}),
        limits=json.dumps({"max_members": 10}),
        is_active=True,
        display_order=1 if amount > 0 else 0,
    )
    db.add(plan)
    await db.flush()
    return plan


def _stripe_patch():
    """Return a context manager that patches settings in both router and service."""
    mock = MagicMock()
    mock.STRIPE_SECRET_KEY = "sk_test_fake"
    mock.STRIPE_PUBLISHABLE_KEY = "pk_test_fake"
    mock.STRIPE_WEBHOOK_SECRET = "whsec_fake"
    mock.RATE_LIMIT_GENERAL = "200/minute"

    class _Combined:
        def __enter__(self):
            self._p1 = patch("app.domains.billing.router.settings", mock)
            self._p2 = patch("app.domains.billing.service.settings", mock)
            self._p1.__enter__()
            self._p2.__enter__()
            return mock

        def __exit__(self, *args):
            self._p2.__exit__(*args)
            self._p1.__exit__(*args)

    return _Combined()


# ── Plans endpoint ──────────────────────────────────────────────


async def test_list_plans_empty(client: AsyncClient):
    """GET /billing/plans returns empty list when no plans exist."""
    resp = await client.get("/billing/plans")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_list_plans_with_data(client: AsyncClient, db: AsyncSession):
    """GET /billing/plans returns active plans."""
    await _create_plan(db, slug="billing-pro-1", amount=2999)
    await db.commit()

    resp = await client.get("/billing/plans")
    assert resp.status_code == 200
    plans = resp.json()
    slugs = [p["slug"] for p in plans]
    assert "billing-pro-1" in slugs


async def test_list_plans_no_auth_required(client: AsyncClient):
    """GET /billing/plans works without authentication."""
    resp = await client.get("/billing/plans")
    assert resp.status_code == 200


# ── Subscription endpoint ──────────────────────────────────────


async def test_get_subscription_returns_free_tier(client: AsyncClient, db: AsyncSession):
    """GET /billing/subscription/{team_id} returns free tier when no subscription."""
    data = await _register_and_login(client, "billing-sub1@test.com")
    team = await _create_team(client, data["access_token"], "billing-sub-team-1")
    team_id = team["id"]

    resp = await client.get(
        f"/billing/subscription/{team_id}",
        headers=_auth(data["access_token"]),
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "free"
    assert body["plan"]["slug"] == "free"
    assert body["id"] is None


async def test_get_subscription_requires_auth(client: AsyncClient):
    """GET /billing/subscription/{team_id} requires authentication."""
    fake_id = str(uuid.uuid4())
    resp = await client.get(f"/billing/subscription/{fake_id}")
    assert resp.status_code == 401


async def test_get_subscription_requires_membership(client: AsyncClient):
    """GET /billing/subscription/{team_id} requires team membership."""
    data1 = await _register_and_login(client, "billing-owner2@test.com")
    team = await _create_team(client, data1["access_token"], "billing-sub-team-2")

    data2 = await _register_and_login(client, "billing-other2@test.com")
    resp = await client.get(
        f"/billing/subscription/{team['id']}",
        headers=_auth(data2["access_token"]),
    )
    assert resp.status_code == 403


# ── Checkout endpoint ──────────────────────────────────────────


async def test_checkout_returns_503_without_stripe(client: AsyncClient, db: AsyncSession):
    """POST /billing/checkout returns 503 when Stripe is not configured."""
    data = await _register_and_login(client, "billing-checkout1@test.com")
    team = await _create_team(client, data["access_token"], "billing-checkout-1")
    plan = await _create_plan(db, slug="billing-checkout-plan-1")
    await db.commit()

    resp = await client.post(
        "/billing/checkout",
        json={"team_id": team["id"], "plan_id": str(plan.id)},
        headers=_auth(data["access_token"]),
    )
    assert resp.status_code == 503
    assert resp.json()["detail"] == "BILLING_NOT_CONFIGURED"


async def test_checkout_requires_auth(client: AsyncClient):
    """POST /billing/checkout requires authentication."""
    resp = await client.post(
        "/billing/checkout",
        json={"team_id": str(uuid.uuid4()), "plan_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 401


async def test_checkout_creates_session(client: AsyncClient, db: AsyncSession):
    """POST /billing/checkout creates a Stripe checkout session when configured."""
    data = await _register_and_login(client, "billing-checkout2@test.com")
    team = await _create_team(client, data["access_token"], "billing-checkout-2")
    plan = await _create_plan(db, slug="billing-checkout-plan-2")
    await db.commit()

    mock_customer = MagicMock()
    mock_customer.id = "cus_test_123"

    mock_session = MagicMock()
    mock_session.url = "https://checkout.stripe.com/test"
    mock_session.id = "cs_test_123"

    with _stripe_patch():
        with (
            patch("stripe.Customer.create", return_value=mock_customer),
            patch("stripe.checkout.Session.create", return_value=mock_session),
        ):
            resp = await client.post(
                "/billing/checkout",
                json={"team_id": team["id"], "plan_id": str(plan.id)},
                headers=_auth(data["access_token"]),
            )

    assert resp.status_code == 200
    body = resp.json()
    assert body["checkout_url"] == "https://checkout.stripe.com/test"
    assert body["session_id"] == "cs_test_123"


# ── Portal endpoint ────────────────────────────────────────────


async def test_portal_returns_503_without_stripe(client: AsyncClient):
    """POST /billing/portal returns 503 when Stripe is not configured."""
    data = await _register_and_login(client, "billing-portal1@test.com")
    team = await _create_team(client, data["access_token"], "billing-portal-1")

    resp = await client.post(
        "/billing/portal",
        json={"team_id": team["id"]},
        headers=_auth(data["access_token"]),
    )
    assert resp.status_code == 503


async def test_portal_requires_auth(client: AsyncClient):
    """POST /billing/portal requires authentication."""
    resp = await client.post(
        "/billing/portal",
        json={"team_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 401


# ── Webhook endpoint ───────────────────────────────────────────


async def test_webhook_returns_503_without_config(client: AsyncClient):
    """POST /billing/webhook returns 503 when webhook secret is not configured."""
    resp = await client.post(
        "/billing/webhook",
        content=b"{}",
        headers={"stripe-signature": "fake_sig"},
    )
    assert resp.status_code == 503


async def test_webhook_invalid_signature(client: AsyncClient):
    """POST /billing/webhook returns 400 for invalid signature."""
    with _stripe_patch():
        resp = await client.post(
            "/billing/webhook",
            content=b'{"type": "checkout.session.completed"}',
            headers={"stripe-signature": "bad_signature"},
        )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "INVALID_SIGNATURE"


async def test_webhook_checkout_completed(client: AsyncClient, db: AsyncSession):
    """POST /billing/webhook processes checkout.session.completed event."""
    data = await _register_and_login(client, "billing-wh1@test.com")
    team = await _create_team(client, data["access_token"], "billing-wh-team-1")
    plan = await _create_plan(db, slug="billing-wh-plan-1")
    await db.commit()

    event_id = f"evt_{uuid.uuid4().hex[:24]}"
    mock_event = MagicMock()
    mock_event.id = event_id
    mock_event.type = "checkout.session.completed"
    mock_event.data.object = {
        "metadata": {"team_id": team["id"], "plan_id": str(plan.id)},
        "subscription": "sub_test_123",
        "customer": "cus_test_123",
    }

    with _stripe_patch():
        with patch("stripe.Webhook.construct_event", return_value=mock_event):
            resp = await client.post(
                "/billing/webhook",
                content=b"raw_payload",
                headers={"stripe-signature": "valid_sig"},
            )

    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


async def test_webhook_idempotent(client: AsyncClient, db: AsyncSession):
    """POST /billing/webhook skips already-processed events."""
    event_id = f"evt_idempotent_{uuid.uuid4().hex[:12]}"

    db.add(
        WebhookEvent(
            stripe_event_id=event_id,
            event_type="checkout.session.completed",
        )
    )
    await db.commit()

    mock_event = MagicMock()
    mock_event.id = event_id
    mock_event.type = "checkout.session.completed"
    mock_event.data.object = {}

    with _stripe_patch():
        with patch("stripe.Webhook.construct_event", return_value=mock_event):
            resp = await client.post(
                "/billing/webhook",
                content=b"raw_payload",
                headers={"stripe-signature": "valid_sig"},
            )

    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
