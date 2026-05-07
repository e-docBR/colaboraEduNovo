from datetime import datetime
from sqlalchemy import Index, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base
from .base_mixin import TenantYearMixin

class Comunicado(Base, TenantYearMixin):
    __tablename__ = "comunicados"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    titulo: Mapped[str] = mapped_column(String(200), nullable=False)
    conteudo: Mapped[str] = mapped_column(Text, nullable=False)
    data_envio: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), default=func.now()
    )
    
    autor_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    autor = relationship("Usuario")

    # Target: "TODOS", "TURMA", "ALUNO"
    target_type = mapped_column(String(50), nullable=False, default="TODOS") 
    target_value = mapped_column(String(100), nullable=True)
    
    arquivado: Mapped[bool] = mapped_column(default=False)

    __table_args__ = (
        # Índice composto para queries de comunicados por destinatário (frequentes em /comunicados)
        Index("idx_comunicado_target", "tenant_id", "target_type", "target_value"),
    )

    def to_dict(self):
        data = {
            "id": self.id,
            "titulo": self.titulo,
            "conteudo": self.conteudo,
            "data_envio": self.data_envio.isoformat(),
            "autor": self.autor.username if self.autor_id and self.autor else "Sistema",
            "target_type": self.target_type,
            "target_value": self.target_value,
            "target": f"{self.target_type} {self.target_value or ''}".strip(),
            "arquivado": self.arquivado
        }
        return data
