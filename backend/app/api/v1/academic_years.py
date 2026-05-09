from flask import Blueprint, jsonify, g
from flask_jwt_extended import jwt_required
from app.core.database import session_scope
from app.models.academic_year import AcademicYear
from app.core.middleware import tenant_required

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
            
            return jsonify([
                {
                    "id": y.id,
                    "label": y.label,
                    "is_current": y.is_current
                } for y in years
            ])

    parent.register_blueprint(bp)
