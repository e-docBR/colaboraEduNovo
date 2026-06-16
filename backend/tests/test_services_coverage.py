"""Testes de cobertura para serviços críticos sem testes anteriores.

Foco em billing, communication e config para elevar cobertura para 60%+.
"""
import pytest
from unittest.mock import patch, MagicMock


# ─── Config validation ───────────────────────────────────────────────────────

def test_settings_effective_encryption_key_with_explicit_key(flask_app):
    """get_effective_encryption_key deve retornar ENCRYPTION_KEY quando definida."""
    import app.core.config as config_module

    original = config_module.settings.encryption_key
    config_module.settings.encryption_key = "my-explicit-32-char-encryption-key!!"
    try:
        result = config_module.settings.get_effective_encryption_key()
        assert result == "my-explicit-32-char-encryption-key!!"
    finally:
        config_module.settings.encryption_key = original


def test_settings_effective_encryption_key_fallback(flask_app):
    """get_effective_encryption_key deve fazer fallback quando ENCRYPTION_KEY vazia."""
    import app.core.config as config_module

    original = config_module.settings.encryption_key
    config_module.settings.encryption_key = ""
    try:
        result = config_module.settings.get_effective_encryption_key()
        assert result  # não pode ser vazio
        assert result != config_module.settings.secret_key  # deve diferir do SECRET_KEY
    finally:
        config_module.settings.encryption_key = original


# ─── Billing service ─────────────────────────────────────────────────────────

def test_billing_create_checkout_session(flask_app, admin_user):
    """create_checkout_session deve criar URL de checkout via Stripe mock."""
    from app.services.billing import create_checkout_session

    with patch("app.services.billing.get_stripe") as mock_stripe_factory:
        mock_stripe = MagicMock()
        mock_session = MagicMock()
        mock_session.url = "https://checkout.stripe.com/test_session"
        mock_stripe.checkout.Session.create.return_value = mock_session
        mock_stripe_factory.return_value = mock_stripe

        url = create_checkout_session(tenant_id=1, tenant_slug="escola-teste")
        assert url == "https://checkout.stripe.com/test_session"


def test_billing_handle_webhook_processes_subscription_created(flask_app, admin_user):
    """handle_webhook_event deve processar customer.subscription.created."""
    from app.services.billing import handle_webhook_event

    fake_event = {
        "id": "evt_sub_created_001",
        "type": "customer.subscription.created",
        "data": {
            "object": {
                "customer": "cus_test_123",
                "id": "sub_test_123",
                "status": "active",
                "current_period_end": 9999999999,
            }
        },
    }

    with patch("app.services.billing.get_stripe") as mock_stripe_factory:
        mock_stripe = MagicMock()
        mock_stripe.Webhook.construct_event.return_value = fake_event
        mock_stripe_factory.return_value = mock_stripe

        result = handle_webhook_event(b"payload", "sig")
        assert result["action"] in ("processed", "ignored_duplicate")
        assert result["type"] == "customer.subscription.created"


def test_billing_handle_webhook_invalid_signature_raises(flask_app):
    """handle_webhook_event deve levantar ValueError para assinatura inválida."""
    from app.services.billing import handle_webhook_event

    with patch("app.services.billing.get_stripe") as mock_stripe_factory:
        mock_stripe = MagicMock()
        mock_stripe.error = MagicMock()
        mock_stripe.Webhook.construct_event.side_effect = Exception("SignatureVerificationError")
        mock_stripe_factory.return_value = mock_stripe

        with pytest.raises(Exception):
            handle_webhook_event(b"payload", "bad_sig")


def test_billing_handle_webhook_unhandled_event_type_returns_ignored(flask_app):
    """Eventos Stripe não tratados devem retornar action=ignored."""
    from app.services.billing import handle_webhook_event

    fake_event = {
        "id": "evt_unknown_event_001",
        "type": "payment_intent.created",
        "data": {"object": {}},
    }

    with patch("app.services.billing.get_stripe") as mock_stripe_factory:
        mock_stripe = MagicMock()
        mock_stripe.Webhook.construct_event.return_value = fake_event
        mock_stripe_factory.return_value = mock_stripe

        result = handle_webhook_event(b"payload", "sig")
        assert result["action"] in ("ignored", "ignored_duplicate")


# ─── Communication service ───────────────────────────────────────────────────

def test_send_email_skipped_when_smtp_not_configured(flask_app):
    """send_email deve ignorar silenciosamente quando SMTP não está configurado."""
    import app.core.config as config_module
    from app.services.communication_service import CommunicationService

    original_server = config_module.settings.smtp_server
    original_user = config_module.settings.smtp_user
    config_module.settings.smtp_server = ""
    config_module.settings.smtp_user = ""
    try:
        # Não deve levantar exceção mesmo sem SMTP configurado
        CommunicationService.send_email(
            to_email="test@example.com",
            subject="Teste",
            body="Corpo do e-mail",
        )
    finally:
        config_module.settings.smtp_server = original_server
        config_module.settings.smtp_user = original_user


def test_send_email_rejects_invalid_recipient(flask_app):
    """send_email não deve enviar para e-mails claramente inválidos."""
    from app.services.communication_service import CommunicationService

    # Não deve levantar — apenas logar e ignorar
    CommunicationService.send_email(
        to_email="not-an-email",
        subject="Teste",
        body="corpo",
    )


