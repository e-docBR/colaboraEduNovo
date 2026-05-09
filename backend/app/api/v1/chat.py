"""Endpoint de chat com o assistente de IA educacional.

Acesso restrito: admin, super_admin, diretor, coordenador, orientador.
Professores não têm acesso — somente gestores pedagógicos.
"""
from flask import Blueprint, g, jsonify, request
from flask_jwt_extended import jwt_required
from loguru import logger

from ...core.decorators import require_roles
from ...services import process_chat_message

# Roles com acesso ao assistente de IA
AI_CHAT_ROLES = ("admin", "super_admin", "diretor", "coordenador", "orientador")


def register(parent: Blueprint) -> None:
    bp = Blueprint("chat", __name__)

    @bp.post("/chat")
    @jwt_required()
    @require_roles(*AI_CHAT_ROLES)
    def chat():
        data = request.json or {}
        message = (data.get("message") or "").strip()
        if not message:
            return jsonify({"error": "Mensagem vazia"}), 400

        tenant_id = getattr(g, "tenant_id", None)
        if not tenant_id:
            return jsonify({"error": "Tenant não identificado"}), 403

        try:
            response_data = process_chat_message(message, tenant_id)
        except Exception as exc:
            logger.error("Chat query failed for tenant {}: {}", tenant_id, exc)
            return jsonify({
                "text": "Ocorreu um erro ao processar sua pergunta. Tente novamente.",
                "type": "text",
                "data": None,
                "chart_config": None,
                "ai_name": "Assistente IA",
            }), 200

        return jsonify(response_data)

    parent.register_blueprint(bp)
