from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, SmallInteger, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


class AcademicYear(Base):
    __tablename__ = "academic_years"
    __table_args__ = (
        UniqueConstraint("tenant_id", "label", name="uq_academic_year_tenant_label"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False, index=True)

    label: Mapped[str] = mapped_column(String(32), nullable=False)  # e.g. "2024", "2025"
    is_current: Mapped[bool] = mapped_column(Boolean, default=True)

    # Encerramento: "open" | "closed"
    status: Mapped[str] = mapped_column(String(16), default="open", nullable=False)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Trimestre ativo: 1 | 2 | 3  — controla thresholds e KPIs em todo o sistema
    trimestre_atual: Mapped[int] = mapped_column(SmallInteger, default=1, nullable=False)

    tenant = relationship("Tenant", back_populates="academic_years")

    @property
    def is_closed(self) -> bool:
        return self.status == "closed"
