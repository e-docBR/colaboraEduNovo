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

    session = stripe.checkout.Session.create(
        **params,
        idempotency_key=_checkout_idempotency_key(tenant_id, tenant_slug),
    )
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

    event_id = event.get("id")
    event_type = event["type"]
    data = event["data"]["object"]

    logger.info("Stripe webhook received: type={}", event_type)

    if event_id and _claim_webhook_event(event_id, event_type) == "processed":
        logger.info("Stripe webhook duplicate ignored: id={} type={}", event_id, event_type)
        return {"action": "ignored_duplicate", "type": event_type, "event_id": event_id}

    try:
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
            if event_id:
                _finalize_webhook_event(event_id, "ignored")
            return {"action": "ignored", "type": event_type, "event_id": event_id}
    except Exception as exc:
        if event_id:
            _finalize_webhook_event(event_id, "failed", str(exc))
        raise

    if event_id:
        _finalize_webhook_event(event_id, "processed")

    return {"action": "processed", "type": event_type, "event_id": event_id}


def _checkout_idempotency_key(tenant_id: int, tenant_slug: str) -> str:
    return f"tenant-checkout:{tenant_id}:{tenant_slug}:{settings.stripe_price_id}"


def _claim_webhook_event(event_id: str, event_type: str) -> str:
    from ..core.database import session_scope
    from ..models import StripeWebhookEvent

    with session_scope() as session:
        existing = (
            session.query(StripeWebhookEvent)
            .filter(StripeWebhookEvent.event_id == event_id)
            .first()
        )
        if existing and existing.status == "processed":
            return "processed"

        if existing:
            existing.event_type = event_type
            existing.status = "processing"
            existing.error_message = None
            existing.processed_at = None
            session.add(existing)
            return existing.status

        session.add(
            StripeWebhookEvent(
                event_id=event_id,
                event_type=event_type,
                status="processing",
            )
        )
        return "processing"


def _finalize_webhook_event(event_id: str, status: str, error_message: str | None = None) -> None:
    from ..core.database import session_scope
    from ..models import StripeWebhookEvent

    with session_scope() as session:
        webhook_event = (
            session.query(StripeWebhookEvent)
            .filter(StripeWebhookEvent.event_id == event_id)
            .first()
        )
        if not webhook_event:
            webhook_event = StripeWebhookEvent(event_id=event_id, event_type="unknown", status=status)

        webhook_event.status = status
        webhook_event.error_message = error_message
        webhook_event.processed_at = datetime.now(timezone.utc) if status in {"processed", "ignored"} else None
        session.add(webhook_event)


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
