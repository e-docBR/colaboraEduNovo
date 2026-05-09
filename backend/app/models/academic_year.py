from sqlalchemy import String, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base

class AcademicYear(Base):
    __tablename__ = "academic_years"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False, index=True)
    
    label: Mapped[str] = mapped_column(String(32), nullable=False) # e.g. "2024", "2025"
    is_current: Mapped[bool] = mapped_column(Boolean, default=True)

    tenant = relationship("Tenant", back_populates="academic_years")
