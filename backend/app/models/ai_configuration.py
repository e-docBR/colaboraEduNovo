"""AI Configuration model — configuração do LLM por tenant."""
from sqlalchemy import String, Boolean, Float, ForeignKey, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


class AIConfiguration(Base):
    __tablename__ = "ai_configurations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, unique=True)

    # Ativa/desativa o LLM para este tenant
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)

    # Provider: openai | anthropic | openrouter | gemini
    provider: Mapped[str] = mapped_column(String(50), default="openai")

    # Nome do modelo (ex: gpt-4o-mini, claude-3-haiku, google/gemma-3-27b-it)
    model_name: Mapped[str] = mapped_column(String(100), default="gpt-4o-mini")

    # Chave de API do provider
    api_key: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # Temperatura (criatividade): 0.0 = determinístico, 1.0 = criativo
    temperature: Mapped[float] = mapped_column(Float, default=0.4)

    # Nome personalizado do assistente de IA (herda nome da instituição se vazio)
    ai_name: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Prompt de sistema extra (instruções adicionais para o LLM)
    system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    tenant = relationship("Tenant")

    def display_name(self, tenant_name: str = "ColaboraEdu") -> str:
        """Retorna o nome do assistente: configurado > baseado no tenant > padrão."""
        if self.ai_name and self.ai_name.strip():
            return self.ai_name.strip()
        # Extrai a primeira palavra significativa do nome do tenant
        first_word = tenant_name.split()[0] if tenant_name else "ColaboraEdu"
        return f"AI {first_word}"
