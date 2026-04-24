"""Dashboard analytics endpoints."""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, jwt_required
from sqlalchemy import func

from ...core.database import session_scope
from ...core.cache import cache_response
from ...services import build_dashboard_metrics, build_teacher_dashboard


def register(parent: Blueprint) -> None:
    bp = Blueprint("dashboard", __name__)

    @bp.get("/dashboard/kpis")
    @jwt_required()
    @cache_response(timeout=600, key_prefix="dashboard_kpis")
    def fetch_kpis():
        if "aluno" in (get_jwt().get("roles") or []):
            return jsonify({"error": "Acesso restrito"}), 403
        with session_scope() as session:
            metrics = build_dashboard_metrics(session)
        return metrics.to_dict()

    @bp.get("/dashboard/professor")
    @jwt_required()
    @cache_response(timeout=300, key_prefix="dashboard_professor")
    def fetch_teacher_dashboard():
        query = (request.args.get("q") or "")[:100]  # cap search term length
        turno_raw = request.args.get("turno") or None
        turma_raw = request.args.get("turma") or None
        _VALID_TURNOS = {None, "Matutino", "Vespertino", "Noturno", "Integral"}
        turno = turno_raw if turno_raw in _VALID_TURNOS else None
        turma = (turma_raw or "")[:30] or None  # cap turma length
        with session_scope() as session:
            data = build_teacher_dashboard(session, query or None, turno, turma)
        return data

    parent.register_blueprint(bp)
