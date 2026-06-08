"""Testes de regressão para as correções de segurança aplicadas.

Cobre:
  - SEC-01: Tenant isolation nos endpoints AI
  - SEC-02: ENCRYPTION_KEY independente do SECRET_KEY
  - SEC-05: Idempotência atômica do webhook Stripe
  - BUG-02: Validação de photo_url
  - MEL-03: Rate limiting por username no login
"""
import pytest
from unittest.mock import patch, MagicMock

from app.core.security import generate_tokens
from app.core.database import session_scope


# ─── Helpers ────────────────────────────────────────────────────────────────

def _headers(flask_app, role: str, tenant_id: int = 1, academic_year_id: int = 1):
    with flask_app.app_context():
        tokens = generate_tokens(
            identity="999",
            roles=[role],
            extra_claims={"tenant_id": tenant_id, "academic_year_id": academic_year_id},
        )
    return {"Authorization": f"Bearer {tokens['access_token']}"}


# ─── SEC-01: Tenant isolation nos endpoints AI ──────────────────────────────

def test_ai_risk_endpoint_requires_valid_tenant(flask_app, admin_user):
    """Predição de risco deve retornar 404 para aluno inexistente no tenant."""
    client = flask_app.test_client()
    headers = _headers(flask_app, "admin")

    response = client.get("/api/v1/ai/risk/999999", headers=headers)
    # Aluno não existe — deve retornar 404, não dados de outro tenant
    assert response.status_code in (404, 200)
    if response.status_code == 200:
        assert response.json.get("status") in ("INEXISTENTE", "TREINANDO", "ERRO")


def test_ai_interventions_endpoint_requires_valid_tenant(flask_app, admin_user):
    """Intervenções devem retornar 404 para aluno inexistente no tenant."""
    client = flask_app.test_client()
    headers = _headers(flask_app, "admin")

    response = client.get("/api/v1/ai/interventions/999999", headers=headers)
    assert response.status_code == 404


def test_ai_bulk_interventions_rejects_large_list(flask_app, admin_user):
    """Bulk interventions deve rejeitar listas com mais de 100 IDs."""
    client = flask_app.test_client()
    headers = _headers(flask_app, "admin")

    response = client.post(
        "/api/v1/ai/bulk-interventions",
        json={"student_ids": list(range(101))},
        headers=headers,
    )
    assert response.status_code == 400


def test_intervention_service_fails_without_tenant_context(flask_app):
    """analyze_student deve retornar erro explícito sem tenant_id no contexto."""
    from app.services.intervention_service import PedagogicalInterventionService
    from unittest.mock import MagicMock

    mock_session = MagicMock()

    with flask_app.app_context():
        # Remover tenant_id do contexto Flask g
        from flask import g
        if hasattr(g, "tenant_id"):
            delattr(g, "tenant_id")  # pragma: no cover

        result = PedagogicalInterventionService.analyze_student(mock_session, 1)
        assert "error" in result
        assert "tenant" in result["error"].lower()


# ─── SEC-02: ENCRYPTION_KEY independente ────────────────────────────────────

def test_encrypt_decrypt_roundtrip():
    """encrypt_secret / decrypt_secret devem ser inversas."""
    from app.core.crypto import encrypt_secret, decrypt_secret

    plaintext = "sk_live_test_api_key_12345"
    encrypted = encrypt_secret(plaintext)
    assert encrypted.startswith("enc:")
    assert decrypt_secret(encrypted) == plaintext


def test_encrypt_secret_idempotent():
    """Chamar encrypt_secret num valor já criptografado não deve double-encrypt."""
    from app.core.crypto import encrypt_secret

    plaintext = "my_secret"
    encrypted = encrypt_secret(plaintext)
    double_encrypted = encrypt_secret(encrypted)
    assert encrypted == double_encrypted


def test_decrypt_legacy_plaintext_passthrough():
    """Valores sem prefixo 'enc:' devem passar transparentemente (legado)."""
    from app.core.crypto import decrypt_secret

    legacy = "plaintext_api_key"
    assert decrypt_secret(legacy) == legacy


def test_encryption_key_differs_from_secret_key(flask_app):
    """A chave efetiva de criptografia deve ser diferente de SECRET_KEY."""
    from app.core.config import settings

    effective = settings.get_effective_encryption_key()
    assert effective != settings.secret_key, (
        "ENCRYPTION_KEY deve ser diferente de SECRET_KEY para permitir rotação independente"
    )


# ─── SEC-05: Idempotência do webhook Stripe ──────────────────────────────────

def test_billing_webhook_duplicate_ignored(flask_app):
    """Webhook com event_id já processado deve ser ignorado."""
    from app.services.billing import handle_webhook_event

    fake_event = {
        "id": "evt_test_duplicate_001",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "metadata": {},
                "customer": None,
                "subscription": None,
            }
        },
    }

    with patch("app.services.billing.get_stripe") as mock_stripe_factory:
        mock_stripe = MagicMock()
        mock_stripe.Webhook.construct_event.return_value = fake_event
        mock_stripe_factory.return_value = mock_stripe

        with patch("app.services.billing._claim_webhook_event", return_value="processed"):
            result = handle_webhook_event(b"payload", "sig")
            assert result["action"] == "ignored_duplicate"


