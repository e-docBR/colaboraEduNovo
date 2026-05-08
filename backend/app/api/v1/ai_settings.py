"""Endpoints para configuração do assistente de IA por tenant.

Acesso restrito EXCLUSIVAMENTE ao super_admin.
Permite configurar: provider, modelo, api_key, nome, temperatura, prompt extra.
"""
from flask import Blueprint, g, jsonify, request
from flask_jwt_extended import jwt_required
from loguru import logger
from sqlalchemy import select

from ...core.decorators import require_roles
from ...core.database import session_scope
from ...models.ai_configuration import AIConfiguration
from ...models import Tenant
from ...services.llm_provider import test_llm_connection


ALLOWED_PROVIDERS = {"openai", "anthropic", "openrouter", "gemini"}

PROVIDER_MODELS: dict[str, list[dict]] = {
    "openai": [
        {"id": "gpt-4o-mini", "label": "GPT-4o Mini (rápido e econômico)"},
        {"id": "gpt-4o", "label": "GPT-4o (mais capaz)"},
        {"id": "gpt-4-turbo", "label": "GPT-4 Turbo"},
        {"id": "gpt-3.5-turbo", "label": "GPT-3.5 Turbo (mais barato)"},
    ],
    "anthropic": [
        {"id": "claude-3-5-haiku-20241022", "label": "Claude 3.5 Haiku (rápido)"},
        {"id": "claude-3-5-sonnet-20241022", "label": "Claude 3.5 Sonnet (equilibrado)"},
        {"id": "claude-opus-4-5", "label": "Claude Opus (mais capaz)"},
    ],
    "openrouter": [
        {"id": "google/gemma-3-27b-it:free", "label": "Gemma 3 27B (gratuito)"},
        {"id": "meta-llama/llama-3.3-70b-instruct:free", "label": "Llama 3.3 70B (gratuito)"},
        {"id": "mistralai/mistral-7b-instruct:free", "label": "Mistral 7B (gratuito)"},
        {"id": "deepseek/deepseek-r1:free", "label": "DeepSeek R1 (gratuito)"},
        {"id": "openai/gpt-4o-mini", "label": "GPT-4o Mini via OpenRouter"},
        {"id": "anthropic/claude-3-5-haiku", "label": "Claude 3.5 Haiku via OpenRouter"},
        {"id": "google/gemini-flash-1.5", "label": "Gemini 1.5 Flash via OpenRouter"},
    ],
    "gemini": [
        {"id": "gemini-1.5-flash", "label": "Gemini 1.5 Flash (rápido)"},
        {"id": "gemini-1.5-pro", "label": "Gemini 1.5 Pro (mais capaz)"},
        {"id": "gemini-2.0-flash", "label": "Gemini 2.0 Flash"},
    ],
}


