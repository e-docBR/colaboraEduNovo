"""Billing service — Stripe integration for subscription management."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from loguru import logger

from ..core.config import settings


def get_stripe():
    """Return the stripe module, configured with the secret key."""
    try:
        import stripe as _stripe
        _stripe.api_key = settings.stripe_secret_key
        return _stripe
    except ImportError:
        raise RuntimeError("stripe package not installed. Add 'stripe' to requirements.")


def create_checkout_session(tenant_id: int, tenant_slug: str, email: Optional[str] = None) -> str:
    """Create a Stripe Checkout session for a new subscription.

    Returns the session URL to redirect the school admin to.
    """
    stripe = get_stripe()
    success_url = f"{settings.frontend_url}/app/admin/escolas?checkout=success"
    cancel_url = f"{settings.frontend_url}/app/admin/escolas?checkout=cancel"

    params: dict = {
        "mode": "subscription",
        "line_items": [{"price": settings.stripe_price_id, "quantity": 1}],
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata": {"tenant_id": str(tenant_id), "tenant_slug": tenant_slug},
        "allow_promotion_codes": True,
    }
    if email:
        params["customer_email"] = email

    session = stripe.checkout.Session.create(**params)
    return session.url


def handle_webhook_event(payload: bytes, sig_header: str) -> dict:
    """Validate and dispatch a Stripe webhook event.

    Returns a dict with the action taken.
    """
    stripe = get_stripe()
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.stripe_webhook_secret
        )
    except stripe.error.SignatureVerificationError as e:
        raise ValueError(f"Invalid webhook signature: {e}") from e

    event_type = event["type"]
    data = event["data"]["object"]

    logger.info("Stripe webhook received: type={}", event_type)

    if event_type in ("customer.subscription.created", "customer.subscription.updated"):
        _handle_subscription_change(data)
    elif event_type == "customer.subscription.deleted":
        _handle_subscription_deleted(data)
    elif event_type == "invoice.payment_failed":
        _handle_payment_failed(data)
    elif event_type == "checkout.session.completed":
        _handle_checkout_completed(data)
    else:
        logger.debug("Stripe event {} not handled", event_type)
        return {"action": "ignored", "type": event_type}

    return {"action": "processed", "type": event_type}


def _get_tenant_by_customer(session, customer_id: str):
    from ..models import Tenant
    return session.query(Tenant).filter(Tenant.stripe_customer_id == customer_id).first()


def _handle_checkout_completed(data: dict) -> None:
    """Link Stripe customer/subscription IDs to the correct tenant after checkout."""
    from ..core.database import session_scope
    from ..models import Tenant

    metadata = data.get("metadata") or {}
    tenant_id = metadata.get("tenant_id")
    customer_id = data.get("customer")
    subscription_id = data.get("subscription")

    if not tenant_id or not customer_id:
        logger.warning("checkout.session.completed missing tenant_id or customer — skipping")
        return

    with session_scope() as session:
        tenant = session.get(Tenant, int(tenant_id))
        if not tenant:
            logger.error("Tenant {} not found for checkout.session.completed", tenant_id)
            return
        tenant.stripe_customer_id = customer_id
        if subscription_id:
            tenant.stripe_subscription_id = subscription_id
        tenant.plano = "basico"
        tenant.plano_ativo = True
        tenant.plano_expira_em = None
        session.add(tenant)
        logger.info("Tenant {} activated via checkout. customer={}", tenant_id, customer_id)


def _handle_subscription_change(data: dict) -> None:
    from ..core.database import session_scope
    from datetime import timezone

    customer_id = data.get("customer")
    status = data.get("status")
    current_period_end = data.get("current_period_end")
    subscription_id = data.get("id")

    active = status in ("active", "trialing")
    expiry = datetime.fromtimestamp(current_period_end, tz=timezone.utc) if current_period_end else None

    with session_scope() as session:
        tenant = _get_tenant_by_customer(session, customer_id)
        if not tenant:
            logger.warning("No tenant found for customer {} — subscription change ignored", customer_id)
            return
        tenant.stripe_subscription_id = subscription_id
        tenant.plano_ativo = active
        tenant.plano_expira_em = expiry
        if active:
            tenant.plano = "basico"
        session.add(tenant)
        logger.info("Tenant {} subscription updated. status={} active={}", tenant.id, status, active)


def _handle_subscription_deleted(data: dict) -> None:
    from ..core.database import session_scope

    customer_id = data.get("customer")
    with session_scope() as session:
        tenant = _get_tenant_by_customer(session, customer_id)
        if not tenant:
            logger.warning("No tenant for customer {} — subscription deleted event ignored", customer_id)
            return
        tenant.plano_ativo = False
        tenant.stripe_subscription_id = None
        session.add(tenant)
        logger.info("Tenant {} subscription deleted — access blocked", tenant.id)


def _handle_payment_failed(data: dict) -> None:
    from ..core.database import session_scope

    customer_id = data.get("customer")
    with session_scope() as session:
        tenant = _get_tenant_by_customer(session, customer_id)
        if not tenant:
            return
        # Don't immediately block — Stripe retries; just log
        logger.warning("Tenant {} invoice payment failed. customer={}", tenant.id, customer_id)
