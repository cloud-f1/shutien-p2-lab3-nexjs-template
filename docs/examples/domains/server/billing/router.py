"""Billing endpoints — plans, checkout, portal, subscription, webhook."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_active_user
from app.core.config import settings
from app.core.limiter import limiter
from app.db.session import get_db
from app.domains.billing import service
from app.domains.billing.schemas import (
    CheckoutSessionCreate,
    CheckoutSessionRead,
    PlanRead,
    PortalSessionCreate,
    PortalSessionRead,
    SubscriptionRead,
)
from app.domains.teams.dependencies import get_team_membership, require_role
from app.domains.teams.models import Role
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter()


def _check_stripe_configured() -> None:
    """Raise 503 if Stripe is not configured."""
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="BILLING_NOT_CONFIGURED")


@router.get("/plans", response_model=list[PlanRead])
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def list_plans(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> list[PlanRead]:
    """List available subscription plans (public, no auth)."""
    return await service.list_plans(db)


@router.post("/checkout", response_model=CheckoutSessionRead)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def create_checkout(
    body: CheckoutSessionCreate,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
) -> CheckoutSessionRead:
    """Create a Stripe Checkout session for a team."""
    _check_stripe_configured()

    # Verify team membership with admin+ role
    membership_checker = require_role(Role.admin)
    await membership_checker(
        member=await get_team_membership(body.team_id, user, db),
    )

    try:
        result = await service.create_checkout_session(
            team_id=body.team_id,
            plan_id=body.plan_id,
            success_url=body.success_url,
            cancel_url=body.cancel_url,
            user_email=user.email,
            db=db,
        )
        return CheckoutSessionRead(**result)
    except ValueError as e:
        detail = str(e)
        if detail == "SUBSCRIPTION_ALREADY_ACTIVE":
            raise HTTPException(status_code=409, detail=detail)
        raise HTTPException(status_code=400, detail=detail)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/portal", response_model=PortalSessionRead)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def create_portal(
    body: PortalSessionCreate,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
) -> PortalSessionRead:
    """Create a Stripe Customer Portal session."""
    _check_stripe_configured()

    # Verify team membership with admin+ role
    membership_checker = require_role(Role.admin)
    await membership_checker(
        member=await get_team_membership(body.team_id, user, db),
    )

    try:
        result = await service.create_portal_session(
            team_id=body.team_id,
            return_url=body.return_url,
            db=db,
        )
        return PortalSessionRead(**result)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/subscription/{team_id}", response_model=SubscriptionRead)
@limiter.limit(settings.RATE_LIMIT_GENERAL)
async def get_subscription(
    team_id: str,
    request: Request,
    user: User = Depends(current_active_user),
    db: AsyncSession = Depends(get_db),
) -> SubscriptionRead:
    """Get current subscription for a team."""
    import uuid as _uuid

    team_uuid = _uuid.UUID(team_id)

    # Verify team membership (any role)
    await get_team_membership(team_uuid, user, db)

    return await service.get_subscription(team_uuid, db)


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Process Stripe webhook events. No auth — uses Stripe signature verification."""
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="WEBHOOK_NOT_CONFIGURED")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        result = await service.process_webhook(payload, sig_header, db)
        return result
    except ValueError as e:
        detail = str(e)
        if "INVALID_SIGNATURE" in detail:
            raise HTTPException(status_code=400, detail="INVALID_SIGNATURE")
        raise HTTPException(status_code=400, detail=detail)
