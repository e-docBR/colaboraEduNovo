"""Endpoint de chat com o assistente de IA educacional.

Acesso restrito: admin, super_admin, diretor, coordenador, orientador.
Professores não têm acesso — somente gestores pedagógicos.
"""
import json

from flask import Blueprint, Response, g, jsonify, request, stream_with_context
from flask_jwt_extended import get_jwt_identity, jwt_required
from loguru import logger

from ...core.decorators import require_roles
from ...core.extensions import limiter
from ...services import process_chat_message, stream_chat_message

# Roles com acesso ao assistente de IA
AI_CHAT_ROLES = ("admin", "super_admin", "diretor", "coordenador", "orientador")


def _chat_rate_key() -> str:
    """Rate limit key por tenant+usuário — impede que um tenant consuma o limite de outro."""
    tenant_id = getattr(g, "tenant_id", "unknown")
    user_id = get_jwt_identity() or "unknown"
    return f"chat:{tenant_id}:{user_id}"


def register(parent: Blueprint) -> None:
    bp = Blueprint("chat", __name__)

    @bp.post("/chat")
    @jwt_required()
    @limiter.limit("30 per hour", key_func=_chat_rate_key)
    @require_roles(*AI_CHAT_ROLES)
    def chat():
        data = request.json or {}
        message = (data.get("message") or "").strip()
        if not message:
            return jsonify({"error": "Mensagem vazia"}), 400

        tenant_id = getattr(g, "tenant_id", None)
        if not tenant_id:
            return jsonify({"error": "Tenant não identificado"}), 403

        # Histórico de conversa enviado pelo frontend (máx. 6 turnos aceitos)
        raw_history = data.get("history") or []
        history = [
            {"role": t["role"], "content": t["content"]}
            for t in raw_history
            if isinstance(t, dict) and t.get("role") in ("user", "assistant") and t.get("content")
        ][:12]  # 6 pares user/assistant

        # Contexto da página atual enviado pelo frontend (B.2)
        raw_ctx = data.get("page_context")
        page_context: dict | None = None
        if isinstance(raw_ctx, dict) and raw_ctx.get("type") in ("aluno", "turma") and raw_ctx.get("id"):
            page_context = {"type": raw_ctx["type"], "id": str(raw_ctx["id"])[:64]}

        try:
            response_data = process_chat_message(message, tenant_id, history=history or None, page_context=page_context)
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

    @bp.post("/chat/stream")
    @jwt_required()
    @limiter.limit("30 per hour", key_func=_chat_rate_key)
    @require_roles(*AI_CHAT_ROLES)
    def chat_stream():
        data = request.json or {}
        message = (data.get("message") or "").strip()
        if not message:
            return jsonify({"error": "Mensagem vazia"}), 400

        tenant_id = getattr(g, "tenant_id", None)
        if not tenant_id:
            return jsonify({"error": "Tenant não identificado"}), 403

        raw_history = data.get("history") or []
        history = [
            {"role": t["role"], "content": t["content"]}
            for t in raw_history
            if isinstance(t, dict) and t.get("role") in ("user", "assistant") and t.get("content")
        ][:12]

        raw_ctx = data.get("page_context")
        page_context: dict | None = None
        if isinstance(raw_ctx, dict) and raw_ctx.get("type") in ("aluno", "turma") and raw_ctx.get("id"):
            page_context = {"type": raw_ctx["type"], "id": str(raw_ctx["id"])[:64]}

        @stream_with_context
        def generate():
            try:
                for event in stream_chat_message(message, tenant_id, history=history or None, page_context=page_context):
                    yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
            except Exception as exc:
                logger.error("Chat stream failed for tenant {}: {}", tenant_id, exc)
                yield f"data: {json.dumps({'type': 'error', 'message': 'Ocorreu um erro ao processar sua pergunta.'})}\n\n"
            finally:
                yield 'data: {"type": "done"}\n\n'

        return Response(
            generate(),
            mimetype="text/event-stream",
            headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    parent.register_blueprint(bp)
