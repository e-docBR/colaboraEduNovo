from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import select, desc, func
from sqlalchemy.orm import selectinload

from ...core.database import session_scope
from ...core.decorators import admin_required
from ...core.helpers import parse_pagination
from ...models import AuditLog
from ...models.usuario import Usuario


def register(parent: Blueprint) -> None:
    bp = Blueprint("audit", __name__)

    @bp.get("/audit-logs")
    @jwt_required()
    @admin_required
    def list_logs():
        page, per_page = parse_pagination()
        action_filter = request.args.get("action")
        target_type_filter = request.args.get("target_type")
        user_filter = request.args.get("user")

        from flask import g
        with session_scope() as session:
            stm = select(AuditLog).order_by(desc(AuditLog.timestamp))

            # C3: scope logs to current tenant (super_admin sees all when no tenant set)
            tenant_id = getattr(g, "tenant_id", None)
            if tenant_id:
                stm = stm.where(AuditLog.tenant_id == tenant_id)

            if action_filter:
                escaped = action_filter.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
                stm = stm.where(AuditLog.action.ilike(f"%{escaped}%", escape="\\"))
            if target_type_filter:
                stm = stm.where(AuditLog.target_type == target_type_filter)
            if user_filter:
                escaped_u = user_filter.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
                stm = stm.join(AuditLog.usuario).where(
                    Usuario.username.ilike(f"%{escaped_u}%", escape="\\")
                )

            count_stm = select(func.count()).select_from(stm.subquery())
            total = session.execute(count_stm).scalar() or 0

            stm = stm.options(selectinload(AuditLog.usuario)).offset((page - 1) * per_page).limit(per_page)
            results = session.execute(stm).scalars().all()

            return jsonify({
                "items": [log.to_dict() for log in results],
                "total": total,
                "page": page,
                "per_page": per_page
            })

    parent.register_blueprint(bp)

