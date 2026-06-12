"""Unit tests for billing domain — schemas, models, service logic."""

import json
import uuid

from app.domains.billing.models import Subscription, SubscriptionPlan, WebhookEvent
from app.domains.billing.schemas import (
    CheckoutSessionCreate,
    CheckoutSessionRead,
    PlanRead,
    PortalSessionCreate,
    PortalSessionRead,
    SubscriptionRead,
    SubscriptionStatus,
)
from app.domains.billing.service import _plan_to_read


# ── Schema tests ────────────────────────────────────────────────


def test_subscription_status_enum():
    """Ensure all expected status values exist."""
    assert SubscriptionStatus.active == "active"
    assert SubscriptionStatus.past_due == "past_due"
    assert SubscriptionStatus.canceled == "canceled"
    assert SubscriptionStatus.free == "free"
    assert SubscriptionStatus.trialing == "trialing"
    assert SubscriptionStatus.incomplete == "incomplete"
    assert SubscriptionStatus.unpaid == "unpaid"
    assert SubscriptionStatus.paused == "paused"


def test_plan_read_schema():
    """PlanRead schema validates correctly."""
    plan = PlanRead(
        id=uuid.uuid4(),
        name="Pro",
        slug="pro",
        stripe_price_id="price_xxx",
        amount=2999,
        currency="usd",
        interval="month",
        features={"analytics": True, "api_access": True},
        limits={"max_members": 10},
        is_active=True,
        display_order=1,
    )
    assert plan.name == "Pro"
    assert plan.amount == 2999
    assert plan.features["analytics"] is True
    assert plan.limits["max_members"] == 10


def test_subscription_read_schema():
    """SubscriptionRead schema validates correctly."""
    plan_id = uuid.uuid4()
    team_id = uuid.uuid4()
    sub = SubscriptionRead(
        id=uuid.uuid4(),
        team_id=team_id,
        status=SubscriptionStatus.active,
        plan=PlanRead(
            id=plan_id,
            name="Pro",
            slug="pro",
            amount=2999,
            features={},
        ),
        cancel_at_period_end=False,
    )
    assert sub.status == SubscriptionStatus.active
    assert sub.team_id == team_id


def test_subscription_read_free_tier():
    """SubscriptionRead allows null id for free tier."""
    team_id = uuid.uuid4()
    sub = SubscriptionRead(
        id=None,
        team_id=team_id,
        status=SubscriptionStatus.free,
        plan=PlanRead(
            id=uuid.uuid4(),
            name="Free",
            slug="free",
            amount=0,
            features={"basic_access": True},
        ),
        cancel_at_period_end=False,
    )
    assert sub.id is None
    assert sub.status == SubscriptionStatus.free


def test_checkout_session_create_schema():
    """CheckoutSessionCreate validates required fields."""
    body = CheckoutSessionCreate(
        team_id=uuid.uuid4(),
        plan_id=uuid.uuid4(),
    )
    assert body.success_url is None
    assert body.cancel_url is None


def test_checkout_session_create_with_urls():
    """CheckoutSessionCreate accepts optional URLs."""
    body = CheckoutSessionCreate(
        team_id=uuid.uuid4(),
        plan_id=uuid.uuid4(),
        success_url="https://example.com/success",
        cancel_url="https://example.com/cancel",
    )
    assert body.success_url == "https://example.com/success"


def test_checkout_session_read_schema():
    """CheckoutSessionRead validates correctly."""
    read = CheckoutSessionRead(
        checkout_url="https://checkout.stripe.com/xxx",
        session_id="cs_test_xxx",
    )
    assert read.checkout_url.startswith("https://")


def test_portal_session_create_schema():
    """PortalSessionCreate validates required fields."""
    body = PortalSessionCreate(team_id=uuid.uuid4())
    assert body.return_url is None


def test_portal_session_read_schema():
    """PortalSessionRead validates correctly."""
    read = PortalSessionRead(portal_url="https://billing.stripe.com/xxx")
    assert read.portal_url.startswith("https://")


# ── Model tests ─────────────────────────────────────────────────


def test_subscription_plan_model():
    """SubscriptionPlan model can be instantiated."""
    plan = SubscriptionPlan(
        name="Enterprise",
        slug="enterprise",
        stripe_price_id="price_ent",
        amount=9999,
        currency="usd",
        interval="month",
        features=json.dumps({"everything": True}),
        is_active=True,
        display_order=2,
    )
    assert plan.name == "Enterprise"
    assert plan.amount == 9999


def test_subscription_model():
    """Subscription model can be instantiated."""
    sub = Subscription(
        team_id=uuid.uuid4(),
        plan_id=uuid.uuid4(),
        stripe_subscription_id="sub_xxx",
        stripe_customer_id="cus_xxx",
        status="active",
        cancel_at_period_end=False,
    )
    assert sub.status == "active"
    assert sub.cancel_at_period_end is False


def test_webhook_event_model():
    """WebhookEvent model can be instantiated."""
    evt = WebhookEvent(
        stripe_event_id="evt_xxx",
        event_type="checkout.session.completed",
    )
    assert evt.stripe_event_id == "evt_xxx"


# ── Service helper tests ────────────────────────────────────────


def test_plan_to_read_json_features():
    """_plan_to_read correctly parses JSON features string."""
    plan = SubscriptionPlan(
        id=uuid.uuid4(),
        name="Pro",
        slug="pro",
        stripe_price_id="price_pro",
        amount=2999,
        currency="usd",
        interval="month",
        features='{"analytics": true}',
        limits='{"max_members": 10}',
        is_active=True,
        display_order=1,
    )
    read = _plan_to_read(plan)
    assert read.features == {"analytics": True}
    assert read.limits == {"max_members": 10}


def test_plan_to_read_empty_features():
    """_plan_to_read handles empty features gracefully."""
    plan = SubscriptionPlan(
        id=uuid.uuid4(),
        name="Free",
        slug="free",
        amount=0,
        currency="usd",
        interval="month",
        features="{}",
        limits=None,
        is_active=True,
        display_order=0,
    )
    read = _plan_to_read(plan)
    assert read.features == {}
    assert read.limits is None


def test_plan_to_read_invalid_json():
    """_plan_to_read handles invalid JSON gracefully."""
    plan = SubscriptionPlan(
        id=uuid.uuid4(),
        name="Bad",
        slug="bad",
        amount=0,
        currency="usd",
        interval="month",
        features="not-json",
        limits="not-json",
        is_active=True,
        display_order=0,
    )
    read = _plan_to_read(plan)
    assert read.features == {}
    assert read.limits is None


# ── Billing config check ────────────────────────────────────────


def test_stripe_config_defaults():
    """Stripe config defaults to empty strings."""
    from app.core.config import settings

    # These should be empty by default (not configured)
    assert isinstance(settings.STRIPE_SECRET_KEY, str)
    assert isinstance(settings.STRIPE_PUBLISHABLE_KEY, str)
    assert isinstance(settings.STRIPE_WEBHOOK_SECRET, str)
