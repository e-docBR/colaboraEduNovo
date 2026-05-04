from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from pydantic import ValidationError

from ...core.database import session_scope
from ...core.roles import STAFF_ROLES, OCORRENCIA_WRITE_ROLES
from ...services.ocorrencia_service import OcorrenciaService
from ...schemas.ocorrencia import OcorrenciaCreate, OcorrenciaUpdate


def _is_staff(roles: list) -> bool:
    return bool(STAFF_ROLES.intersection(roles))


def _can_write_ocorrencia(roles: list) -> bool:
    return bool(OCORRENCIA_WRITE_ROLES.intersection(roles))


def register(parent: Blueprint) -> None:
    bp = Blueprint("ocorrencias", __name__)

    @bp.get("/ocorrencias")
    @jwt_required()
    def list_ocorrencias():
        req_aluno_id = request.args.get("aluno_id")
        date_from = request.args.get("date_from")
        date_to = request.args.get("date_to")
        claims = get_jwt()
        roles = claims.get("roles", [])
        user_aluno_id = claims.get("aluno_id")
        user_id = int(get_jwt_identity())

        try:
            page = max(1, int(request.args.get("page", 1)))
            per_page = min(100, int(request.args.get("per_page", 50)))
        except (ValueError, TypeError):
            page, per_page = 1, 50

        with session_scope() as session:
            service = OcorrenciaService(session, user_id)

            target_aluno_id = None
            if not _is_staff(roles):
                if not user_aluno_id:
                    return jsonify({"items": [], "meta": {"page": 1, "per_page": per_page, "total": 0}}), 200
                try:
                    target_aluno_id = int(user_aluno_id)
                except (ValueError, TypeError):
                    return jsonify({"error": "aluno_id inválido no token"}), 400
            else:
                if req_aluno_id:
                    try:
                        target_aluno_id = int(req_aluno_id)
                    except (ValueError, TypeError):
                        return jsonify({"error": "aluno_id inválido"}), 400

            result = service.list_ocorrencias(aluno_id=target_aluno_id, page=page, per_page=per_page, date_from=date_from, date_to=date_to)
            return jsonify({
                "items": [r.model_dump() for r in result["items"]],
                "meta": result["meta"],
            })

    @bp.post("/ocorrencias")
    @jwt_required()
    def create_ocorrencia():
        claims = get_jwt()
        roles = claims.get("roles", [])
        if not _can_write_ocorrencia(roles):
            return jsonify({"error": "Acesso negado"}), 403

        data = request.json or {}
        user_id = int(get_jwt_identity())

        try:
            schema = OcorrenciaCreate(**data)
        except ValidationError as e:
            return jsonify(e.errors()), 400

        with session_scope() as session:
            service = OcorrenciaService(session, user_id)
            try:
                service.create(schema)
                return jsonify({"message": "Ocorrência registrada!"}), 201
            except ValueError as e:
                return jsonify({"error": str(e)}), 400
            except Exception:
                from loguru import logger as _log
                _log.exception("Erro ao criar ocorrência")
                return jsonify({"error": "Erro interno ao registrar ocorrência"}), 500

    @bp.patch("/ocorrencias/<int:ocorrencia_id>")
    @jwt_required()
    def update_ocorrencia(ocorrencia_id: int):
        claims = get_jwt()
        roles = claims.get("roles", [])
        if not _can_write_ocorrencia(roles):
            return jsonify({"error": "Acesso negado"}), 403

        data = request.json or {}
        user_id = int(get_jwt_identity())

        try:
            schema = OcorrenciaUpdate(**data)
        except ValidationError as e:
            return jsonify(e.errors()), 400

        with session_scope() as session:
            service = OcorrenciaService(session, user_id)
            updated = service.update(ocorrencia_id, schema)

            if not updated:
                return jsonify({"error": "Ocorrência não encontrada"}), 404

            return jsonify({"message": "Atualizado com sucesso"}), 200

    @bp.delete("/ocorrencias/<int:ocorrencia_id>")
    @jwt_required()
    def delete_ocorrencia(ocorrencia_id: int):
        claims = get_jwt()
        roles = claims.get("roles", [])
        if not _can_write_ocorrencia(roles):
            return jsonify({"error": "Acesso negado"}), 403

        user_id = int(get_jwt_identity())

        with session_scope() as session:
            service = OcorrenciaService(session, user_id)
            success = service.delete(ocorrencia_id)

            if not success:
                return jsonify({"error": "Ocorrência não encontrada"}), 404

        return jsonify({"message": "Removido com sucesso"}), 200

    @bp.post("/ocorrencias/<int:ocorrencia_id>/notificar")
    @jwt_required()
    def renotificar_ocorrencia(ocorrencia_id: int):
        from ...core.roles import MANAGER_ROLES
        claims = get_jwt()
        roles = claims.get("roles", [])
        if not MANAGER_ROLES.intersection(roles):
            return jsonify({"error": "Acesso negado"}), 403

        user_id = int(get_jwt_identity())

        with session_scope() as session:
            service = OcorrenciaService(session, user_id)
            success = service.renotificar(ocorrencia_id)
            if not success:
                return jsonify({"error": "Ocorrência não encontrada"}), 404
            return jsonify({"message": "Notificação reenviada", "status": "Pendente"}), 200

    parent.register_blueprint(bp)
