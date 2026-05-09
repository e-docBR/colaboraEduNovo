from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship, declared_attr

class TenantYearMixin:
    """Mixin to add tenant_id and academic_year_id to models for isolation."""
    
    @declared_attr
    def tenant_id(cls) -> Mapped[int]:
        return mapped_column(ForeignKey("tenants.id", ondelete="RESTRICT"), nullable=False, index=True)

    @declared_attr
    def academic_year_id(cls) -> Mapped[int]:
        return mapped_column(ForeignKey("academic_years.id", ondelete="RESTRICT"), nullable=False, index=True)

    @declared_attr
    def tenant(cls):
        return relationship("Tenant")

    @declared_attr
    def academic_year(cls):
        return relationship("AcademicYear")
