"""Billing service — Stripe checkout, portal, webhook processing."""

import json
import logging
from datetime import datetime, timezone

import stripe
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.domains.billing.models import Subscription, SubscriptionPlan, WebhookEvent
from app.domains.billing.schemas import PlanRead, SubscriptionRead, SubscriptionStatus
from app.domains.teams.models import Team

logger = logging.getLogger(__name__)


def _configure_stripe() -> None:
    """Set Stripe API key and version from settings."""
    stripe.api_key = settings.STRIPE_SECRET_KEY
    stripe.api_version = "2026-02-25.clover"


def _plan_to_read(plan: SubscriptionPlan) -> PlanRead:
    """Convert a SubscriptionPlan model to PlanRead schema."""
    features = {}
    if plan.features:
        try:
            features = (
                json.loads(plan.features) if isinstance(plan.features, str) else plan.features
            )
        except (json.JSONDecodeError, TypeError):
            features = {}

    limits = None
    if plan.limits:
        try:
            limits = json.loads(plan.limits) if isinstance(plan.limits, str) else plan.limits
        except (json.JSONDecodeError, TypeError):
            limits = None

    return PlanRead(
        id=plan.id,
        name=plan.name,
        slug=plan.slug,
        stripe_price_id=plan.stripe_price_id or "",
        amount=plan.amount,
        currency=plan.currency,
        interval=plan.interval,
        features=features,
        limits=limits,
        is_active=plan.is_active,
        display_order=plan.display_order,
    )


async def list_plans(db: AsyncSession) -> list[PlanRead]:
    """List all active subscription plans, ordered by display_order."""
    result = await db.execute(
        select(SubscriptionPlan)
        .where(SubscriptionPlan.is_active.is_(True))
        .order_by(SubscriptionPlan.display_order)
    )
    plans = result.scalars().all()
    return [_plan_to_read(p) for p in plans]


async def get_subscription(team_id, db: AsyncSession) -> SubscriptionRead:
    """Get current subscription for a team. Returns free tier if no subscription."""
    result = await db.execute(select(Subscription).where(Subscription.team_id == team_id))
    subscription = result.scalar_one_or_none()

    if subscription is None:
        # Return free tier
        free_plan = await _get_or_create_free_plan(db)
        return SubscriptionRead(
            id=None,
            team_id=team_id,
            status=SubscriptionStatus.free,
            plan=_plan_to_read(free_plan),
            cancel_at_period_end=False,
        )

    return SubscriptionRead(
        id=subscription.id,
        team_id=subscription.team_id,
        status=SubscriptionStatus(subscription.status),
        plan=_plan_to_read(subscription.plan),
        stripe_subscription_id=subscription.stripe_subscription_id,
        stripe_customer_id=subscription.stripe_customer_id,
        current_period_start=subscription.current_period_start,
        current_period_end=subscription.current_period_end,
        cancel_at_period_end=subscription.cancel_at_period_end,
        created_at=subscription.created_at,
        updated_at=subscription.updated_at,
    )


