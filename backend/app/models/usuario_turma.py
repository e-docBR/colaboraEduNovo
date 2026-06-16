from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..core.database import Base
from .base_mixin import TenantYearMixin

class UsuarioTurma(Base, TenantYearMixin):
    __tablename__ = "usuario_turmas"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)
    turma: Mapped[str] = mapped_column(String(100), nullable=False)

    usuario = relationship("Usuario")

    __table_args__ = (
        UniqueConstraint("tenant_id", "academic_year_id", "usuario_id", "turma", name="uq_usuario_turma"),
    )
