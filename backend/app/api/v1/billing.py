"""Billing endpoints — Stripe Checkout and webhook receiver."""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from loguru import logger


def register(parent: Blueprint) -> None:
    bp = Blueprint("billing", __name__)

    @bp.post("/billing/stripe/webhook")
    def stripe_webhook():
        """Receive and process Stripe webhook events.

        Must be reachable publicly (no JWT auth). Stripe signature is validated
        inside handle_webhook_event using STRIPE_WEBHOOK_SECRET.
        """
        from ...services.billing import handle_webhook_event
        from ...core.config import settings

        if not settings.stripe_webhook_secret:
            return jsonify({"error": "Stripe not configured"}), 503

        sig_header = request.headers.get("Stripe-Signature", "")
        payload = request.get_data()

        try:
            result = handle_webhook_event(payload, sig_header)
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

        return jsonify(result), 200

    @bp.post("/billing/checkout")
    @jwt_required()
    def create_checkout():
        """Create a Stripe Checkout session for the current tenant.

        Only super_admin or admin of the tenant may initiate checkout.
        """
        from ...services.billing import create_checkout_session, get_stripe
        from ...core.config import settings
        from flask import g

        if not settings.stripe_secret_key or not settings.stripe_price_id:
            return jsonify({"error": "Stripe não configurado neste ambiente"}), 503

        claims = get_jwt()
        roles = set(claims.get("roles") or [])
        if not {"admin", "super_admin"}.intersection(roles):
            return jsonify({"error": "Acesso negado"}), 403

        tenant_id = getattr(g, "tenant_id", None)
        if not tenant_id:
            return jsonify({"error": "Tenant não identificado"}), 400

        from ...core.database import session_scope
        from ...models import Tenant

        with session_scope() as session:
            tenant = session.get(Tenant, tenant_id)
            if not tenant:
                return jsonify({"error": "Escola não encontrada"}), 404

            # If already subscribed and active, return portal URL instead
            if tenant.stripe_customer_id and tenant.plano_ativo:
                try:
                    stripe = get_stripe()
                    portal = stripe.billing_portal.Session.create(
                        customer=tenant.stripe_customer_id,
                        return_url=f"{settings.frontend_url}/app/admin/escolas",
                    )
                    return jsonify({"url": portal.url, "type": "portal"})
                except Exception as exc:
                    logger.warning(
                        "Stripe portal session failed for tenant {}: {}", tenant_id, exc
                    )
                    return jsonify({"error": "Erro ao acessar portal de faturamento. Tente novamente."}), 502

            # Admin email for pre-filling checkout
            user_id = int(get_jwt_identity())
            from ...models import Usuario
            user = session.get(Usuario, user_id)
            email = user.email if user else None

            try:
                url = create_checkout_session(tenant_id, tenant.slug, email)
                return jsonify({"url": url, "type": "checkout"})
            except Exception as e:
                return jsonify({"error": f"Erro ao criar sessão de pagamento: {e}"}), 500

    @bp.get("/billing/status")
    @jwt_required()
    def billing_status():
        """Return the billing status for the current tenant."""
        from flask import g
        from ...core.database import session_scope
        from ...models import Tenant

        tenant_id = getattr(g, "tenant_id", None)
        if not tenant_id:
            return jsonify({"error": "Tenant não identificado"}), 400

        with session_scope() as session:
            tenant = session.get(Tenant, tenant_id)
            if not tenant:
                return jsonify({"error": "Escola não encontrada"}), 404

            return jsonify({
                "plano": tenant.plano,
                "plano_ativo": tenant.plano_ativo,
                "plano_expira_em": tenant.plano_expira_em.isoformat() if tenant.plano_expira_em else None,
                "has_subscription": bool(tenant.stripe_subscription_id),
            })

    parent.register_blueprint(bp)