async def create_checkout_session(
    team_id,
    plan_id,
    success_url: str | None,
    cancel_url: str | None,
    user_email: str,
    db: AsyncSession,
) -> dict:
    """Create a Stripe Checkout Session for a team to subscribe to a plan."""
    _configure_stripe()

    # Check for existing active subscription
    existing = await db.execute(
        select(Subscription).where(
            Subscription.team_id == team_id,
            Subscription.status.in_(["active", "trialing"]),
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise ValueError("SUBSCRIPTION_ALREADY_ACTIVE")

    # Get the plan
    plan_result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.id == plan_id))
    plan = plan_result.scalar_one_or_none()
    if plan is None:
        raise LookupError("PLAN_NOT_FOUND")

    if not plan.stripe_price_id:
        raise ValueError("PLAN_HAS_NO_STRIPE_PRICE")

    # Get or create Stripe customer for team
    team_result = await db.execute(select(Team).where(Team.id == team_id))
    team = team_result.scalar_one_or_none()
    if team is None:
        raise LookupError("TEAM_NOT_FOUND")

    customer_id = team.stripe_customer_id
    if not customer_id:
        customer = stripe.Customer.create(
            email=user_email,
            metadata={"team_id": str(team_id)},
        )
        customer_id = customer.id
        team.stripe_customer_id = customer_id
        await db.flush()

    # Create Checkout Session
    session = stripe.checkout.Session.create(
        customer=customer_id,
        mode="subscription",
        line_items=[{"price": plan.stripe_price_id, "quantity": 1}],
        success_url=success_url or "http://localhost:5173/dashboard?billing=success",
        cancel_url=cancel_url or "http://localhost:5173/pricing",
        metadata={"team_id": str(team_id), "plan_id": str(plan_id)},
    )

    await db.commit()

    return {"checkout_url": session.url, "session_id": session.id}


async def create_portal_session(
    team_id,
    return_url: str | None,
    db: AsyncSession,
) -> dict:
    """Create a Stripe Customer Portal session for a team."""
    _configure_stripe()

    team_result = await db.execute(select(Team).where(Team.id == team_id))
    team = team_result.scalar_one_or_none()
    if team is None:
        raise LookupError("TEAM_NOT_FOUND")

    if not team.stripe_customer_id:
        raise LookupError("NO_STRIPE_CUSTOMER")

    session = stripe.billing_portal.Session.create(
        customer=team.stripe_customer_id,
        return_url=return_url or "http://localhost:5173/dashboard",
    )

    return {"portal_url": session.url}


async def process_webhook(payload: bytes, sig_header: str, db: AsyncSession) -> dict:
    """Process an incoming Stripe webhook event."""
    _configure_stripe()

    # Verify signature
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, settings.STRIPE_WEBHOOK_SECRET)
    except stripe.SignatureVerificationError:
        raise ValueError("INVALID_SIGNATURE")
    except Exception as e:
        raise ValueError(f"INVALID_PAYLOAD: {e}")

    # Idempotency check
    existing = await db.execute(
        select(WebhookEvent).where(WebhookEvent.stripe_event_id == event.id)
    )
    if existing.scalar_one_or_none() is not None:
        logger.info("Duplicate webhook event skipped", extra={"event_id": event.id})
        return {"status": "ok"}

    # Route by event type
    event_type = event.type
    event_data = event.data.object

    if event_type == "checkout.session.completed":
        await _handle_checkout_completed(event_data, db)
    elif event_type == "invoice.paid":
        await _handle_invoice_paid(event_data, db)
    elif event_type == "invoice.payment_failed":
        await _handle_invoice_payment_failed(event_data, db)
    elif event_type == "customer.subscription.updated":
        await _handle_subscription_updated(event_data, db)
    elif event_type == "customer.subscription.deleted":
        await _handle_subscription_deleted(event_data, db)
    else:
        logger.info("Unhandled webhook event type", extra={"event_type": event_type})

    # Record webhook event for idempotency
    webhook_event = WebhookEvent(
        stripe_event_id=event.id,
        event_type=event_type,
    )
    db.add(webhook_event)
    await db.commit()

    logger.info(
        "Webhook processed",
        extra={"event_id": event.id, "event_type": event_type},
    )
    return {"status": "ok"}


