"""Dashboard analytics endpoints."""
from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from ...core.database import session_scope
from ...core.cache import cache_response
from ...core.decorators import require_roles
from ...services import build_dashboard_metrics, build_teacher_dashboard


def register(parent: Blueprint) -> None:
    bp = Blueprint("dashboard", __name__)

    @bp.get("/dashboard/kpis")
    @jwt_required()
    @require_roles("admin", "super_admin", "coordenador", "diretor", "orientador", "professor")
    @cache_response(timeout=600, key_prefix="dashboard_kpis")
    def fetch_kpis():
        with session_scope() as session:
            metrics = build_dashboard_metrics(session)
        return metrics.to_dict()

    @bp.get("/dashboard/professor")
    @jwt_required()
    @require_roles("admin", "super_admin", "coordenador", "diretor", "orientador", "professor")
    @cache_response(timeout=300, key_prefix="dashboard_professor")
    def fetch_teacher_dashboard():
        from flask_jwt_extended import get_jwt_identity, get_jwt
        user_id = int(get_jwt_identity())
        claims = get_jwt()
        roles = claims.get("roles") or []
        is_professor = "professor" in roles

        query = (request.args.get("q") or "")[:100]  # cap search term length
        turno_raw = request.args.get("turno") or None
        turma_raw = request.args.get("turma") or None
        _VALID_TURNOS = {None, "Matutino", "Vespertino", "Noturno", "Integral"}
        turno = turno_raw if turno_raw in _VALID_TURNOS else None
        turma = (turma_raw or "")[:30] or None  # cap turma length
        with session_scope() as session:
            data = build_teacher_dashboard(
                session,
                query or None,
                turno,
                turma,
                user_id=user_id,
                is_professor=is_professor
            )
        return data

    parent.register_blueprint(bp)
