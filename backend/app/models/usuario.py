"""Usuario model."""
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


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

    # F3: soft delete
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    tenant_id: Mapped[int | None] = mapped_column(ForeignKey("tenants.id"), nullable=True)

    aluno = relationship("Aluno", back_populates="usuario")
    tenant = relationship("Tenant", back_populates="usuarios")

    __table_args__ = (
        # Partial unique indexes: apenas registros não deletados competem por unicidade.
        # Permite reusar username/email após soft-delete sem bloquear novos cadastros.
        Index(
            "uq_usuario_tenant_username_active",
            "tenant_id", "username",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
        Index(
            "uq_usuario_tenant_email_active",
            "tenant_id", "email",
            unique=True,
            postgresql_where=text("deleted_at IS NULL"),
        ),
    )

    @property
    def is_admin(self) -> bool:
        return self.role in ("admin", "super_admin")

    @is_admin.setter
    def is_admin(self, _value: bool) -> None:
        # `role` is authoritative — use it directly. This setter exists only to avoid
        # AttributeError on legacy code paths; assignments here have no effect.
        import warnings
        warnings.warn(
            "usuario.is_admin setter is a no-op; set usuario.role directly",
            DeprecationWarning,
            stacklevel=2,
        )

    @property
    def tenant_name(self) -> str | None:
        return self.tenant.name if self.tenant else None
