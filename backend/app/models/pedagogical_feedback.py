from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, Text, DateTime, ForeignKey, Index, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base
from .base_mixin import TenantYearMixin


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class PedagogicalFeedback(Base, TenantYearMixin):
    __tablename__ = "pedagogical_feedbacks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Identificação do aluno
    aluno_id: Mapped[int] = mapped_column(
        ForeignKey("alunos.id", ondelete="CASCADE"), nullable=False
    )

    # Diagnóstico geral consolidado
    diagnostico: Mapped[str] = mapped_column(Text, nullable=False)

    # Metas pedagógicas em formato JSON (lista de textos)
    metas: Mapped[list[str]] = mapped_column(JSON, nullable=False)

    # Ações recomendadas em formato JSON (lista de dicts: {title, description, priority, type})
    acoes: Mapped[list[dict]] = mapped_column(JSON, nullable=False)

    # Status: PENDENTE, APROVADO, REJEITADO
    status: Mapped[str] = mapped_column(String(20), default="PENDENTE", nullable=False)

    # Risco global estimado: BAIXO, MEDIO, ALTO
    global_risk: Mapped[Optional[str]] = mapped_column(String(20), default="MEDIO", nullable=True)

    # Indica se o professor realizou edições no plano recomendado
    edited: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Opcional: Feedback ou observações textuais do professor
    feedback_usuario: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Ações finais se editadas (lista de dicts)
    acoes_finais: Mapped[Optional[list[dict]]] = mapped_column(JSON, nullable=True)

    # Data de criação e última atualização
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )

    # Relacionamento com Aluno
    aluno = relationship("Aluno")

    __table_args__ = (
        Index("idx_ped_feedback_tenant_year", "tenant_id", "academic_year_id"),
        Index("idx_ped_feedback_aluno", "aluno_id"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "aluno_id": self.aluno_id,
            "aluno_nome": self.aluno.nome if self.aluno else "Desconhecido",
            "diagnostico": self.diagnostico,
            "global_risk": self.global_risk,
            "metas": self.metas,
            "acoes": self.acoes,
            "status": self.status,
            "edited": self.edited,
            "feedback_usuario": self.feedback_usuario,
            "acoes_finais": self.acoes_finais or self.acoes,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }
