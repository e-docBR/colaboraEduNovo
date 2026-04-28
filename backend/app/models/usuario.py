"""Usuario model."""
from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    # A1: unique per tenant, not globally — avoids username/email collisions across schools
    username: Mapped[str] = mapped_column(String(80), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(32), default="professor")
    # M5: is_admin derived from role — stored for backward compat but kept in sync
    aluno_id: Mapped[int | None] = mapped_column(
        ForeignKey("alunos.id", ondelete="SET NULL"), nullable=True  # A5
    )
    matricula: Mapped[str | None] = mapped_column(String(32), nullable=True)
    photo_url: Mapped[str | None] = mapped_column(String(255), nullable=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    tenant_id: Mapped[int | None] = mapped_column(ForeignKey("tenants.id"), nullable=True)

    aluno = relationship("Aluno", back_populates="usuario")
    tenant = relationship("Tenant", back_populates="usuarios")

    __table_args__ = (
        UniqueConstraint("tenant_id", "username", name="uq_usuario_tenant_username"),
        UniqueConstraint("tenant_id", "email", name="uq_usuario_tenant_email"),
    )

    @property
    def is_admin(self) -> bool:
        return self.role in ("admin", "super_admin")

    @is_admin.setter
    def is_admin(self, value: bool) -> None:
        # Legacy setter kept for API compatibility; role field is authoritative
        pass

    @property
    def tenant_name(self) -> str | None:
        return self.tenant.name if self.tenant else None