async def _handle_checkout_completed(session_data, db: AsyncSession) -> None:
    """Handle checkout.session.completed — create or update subscription."""
    metadata = session_data.get("metadata", {})
    team_id = metadata.get("team_id")
    plan_id = metadata.get("plan_id")
    stripe_subscription_id = session_data.get("subscription")
    stripe_customer_id = session_data.get("customer")

    if not team_id or not plan_id:
        logger.warning("Checkout completed without team_id or plan_id in metadata")
        return

    # Check if subscription already exists for this team
    result = await db.execute(select(Subscription).where(Subscription.team_id == team_id))
    existing = result.scalar_one_or_none()

    if existing:
        existing.plan_id = plan_id
        existing.stripe_subscription_id = stripe_subscription_id
        existing.stripe_customer_id = stripe_customer_id
        existing.status = "active"
    else:
        subscription = Subscription(
            team_id=team_id,
            plan_id=plan_id,
            stripe_subscription_id=stripe_subscription_id,
            stripe_customer_id=stripe_customer_id,
            status="active",
        )
        db.add(subscription)

    # Also update team's stripe_customer_id
    team_result = await db.execute(select(Team).where(Team.id == team_id))
    team = team_result.scalar_one_or_none()
    if team and stripe_customer_id:
        team.stripe_customer_id = stripe_customer_id


async def _handle_invoice_paid(invoice_data, db: AsyncSession) -> None:
    """Handle invoice.paid — update subscription period."""
    stripe_sub_id = invoice_data.get("subscription")
    if not stripe_sub_id:
        return

    result = await db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == stripe_sub_id)
    )
    subscription = result.scalar_one_or_none()
    if not subscription:
        return

    period_start = invoice_data.get("period_start")
    period_end = invoice_data.get("period_end")

    if period_start:
        subscription.current_period_start = datetime.fromtimestamp(period_start, tz=timezone.utc)
    if period_end:
        subscription.current_period_end = datetime.fromtimestamp(period_end, tz=timezone.utc)
    subscription.status = "active"


async def _handle_invoice_payment_failed(invoice_data, db: AsyncSession) -> None:
    """Handle invoice.payment_failed — set status to past_due."""
    stripe_sub_id = invoice_data.get("subscription")
    if not stripe_sub_id:
        return

    result = await db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == stripe_sub_id)
    )
    subscription = result.scalar_one_or_none()
    if subscription:
        subscription.status = "past_due"


async def _handle_subscription_updated(sub_data, db: AsyncSession) -> None:
    """Handle customer.subscription.updated — sync status and period."""
    stripe_sub_id = sub_data.get("id")
    if not stripe_sub_id:
        return

    result = await db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == stripe_sub_id)
    )
    subscription = result.scalar_one_or_none()
    if not subscription:
        return

    subscription.status = sub_data.get("status", subscription.status)
    subscription.cancel_at_period_end = sub_data.get(
        "cancel_at_period_end", subscription.cancel_at_period_end
    )

    current_period = sub_data.get("current_period_start")
    if current_period:
        subscription.current_period_start = datetime.fromtimestamp(current_period, tz=timezone.utc)
    current_period_end = sub_data.get("current_period_end")
    if current_period_end:
        subscription.current_period_end = datetime.fromtimestamp(
            current_period_end, tz=timezone.utc
        )


async def _handle_subscription_deleted(sub_data, db: AsyncSession) -> None:
    """Handle customer.subscription.deleted — set status to canceled."""
    stripe_sub_id = sub_data.get("id")
    if not stripe_sub_id:
        return

    result = await db.execute(
        select(Subscription).where(Subscription.stripe_subscription_id == stripe_sub_id)
    )
    subscription = result.scalar_one_or_none()
    if subscription:
        subscription.status = "canceled"


async def _get_or_create_free_plan(db: AsyncSession) -> SubscriptionPlan:
    """Get or create the free tier plan."""
    result = await db.execute(select(SubscriptionPlan).where(SubscriptionPlan.slug == "free"))
    plan = result.scalar_one_or_none()
    if plan:
        return plan

    plan = SubscriptionPlan(
        name="Free",
        slug="free",
        stripe_price_id=None,
        amount=0,
        currency="usd",
        interval="month",
        features=json.dumps({"basic_access": True}),
        limits=json.dumps({"max_members": 3}),
        is_active=True,
        display_order=0,
    )
    db.add(plan)
    await db.flush()
    return plan