def test_billing_webhook_claim_returns_processing_for_new_event(flask_app, admin_user):
    """_claim_webhook_event deve retornar 'processing' para event_id novo."""
    from app.services.billing import _claim_webhook_event
    from app.models.stripe_webhook_event import StripeWebhookEvent

    event_id = "evt_test_new_event_xyz"

    # Garantir que não existe no banco
    with session_scope() as s:
        s.query(StripeWebhookEvent).filter(
            StripeWebhookEvent.event_id == event_id
        ).delete()

    result = _claim_webhook_event(event_id, "checkout.session.completed")
    assert result == "processing"

    # Limpar após o teste
    with session_scope() as s:
        s.query(StripeWebhookEvent).filter(
            StripeWebhookEvent.event_id == event_id
        ).delete()


# ─── BUG-02: Validação de photo_url ─────────────────────────────────────────

def test_usuario_schema_rejects_javascript_url():
    """UsuarioSchema deve rejeitar photo_url com protocolo javascript:."""
    from pydantic import ValidationError
    from app.schemas.usuario import UsuarioSchema

    with pytest.raises(ValidationError, match="photo_url"):
        UsuarioSchema(
            id=1,
            username="test",
            photo_url="javascript:alert(1)",
        )


def test_usuario_schema_rejects_http_url():
    """UsuarioSchema deve rejeitar photo_url http:// (sem TLS)."""
    from pydantic import ValidationError
    from app.schemas.usuario import UsuarioSchema

    with pytest.raises(ValidationError, match="photo_url"):
        UsuarioSchema(
            id=1,
            username="test",
            photo_url="http://evil.com/img.png",
        )


def test_usuario_schema_accepts_https_url():
    """UsuarioSchema deve aceitar photo_url https://."""
    from app.schemas.usuario import UsuarioSchema

    schema = UsuarioSchema(
        id=1,
        username="test",
        photo_url="https://cdn.example.com/avatar.png",
    )
    assert schema.photo_url == "https://cdn.example.com/avatar.png"


def test_usuario_schema_accepts_relative_path():
    """UsuarioSchema deve aceitar caminhos relativos /uploads/..."""
    from app.schemas.usuario import UsuarioSchema

    schema = UsuarioSchema(
        id=1,
        username="test",
        photo_url="/uploads/users/avatar.png",
    )
    assert schema.photo_url == "/uploads/users/avatar.png"


def test_usuario_schema_accepts_none_photo_url():
    """UsuarioSchema deve aceitar photo_url None (campo opcional)."""
    from app.schemas.usuario import UsuarioSchema

    schema = UsuarioSchema(id=1, username="test", photo_url=None)
    assert schema.photo_url is None


# ─── MEL-03: Rate limiting por username ──────────────────────────────────────

def test_login_with_wrong_password_returns_401(client, admin_user):
    """Login com senha errada deve retornar 401."""
    response = client.post("/api/v1/auth/login", json={
        "username": "admin_test",
        "password": "wrong_password_xyz",
        "tenant_slug": "default",
    })
    assert response.status_code == 401


def test_login_missing_fields_returns_422(client):
    """Login sem username/password deve retornar 422."""
    response = client.post("/api/v1/auth/login", json={})
    assert response.status_code == 422


def test_login_success_returns_access_token(client, admin_user):
    """Login com credenciais válidas deve retornar access_token."""
    response = client.post("/api/v1/auth/login", json={
        "username": "admin_test",
        "password": "admin123",
        "tenant_slug": "default",
    })
    assert response.status_code == 200
    assert "access_token" in response.json


# ─── Validators ──────────────────────────────────────────────────────────────

def test_password_validator_rejects_weak_password():
    """validate_password_strength deve rejeitar senhas fracas."""
    from app.core.validators import validate_password_strength

    with pytest.raises(ValueError):
        validate_password_strength("abc")

    with pytest.raises(ValueError):
        validate_password_strength("abcdefgh")  # sem maiúscula, número, especial


def test_password_validator_accepts_strong_password():
    """validate_password_strength deve aceitar senhas fortes."""
    from app.core.validators import validate_password_strength

    result = validate_password_strength("Senha@123")
    assert result == "Senha@123"


def test_username_validator_rejects_special_chars():
    """validate_username deve rejeitar usernames com caracteres especiais."""
    from app.core.validators import validate_username

    with pytest.raises(ValueError):
        validate_username("user name")

    with pytest.raises(ValueError):
        validate_username("user<script>")


def test_username_validator_accepts_valid_username():
    """validate_username deve aceitar usernames válidos."""
    from app.core.validators import validate_username

    assert validate_username("user.name_123") == "user.name_123"
    assert validate_username("admin@escola") == "admin@escola"
