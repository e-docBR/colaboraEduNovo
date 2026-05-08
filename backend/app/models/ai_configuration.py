"""AI Configuration model."""
from sqlalchemy import String, Boolean, ForeignKey, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base

class AIConfiguration(Base):
    __tablename__ = "ai_configurations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, unique=True)
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    provider: Mapped[str] = mapped_column(String(50), default="openai") # openai, anthropic, gemini
    model_name: Mapped[str] = mapped_column(String(100), default="gpt-4o-mini")
    api_key: Mapped[str | None] = mapped_column(String(255), nullable=True)
    system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    tenant = relationship("Tenant")
