from datetime import datetime, timezone

from flask import Blueprint, jsonify, g, request
from flask_jwt_extended import jwt_required, get_jwt
from app.core.database import session_scope
from app.models.academic_year import AcademicYear
from app.core.middleware import tenant_required


def _serialize_year(y: AcademicYear) -> dict:
    return {
        "id": y.id,
        "label": y.label,
        "is_current": y.is_current,
        "status": y.status,
        "closed_at": y.closed_at.isoformat() if y.closed_at else None,
        "trimestre_atual": y.trimestre_atual,
    }


def register(parent: Blueprint) -> None:
    bp = Blueprint("academic_years", __name__)

    @bp.route("/academic-years", methods=["GET"])
    @jwt_required()
    @tenant_required()
    def list_academic_years():
        with session_scope() as session:
            years = session.query(AcademicYear).filter(
                AcademicYear.tenant_id == g.tenant_id
            ).order_by(AcademicYear.label.desc()).all()
            return jsonify([_serialize_year(y) for y in years])

    @bp.route("/academic-years/<int:year_id>", methods=["PATCH"])
    @jwt_required()
    @tenant_required()
    def update_academic_year(year_id: int):
        """Permite que admin da escola feche ou reabra um ano letivo."""
        claims = get_jwt()
        roles = claims.get("roles", [])
        if not ({"admin", "super_admin"} & set(roles)):
            return jsonify({"error": "Apenas administradores podem encerrar anos letivos."}), 403

        data = request.get_json() or {}

        with session_scope() as session:
            from app.services.audit import log_action
            year = session.query(AcademicYear).filter(
                AcademicYear.id == year_id,
                AcademicYear.tenant_id == g.tenant_id,
            ).first()
            if not year:
                return jsonify({"error": "Ano letivo não encontrado."}), 404

            user_id_str = claims.get("sub")
            user_id = int(user_id_str) if user_id_str else None

            # Atualiza trimestre_atual
            if "trimestre_atual" in data:
                novo_trim = data["trimestre_atual"]
                if novo_trim not in (1, 2, 3):
                    return jsonify({"error": "trimestre_atual deve ser 1, 2 ou 3"}), 400
                old_trim = year.trimestre_atual
                year.trimestre_atual = novo_trim
                log_action(session, user_id, "update_trimestre", "AcademicYear", year.id,
                           {"label": year.label, "old": old_trim, "new": novo_trim})

            # Atualiza status (encerramento)
            if "status" in data:
                new_status = (data["status"] or "").strip().lower()
                if new_status not in ("open", "closed"):
                    return jsonify({"error": "status deve ser 'open' ou 'closed'"}), 400
                if new_status == "closed" and year.is_current:
                    return jsonify({"error": "Não é possível encerrar o ano letivo atual. "
                                             "Defina outro ano como atual antes de encerrar este."}), 409
                old_status = year.status
                year.status = new_status
                year.closed_at = datetime.now(timezone.utc) if new_status == "closed" else None
                action = "close_year" if new_status == "closed" else "reopen_year"
                log_action(session, user_id, action, "AcademicYear", year.id,
                           {"label": year.label, "old_status": old_status, "new_status": new_status})

            return jsonify(_serialize_year(year))

    parent.register_blueprint(bp)
