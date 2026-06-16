import re
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.core.validators import validate_password_strength, validate_username

# Aceita apenas URLs https:// ou caminhos relativos (/uploads/...) para evitar
# que valores como javascript:... sejam armazenados como photo_url.
_SAFE_URL_RE = re.compile(r'^(https://[^\s"<>]+|/[^\s"<>]*)$')

class AlunoSimpleSchema(BaseModel):
    id: int
    nome: str
    matricula: str
    turma: str
    turno: str
    
    model_config = ConfigDict(from_attributes=True)

class UsuarioSchema(BaseModel):
    id: int
    username: str
    role: Optional[str] = "professor"
    is_admin: bool = False
    aluno_id: Optional[int] = None
    photo_url: Optional[str] = None
    must_change_password: bool = False
    tenant_id: Optional[int] = None
    tenant_name: Optional[str] = None
    aluno: Optional[AlunoSimpleSchema] = None

    model_config = ConfigDict(from_attributes=True)

    @field_validator("photo_url", mode="before")
    @classmethod
    def validate_photo_url(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        if not _SAFE_URL_RE.match(v):
            raise ValueError("photo_url deve ser uma URL https:// ou caminho relativo /uploads/...")
        return v

def _validate_password_strength(v: str) -> str:
    return validate_password_strength(v)


class UsuarioCreate(BaseModel):
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=8)
    role: str = "professor"
    is_admin: bool = False
    aluno_id: Optional[int] = None
    must_change_password: bool = True

    @field_validator("username")
    @classmethod
    def username_format(cls, v: str) -> str:
        return validate_username(v)

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)

class UsuarioUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    is_admin: Optional[bool] = None
    aluno_id: Optional[int] = None
    must_change_password: Optional[bool] = None

class LoginRequest(BaseModel):
    username: str
    password: str
    tenant_slug: Optional[str] = None

class LoginResponse(BaseModel):
    access_token: str
    refresh_token: str
    user: UsuarioSchema

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)

    @field_validator("new_password")
    @classmethod
    def new_password_strength(cls, v: str) -> str:
        return _validate_password_strength(v)
