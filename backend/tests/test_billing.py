from app.core.database import session_scope
from app.models import StripeWebhookEvent, Tenant
from app.services import billing as billing_service


class _FakeStripeModule:
    class error:
        class SignatureVerificationError(Exception):
            pass

    class checkout:
        class Session:
            last_call = None

            @staticmethod
            def create(**kwargs):
                _FakeStripeModule.checkout.Session.last_call = kwargs
                return type("CheckoutSession", (), {"url": "https://checkout.stripe.test/session"})()

    class Webhook:
        payload = None

        @staticmethod
        def construct_event(_payload, _sig_header, _secret):
            if _FakeStripeModule.Webhook.payload is None:
                raise AssertionError("Webhook payload was not configured for test")
            return _FakeStripeModule.Webhook.payload


def test_create_checkout_session_uses_idempotency_key(monkeypatch):
    monkeypatch.setattr(billing_service, "get_stripe", lambda: _FakeStripeModule)
    monkeypatch.setattr(billing_service.settings, "stripe_price_id", "price_test")

    url = billing_service.create_checkout_session(tenant_id=7, tenant_slug="escola-teste", email="admin@example.com")

    assert url == "https://checkout.stripe.test/session"
    assert _FakeStripeModule.checkout.Session.last_call["idempotency_key"] == "tenant-checkout:7:escola-teste:price_test"
    assert _FakeStripeModule.checkout.Session.last_call["customer_email"] == "admin@example.com"


def test_handle_webhook_event_is_idempotent(monkeypatch):
    monkeypatch.setattr(billing_service, "get_stripe", lambda: _FakeStripeModule)
    monkeypatch.setattr(billing_service.settings, "stripe_price_id", "price_test")
    event_id = "evt_test_idempotent_checkout_001"

    with session_scope() as session:
        session.query(StripeWebhookEvent).filter(StripeWebhookEvent.event_id == event_id).delete()
        tenant = session.query(Tenant).filter(Tenant.slug == "default").first()
        if not tenant:
            tenant = Tenant(name="Escola Teste", slug="default", is_active=True)
            session.add(tenant)
            session.flush()
        tenant_id = tenant.id

    _FakeStripeModule.Webhook.payload = {
        "id": event_id,
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "metadata": {"tenant_id": str(tenant_id), "tenant_slug": "default"},
                "customer": "cus_123",
                "subscription": "sub_123",
            }
        },
    }

    first = billing_service.handle_webhook_event(b"{}", "signature")
    second = billing_service.handle_webhook_event(b"{}", "signature")

    assert first["action"] == "processed"
    assert second["action"] == "ignored_duplicate"

    with session_scope() as session:
        event_log = session.query(StripeWebhookEvent).filter(StripeWebhookEvent.event_id == event_id).one()
        tenant = session.get(Tenant, tenant_id)

        assert event_log.status == "processed"
        assert tenant.stripe_customer_id == "cus_123"
        assert tenant.stripe_subscription_id == "sub_123"
        assert tenant.plano_ativo is True
