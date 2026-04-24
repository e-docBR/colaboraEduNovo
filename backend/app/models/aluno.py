from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import String, UniqueConstraint, Index, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base
from .base_mixin import TenantYearMixin


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Aluno(Base, TenantYearMixin):
    __tablename__ = "alunos"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # A2: unique per tenant+year, not globally — schools reuse matricula sequences
    matricula: Mapped[str] = mapped_column(String(32), nullable=False)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    turma: Mapped[str] = mapped_column(String(32), nullable=False)
    turno: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    # Personal Data from Matrícula Inicial
    sexo: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    data_nascimento: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    naturalidade: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    zona: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    endereco: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    filiacao: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    telefones: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    cpf: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    nis: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    inep: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    situacao_anterior: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Contato do responsável (usado para notificações de ocorrências)
    email_responsavel: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    telefone_responsavel: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # M3: audit timestamps
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    notas = relationship("Nota", back_populates="aluno", cascade="all, delete-orphan")
    usuario = relationship("Usuario", back_populates="aluno", uselist=False)

    __table_args__ = (
        # A2: matricula unique per tenant+year
        UniqueConstraint("tenant_id", "academic_year_id", "matricula", name="uq_aluno_tenant_year_matricula"),
        # M1: composite indexes for ORM tenant/year filters
        Index("idx_aluno_tenant_year", "tenant_id", "academic_year_id"),
        Index("idx_aluno_tenant_year_turma", "tenant_id", "academic_year_id", "turma"),
    )