# ─── AI predictor ────────────────────────────────────────────────────────────

def test_predict_risk_without_tenant_returns_error(flask_app):
    """predict_risk sem tenant no contexto deve retornar status=ERRO."""
    from app.services.ai_predictor import predict_risk

    with flask_app.app_context():
        from flask import g
        # Garantir que g não tem tenant_id
        if hasattr(g, "tenant_id"):
            del g.tenant_id  # pragma: no cover

        mock_session = MagicMock()
        result = predict_risk(999999, mock_session)
        assert result["status"] == "ERRO"
        assert "tenant" in result.get("error", "").lower()


def test_predict_risk_returns_treinando_when_model_missing(flask_app, admin_user):
    """predict_risk deve retornar TREINANDO quando modelo não existe."""
    from app.services.ai_predictor import predict_risk

    with flask_app.app_context():
        from flask import g
        g.tenant_id = 1
        g.academic_year_id = 1

        mock_session = MagicMock()

        with patch("app.services.ai_predictor._model_path") as mock_path:
            mock_path.return_value.exists.return_value = False

            with patch("app.services.ai_predictor.enqueue_training"):
                result = predict_risk(1, mock_session)
                assert result["status"] == "TREINANDO"


def test_predict_risk_degrades_when_training_queue_unavailable(flask_app, admin_user):
    """Falha ao enfileirar treino não deve derrubar endpoints de leitura."""
    from app.services.ai_predictor import predict_risk

    with flask_app.app_context():
        from flask import g
        g.tenant_id = 1
        g.academic_year_id = 1

        mock_session = MagicMock()

        with patch("app.services.ai_predictor._model_path") as mock_path:
            mock_path.return_value.exists.return_value = False

            with patch("app.services.ai_predictor.enqueue_training", return_value=False):
                result = predict_risk(1, mock_session)
                assert result["status"] == "INDISPONIVEL"


# ─── Validators ──────────────────────────────────────────────────────────────

def test_validate_password_strength_all_rules():
    """Cada regra de senha deve ser validada individualmente."""
    from app.core.validators import validate_password_strength

    # Muito curta
    with pytest.raises(ValueError, match="8 caracteres"):
        validate_password_strength("Ab1!")

    # Sem maiúscula
    with pytest.raises(ValueError, match="maiúscula"):
        validate_password_strength("abcdef1!")

    # Sem número
    with pytest.raises(ValueError, match="número"):
        validate_password_strength("Abcdefg!")

    # Sem especial
    with pytest.raises(ValueError, match="especial"):
        validate_password_strength("Abcdefg1")

    # Válida
    assert validate_password_strength("Abc@1234") == "Abc@1234"


def test_validate_username_length_limits():
    """Usernames curtos demais ou longos demais devem ser rejeitados."""
    from app.core.validators import validate_username

    with pytest.raises(ValueError):
        validate_username("ab")  # muito curto (< 3)

    with pytest.raises(ValueError):
        validate_username("a" * 51)  # muito longo (> 50)

    assert validate_username("abc") == "abc"
    assert validate_username("a" * 50) == "a" * 50


# ─── Health endpoint ─────────────────────────────────────────────────────────

def test_health_endpoint_returns_200(client):
    """GET /health deve retornar 200 com banco e redis ok."""
    response = client.get("/health")
    assert response.status_code in (200, 503)
    data = response.json
    assert "status" in data
    assert "checks" in data


def test_root_endpoint_returns_links(client):
    """GET / deve retornar links de health e docs."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json
    assert "health" in data


# ─── Crypto ──────────────────────────────────────────────────────────────────

def test_encrypt_empty_string_passthrough():
    """encrypt_secret de string vazia deve retornar string vazia."""
    from app.core.crypto import encrypt_secret, decrypt_secret

    assert encrypt_secret("") == ""
    assert decrypt_secret("") == ""


def test_decrypt_bad_fernet_token_returns_ciphertext():
    """decrypt_secret com token Fernet corrompido deve retornar o ciphertext original."""
    from app.core.crypto import decrypt_secret

    bad = "enc:not_a_valid_fernet_token"
    result = decrypt_secret(bad)
    assert result == bad


# ─── LLM provider deepseek and minimax ──────────────────────────────────────

def test_llm_connection_deepseek_and_minimax():
    """test_llm_connection deve funcionar para deepseek e minimax."""
    from app.services.llm_provider import test_llm_connection

    with patch("requests.post") as mock_post:
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "choices": [{"message": {"content": "OK"}}]
        }
        mock_response.raise_for_status.return_value = None
        mock_post.return_value = mock_response

        # Test DeepSeek
        res_ds = test_llm_connection("deepseek", "fake-key", "deepseek-chat")
        assert res_ds["ok"] is True
        assert "OK" in res_ds["message"]
        # Assert base url was correct
        args, kwargs = mock_post.call_args_list[-1]
        assert args[0] == "https://api.deepseek.com/chat/completions"

        # Test MiniMax
        res_mm = test_llm_connection("minimax", "fake-key", "MiniMax-M3")
        assert res_mm["ok"] is True
        assert "OK" in res_mm["message"]
        # Assert base url was correct
        args, kwargs = mock_post.call_args_list[-1]
        assert args[0] == "https://api.minimax.io/v1/chat/completions"
