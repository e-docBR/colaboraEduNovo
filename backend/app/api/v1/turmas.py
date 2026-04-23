"""Turmas endpoints."""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, jwt_required
from urllib.parse import unquote

from ...core.database import session_scope
from ...core.decorators import require_roles
from ...services.turma_service import TurmaService


def register(parent: Blueprint) -> None:
    bp = Blueprint("turmas", __name__)

    @bp.get("/turmas")
    @jwt_required()
    @require_roles("admin", "super_admin", "coordenador", "diretor", "orientador", "professor")
    def list_turmas():
            
        with session_scope() as session:
            service = TurmaService(session)
            result = service.list_turmas()
            return jsonify(result.model_dump())

    @bp.get("/turmas/<path:turma_nome>/alunos")
    @jwt_required()
    @require_roles("admin", "super_admin", "coordenador", "diretor", "orientador", "professor")
    def list_alunos_por_turma(turma_nome: str):
            
        turma_decoded = unquote(turma_nome)
        
        with session_scope() as session:
            service = TurmaService(session)
            result = service.get_turma_detail(turma_decoded)
            
            if not result:
                # Return empty structure as per original contract if not found/empty
                return jsonify({"turma": turma_decoded, "alunos": [], "total": 0}), 200

            return jsonify(result.model_dump())

    @bp.patch("/turmas/<path:turma_slug>")
    @jwt_required()
    @require_roles("admin", "super_admin", "coordenador", "diretor")
    def rename_turma(turma_slug: str):
        slug_decoded = unquote(turma_slug)
        data = request.get_json() or {}
        new_nome = data.get("nome", "").strip()
        new_turno = data.get("turno", "").strip() or None

        if not new_nome:
            return jsonify({"error": "Nome da turma é obrigatório"}), 400

        with session_scope() as session:
            service = TurmaService(session)
            count = service.rename_turma(slug_decoded, new_nome, new_turno)
            if count is None:
                return jsonify({"error": "Turma não encontrada"}), 404
            from ...core.cache import invalidate_tenant_cache
            invalidate_tenant_cache()
            return jsonify({"updated": count, "turma": new_nome})

    @bp.delete("/turmas/<path:turma_slug>")
    @jwt_required()
    @require_roles("admin", "super_admin", "diretor")
    def delete_turma(turma_slug: str):
        slug_decoded = unquote(turma_slug)

        with session_scope() as session:
            service = TurmaService(session)
            count = service.delete_turma(slug_decoded)
            if count is None:
                return jsonify({"error": "Turma não encontrada"}), 404
            from ...core.cache import invalidate_tenant_cache
            invalidate_tenant_cache()
            return jsonify({"deleted": count})

    parent.register_blueprint(bp)
