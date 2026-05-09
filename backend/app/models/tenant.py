"""Tenant model."""
from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, String, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base

class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    domain: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    settings: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # F5: Billing fields
    plano: Mapped[str] = mapped_column(String(32), default="trial", nullable=False)
    plano_ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    plano_expira_em: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    stripe_customer_id: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True)
    stripe_subscription_id: Mapped[Optional[str]] = mapped_column(String(128), unique=True, nullable=True)

    # Relationships
    usuarios = relationship("Usuario", back_populates="tenant")
    alunos = relationship("Aluno", back_populates="tenant")
    academic_years = relationship("AcademicYear", back_populates="tenant", cascade="all, delete-orphan")