def register(parent: Blueprint) -> None:
    bp = Blueprint("ai_settings", __name__)

    @bp.get("/ai-settings")
    @jwt_required()
    @require_roles("super_admin")
    def get_ai_settings():
        """Retorna a configuração atual de IA do tenant."""
        tenant_id = g.tenant_id
        with session_scope() as session:
            cfg = session.execute(
                select(AIConfiguration).where(AIConfiguration.tenant_id == tenant_id)
            ).scalar_one_or_none()

            tenant = session.get(Tenant, tenant_id)
            tenant_name = tenant.name if tenant else "ColaboraEdu"

            if not cfg:
                return jsonify({
                    "configured": False,
                    "is_active": False,
                    "provider": "openai",
                    "model_name": "gpt-4o-mini",
                    "api_key": "",
                    "ai_name": "",
                    "temperature": 0.4,
                    "system_prompt": "",
                    "display_name": f"AI {tenant_name.split()[0]}",
                    "tenant_name": tenant_name,
                    "available_providers": list(ALLOWED_PROVIDERS),
                    "provider_models": PROVIDER_MODELS,
                })

            return jsonify({
                "configured": True,
                "is_active": cfg.is_active,
                "provider": cfg.provider,
                "model_name": cfg.model_name,
                # Nunca expõe a key completa; só indica se existe
                "api_key": "***" if cfg.api_key else "",
                "api_key_set": bool(cfg.api_key),
                "ai_name": cfg.ai_name or "",
                "temperature": cfg.temperature,
                "system_prompt": cfg.system_prompt or "",
                "display_name": cfg.display_name(tenant_name),
                "tenant_name": tenant_name,
                "available_providers": list(ALLOWED_PROVIDERS),
                "provider_models": PROVIDER_MODELS,
            })

    @bp.put("/ai-settings")
    @jwt_required()
    @require_roles("super_admin")
    def update_ai_settings():
        """Cria ou atualiza a configuração de IA do tenant."""
        tenant_id = g.tenant_id
        body = request.json or {}

        provider = body.get("provider", "openai").lower()
        if provider not in ALLOWED_PROVIDERS:
            return jsonify({"error": f"Provider inválido. Use: {', '.join(ALLOWED_PROVIDERS)}"}), 400

        temperature = float(body.get("temperature", 0.4))
        temperature = max(0.0, min(1.0, temperature))

        with session_scope() as session:
            cfg = session.execute(
                select(AIConfiguration).where(AIConfiguration.tenant_id == tenant_id)
            ).scalar_one_or_none()

            if not cfg:
                cfg = AIConfiguration(tenant_id=tenant_id)
                session.add(cfg)

            cfg.is_active = bool(body.get("is_active", False))
            cfg.provider = provider
            cfg.model_name = body.get("model_name", "gpt-4o-mini")
            cfg.temperature = temperature
            cfg.ai_name = body.get("ai_name", "") or None
            cfg.system_prompt = body.get("system_prompt", "") or None

            # Só atualiza a api_key se foi enviada (não começa com ***)
            new_key = body.get("api_key", "")
            if new_key and not new_key.startswith("***"):
                cfg.api_key = new_key.strip()

            logger.info(f"AI config updated for tenant {tenant_id}: provider={provider}, active={cfg.is_active}")

            tenant = session.get(Tenant, tenant_id)
            tenant_name = tenant.name if tenant else "ColaboraEdu"

            return jsonify({
                "message": "Configuração salva com sucesso.",
                "display_name": cfg.display_name(tenant_name),
                "is_active": cfg.is_active,
            })

    @bp.post("/ai-settings/test")
    @jwt_required()
    @require_roles("super_admin")
    def test_ai_settings():
        """Testa a conexão com o LLM configurado."""
        body = request.json or {}
        provider = body.get("provider", "openai").lower()
        api_key = body.get("api_key", "")
        model = body.get("model_name", "gpt-4o-mini")

        if not api_key or api_key.startswith("***"):
            # Tenta usar a key salva no banco
            tenant_id = getattr(g, "tenant_id", None)
            if not tenant_id:
                return jsonify({"ok": False, "message": "Nenhuma API key fornecida."}), 200
            with session_scope() as session:
                cfg = session.execute(
                    select(AIConfiguration).where(AIConfiguration.tenant_id == tenant_id)
                ).scalar_one_or_none()
                if cfg and cfg.api_key:
                    api_key = cfg.api_key
                    provider = cfg.provider
                    model = cfg.model_name
                else:
                    return jsonify({"ok": False, "message": "Nenhuma API key configurada."}), 200

        result = test_llm_connection(provider, api_key, model)
        # Sempre retorna 200 — o campo 'ok' indica sucesso/falha
        # (evita que RTK Query trate como exceção e perca a mensagem)
        return jsonify(result), 200

    @bp.delete("/ai-settings/key")
    @jwt_required()
    @require_roles("super_admin")
    def clear_api_key():
        """Remove a API key salva (desativa o LLM)."""
        tenant_id = g.tenant_id
        with session_scope() as session:
            cfg = session.execute(
                select(AIConfiguration).where(AIConfiguration.tenant_id == tenant_id)
            ).scalar_one_or_none()
            if cfg:
                cfg.api_key = None
                cfg.is_active = False
        return jsonify({"message": "API key removida. IA desativada."})

    @bp.get("/ai-settings/info")
    @jwt_required()
    def get_ai_info():
        """Endpoint público (auth obrigatória) — retorna apenas nome e status do assistente.
        Usado pelo ChatWidget para exibir o nome correto.
        """
        tenant_id = g.tenant_id
        with session_scope() as session:
            cfg = session.execute(
                select(AIConfiguration).where(AIConfiguration.tenant_id == tenant_id)
            ).scalar_one_or_none()
            tenant = session.get(Tenant, tenant_id)
            tenant_name = tenant.name if tenant else "ColaboraEdu"

            if cfg:
                display = cfg.display_name(tenant_name)
                active = cfg.is_active and bool(cfg.api_key)
            else:
                display = f"AI {tenant_name.split()[0]}"
                active = False

            return jsonify({
                "ai_name": display,
                "llm_active": active,
                "tenant_name": tenant_name,
            })

    parent.register_blueprint(bp)
