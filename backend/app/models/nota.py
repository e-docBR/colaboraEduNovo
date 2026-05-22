"""Nota model."""
from datetime import datetime, timezone
from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base
from .base_mixin import TenantYearMixin


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Nota(Base, TenantYearMixin):
    __tablename__ = "notas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    aluno_id: Mapped[int] = mapped_column(ForeignKey("alunos.id", ondelete="CASCADE"), nullable=False)
    disciplina: Mapped[str] = mapped_column(String(80), nullable=False)
    disciplina_normalizada: Mapped[str] = mapped_column(String(80), nullable=False)
    trimestre1: Mapped[float | None] = mapped_column(Numeric(5, 2))
    trimestre2: Mapped[float | None] = mapped_column(Numeric(5, 2))
    trimestre3: Mapped[float | None] = mapped_column(Numeric(5, 2))
    total: Mapped[float | None] = mapped_column(Numeric(5, 2))
    # Recuperação: prova aplicada quando total < 50, escala 0–100
    recuperacao: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    # Conselho de Classe: nota final aprovada pelo conselho (override), escala 0–100
    conselho_de_classe: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    faltas: Mapped[int] = mapped_column(Integer, default=0)
    # M2: restrict to known values at DB level
    situacao: Mapped[str | None] = mapped_column(String(20))

    # M3: audit timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    aluno = relationship("Aluno", back_populates="notas")

    __table_args__ = (
        # M2: only known situacao values are valid
        # Includes codes used by real Brazilian school bulletins:
        # APR=Aprovado, REP=Reprovado, REC=Recuperação, APCC=Aprovado por Conselho de Classe,
        # AR=Aprovado com Restrição, EMC=Em Curso, EMR=Em Regime de Recuperação,
        # AFC=Aprovado com Frequência Compensada, DPC=Dependência Parcial, TRN=Transferido, ABA=Abandono
        CheckConstraint(
            "situacao IS NULL OR situacao IN ("
            "'APR', 'REP', 'REC', 'APCC', 'AR', "
            "'EMC', 'EMR', 'AFC', 'DPC', 'TRN', 'ABA'"
            ")",
            name="ck_nota_situacao_valid",
        ),
        # M1: composite indexes for ORM tenant/year filters
        Index("idx_nota_tenant_year", "tenant_id", "academic_year_id"),
        Index("idx_nota_aluno", "aluno_id"),
        Index("idx_nota_disciplina_norm", "disciplina_normalizada"),
    )
