from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from loguru import logger

from ...services import process_chat_message

def register(parent: Blueprint) -> None:
    bp = Blueprint("chat", __name__)

    @bp.post("/chat")
    @jwt_required()
    def chat():
        data = request.json or {}
        message = data.get("message", "")
        if not message:
            return jsonify({"error": "Mensagem vazia"}), 400

        try:
            response_data = process_chat_message(message)
        except Exception as exc:
            logger.error("Chat query failed: {}", exc)
            return jsonify({
                "text": "Ocorreu um erro ao processar sua pergunta. Tente novamente.",
                "type": "text",
                "data": None,
                "chart_config": None,
            }), 200

        return jsonify(response_data)

    parent.register_blueprint(bp)
