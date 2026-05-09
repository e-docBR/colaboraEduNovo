from sqlalchemy import Column, Index, Integer, String, DateTime, ForeignKey, JSON, func
from sqlalchemy.orm import relationship

from ..core.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(50), nullable=False)
    target_type = Column(String(50), nullable=False)
    target_id = Column(String(50), nullable=True)
    details = Column(JSON, nullable=True)
    # server_default garante timezone consistente independente do app server
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        # Índice composto para queries de auditoria por tenant+período (frequentes)
        Index("idx_audit_tenant_ts", "tenant_id", "timestamp"),
    )

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
