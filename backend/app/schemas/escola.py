from typing import Optional
from pydantic import BaseModel, Field, field_validator

class EscolaSettingsSchema(BaseModel):
    cnpj: Optional[str] = Field(default=None)
    endereco: Optional[str] = Field(default=None)
    telefone: Optional[str] = Field(default=None)
    email: Optional[str] = Field(default=None)
    media_aprovacao: float = Field(default=50.0)
    logo_url: Optional[str] = Field(default=None)
    whatsapp_enabled: bool = Field(default=False)
    email_enabled: bool = Field(default=False)
    whatsapp_instance_url: Optional[str] = Field(default=None)
    whatsapp_instance_token: Optional[str] = Field(default=None)

    @field_validator("media_aprovacao")
    @classmethod
    def validate_media_aprovacao(cls, v: float) -> float:
        if v < 0.0 or v > 100.0:
            raise ValueError("Média de aprovação deve estar entre 0.0 e 100.0")
        return v

class EscolaDetailResponse(BaseModel):
    name: str
    slug: str
    settings: EscolaSettingsSchema

class EscolaUpdatePayload(BaseModel):
    name: str
    settings: EscolaSettingsSchema
