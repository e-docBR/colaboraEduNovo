from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Boolean, Index, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base
from .base_mixin import TenantYearMixin


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)

class Ocorrencia(Base, TenantYearMixin):
    __tablename__ = "ocorrencias"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    
    tipo: Mapped[str] = mapped_column(String(50), nullable=False) # Advertência, Elogio, etc
    descricao: Mapped[str] = mapped_column(Text, nullable=False)
    observacao_pais: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    gravidade: Mapped[str] = mapped_column(String(20), default="LEVE") # LEVE, MEDIA, GRAVE, GRAVISSIMA
    acao_tomada: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    data_registro: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    
    # A5: cascade delete when aluno is removed; set NULL when author is removed
    aluno_id: Mapped[int] = mapped_column(ForeignKey("alunos.id", ondelete="CASCADE"), nullable=False)
    autor_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    
    resolvida: Mapped[bool] = mapped_column(Boolean, default=False)

    # Status de envio de notificação (Pendente, Enviado, Erro)
    notificacao_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    aluno = relationship("Aluno")
    autor = relationship("Usuario")

    __table_args__ = (
        # M1: composite indexes for ORM tenant/year filters
        Index("idx_ocorrencia_tenant_year", "tenant_id", "academic_year_id"),
        Index("idx_ocorrencia_aluno", "aluno_id"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "aluno_nome": self.aluno.nome if self.aluno else "Desconhecido",
            "aluno_id": self.aluno_id,
            "autor_nome": self.autor.username if self.autor else "Sistema",
            "tipo": self.tipo,
            "descricao": self.descricao,
            "observacao_pais": self.observacao_pais,
            "gravidade": self.gravidade,
            "acao_tomada": self.acao_tomada,
            "resolvida": self.resolvida,
            "data_registro": self.data_registro.isoformat(),
            "notificacao_status": self.notificacao_status,
        }
