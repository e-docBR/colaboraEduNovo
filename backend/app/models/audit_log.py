from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship

from ..core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("usuarios.id"), nullable=True)
    # C3: tenant isolation for audit logs
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    action = Column(String(50), nullable=False)
    target_type = Column(String(50), nullable=False)
    target_id = Column(String(50), nullable=True)
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=_utcnow)

    usuario = relationship("Usuario")

    def to_dict(self):
        return {
            "id": self.id,
            "user": self.usuario.username if self.usuario else "Sistema",
            "action": self.action,
            "target": f"{self.target_type} {self.target_id or ''}".strip(),
            "details": self.details,
            "timestamp": self.timestamp.isoformat()
        }
