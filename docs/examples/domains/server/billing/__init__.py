"""Billing domain — Stripe checkout, subscriptions, webhooks."""

from app.domains import DomainConfig
from app.domains.billing.models import Subscription, SubscriptionPlan, WebhookEvent
from app.domains.billing.router import router

domain_config = DomainConfig(
    router=router,
    prefix="/billing",
    tags=["billing"],
    models=[SubscriptionPlan, Subscription, WebhookEvent],
)

__all__ = ["domain_config", "SubscriptionPlan", "Subscription", "WebhookEvent"]
