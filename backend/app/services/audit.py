from sqlalchemy.orm import Session
from ..models.audit_log import AuditLog


def log_action(
    session: Session,
    user_id: int | None,
    action: str,
    target_type: str,
    target_id: str | int | None = None,
    details: dict | None = None,
) -> None:
    """Records an action in the audit log. Does NOT commit the session."""
    from flask import g
    tenant_id = getattr(g, "tenant_id", None)
    log = AuditLog(
        user_id=user_id,
        tenant_id=tenant_id,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id else None,
        details=details,
    )
    session.add(log)
