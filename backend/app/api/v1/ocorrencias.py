from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from pydantic import ValidationError

from ...core.database import session_scope
from ...services.ocorrencia_service import OcorrenciaService
from ...schemas.ocorrencia import OcorrenciaCreate, OcorrenciaUpdate

_STAFF_ROLES = frozenset(["admin", "professor", "coordenador", "diretor", "orientador"])


def _is_staff(roles: list) -> bool:
    return bool(_STAFF_ROLES.intersection(roles))


def register(parent: Blueprint) -> None:
    bp = Blueprint("ocorrencias", __name__)

    @bp.get("/ocorrencias")
    @jwt_required()
    def list_ocorrencias():
        req_aluno_id = request.args.get("aluno_id")
        claims = get_jwt()
        roles = claims.get("roles", [])
        user_aluno_id = claims.get("aluno_id")
        user_id = int(get_jwt_identity())

        with session_scope() as session:
            service = OcorrenciaService(session, user_id)

            target_aluno_id = None
            if not _is_staff(roles):
                if not user_aluno_id:
                    return jsonify([]), 200
                target_aluno_id = int(user_aluno_id)
            else:
                if req_aluno_id:
                    target_aluno_id = int(req_aluno_id)

            results = service.list_ocorrencias(aluno_id=target_aluno_id)
            return jsonify([r.model_dump() for r in results])

    @bp.post("/ocorrencias")
    @jwt_required()
    def create_ocorrencia():
        claims = get_jwt()
        roles = claims.get("roles", [])
        if not _is_staff(roles):
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
            except Exception as e:
                return jsonify({"error": str(e)}), 500

    @bp.patch("/ocorrencias/<int:ocorrencia_id>")
    @jwt_required()
    def update_ocorrencia(ocorrencia_id: int):
        claims = get_jwt()
        roles = claims.get("roles", [])
        if not _is_staff(roles):
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
        if not _is_staff(roles):
            return jsonify({"error": "Acesso negado"}), 403

        user_id = int(get_jwt_identity())

        with session_scope() as session:
            service = OcorrenciaService(session, user_id)
            success = service.delete(ocorrencia_id)

            if not success:
                return jsonify({"error": "Ocorrência não encontrada"}), 404

        return jsonify({"message": "Removido com sucesso"}), 200

    parent.register_blueprint(bp)
