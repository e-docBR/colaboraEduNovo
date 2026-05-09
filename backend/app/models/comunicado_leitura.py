from datetime import datetime, timezone
from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class ComunicadoLeitura(Base):
    __tablename__ = "comunicados_leituras"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    comunicado_id: Mapped[int] = mapped_column(ForeignKey("comunicados.id", ondelete="CASCADE"), nullable=False)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False)

    data_leitura: Mapped[datetime] = mapped_column(default=_utcnow)

    __table_args__ = (
        UniqueConstraint("comunicado_id", "usuario_id", name="uq_comunicado_usuario_leitura"),
    )
