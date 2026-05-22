from datetime import datetime
from typing import List, Optional
import re

from pydantic import BaseModel, ConfigDict, Field, field_validator


_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
_PHONE_RE = re.compile(r"^[0-9\s()+-]{8,30}$")
_CPF_RE = re.compile(r"^\d{11}$")


def _blank_to_none(value: object) -> object:
    if isinstance(value, str):
        stripped = value.strip()
        return stripped or None
    return value


def _validate_email(value: str | None) -> str | None:
    if value is None:
        return value
    if not _EMAIL_RE.fullmatch(value):
        raise ValueError("E-mail inválido")
    return value


def _validate_phone(value: str | None) -> str | None:
    if value is None:
        return value
    if not _PHONE_RE.fullmatch(value):
        raise ValueError("Telefone inválido")
    return value


def _validate_cpf(value: str | None) -> str | None:
    if value is None:
        return value
    digits = re.sub(r"\D", "", value)
    if digits and not _CPF_RE.fullmatch(digits):
        raise ValueError("CPF deve conter 11 dígitos")
    return digits or None

class NotaBase(BaseModel):
    disciplina: str
    trimestre1: Optional[float] = None
    trimestre2: Optional[float] = None
    trimestre3: Optional[float] = None
    total: Optional[float] = None
    recuperacao: Optional[float] = None
    conselho_de_classe: Optional[float] = None
    faltas: Optional[int] = 0
    situacao: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class NotaSchema(NotaBase):
    id: int

class AlunoBase(BaseModel):
    matricula: str = Field(..., max_length=32)
    nome: str = Field(..., max_length=255)
    turma: str = Field(..., max_length=100)
    turno: str = Field(..., max_length=50)
    status: Optional[str] = Field(default=None, max_length=32)
    
    # Personal info
    sexo: Optional[str] = Field(default=None, max_length=10)
    data_nascimento: Optional[str] = Field(default=None, max_length=20)
    naturalidade: Optional[str] = Field(default=None, max_length=100)
    zona: Optional[str] = Field(default=None, max_length=50)
    endereco: Optional[str] = Field(default=None, max_length=500)
    filiacao: Optional[str] = Field(default=None, max_length=500)
    telefones: Optional[str] = Field(default=None, max_length=100)
    cpf: Optional[str] = Field(default=None, max_length=20)
    nis: Optional[str] = Field(default=None, max_length=20)
    inep: Optional[str] = Field(default=None, max_length=32)
    situacao_anterior: Optional[str] = Field(default=None, max_length=100)
    email: Optional[str] = Field(default=None, max_length=255)

    # Contato do responsável — usado para notificações de ocorrências
    email_responsavel: Optional[str] = Field(default=None, max_length=255)
    telefone_responsavel: Optional[str] = Field(default=None, max_length=100)

    model_config = ConfigDict(from_attributes=True)

class AlunoListSchema(AlunoBase):
    id: int
    media: Optional[float] = None
    faltas: Optional[int] = None
    media_faltas: Optional[float] = None
    status: Optional[str] = None
    senha_inicial: Optional[str] = None
    is_archived: bool = False
    deleted_at: Optional[datetime] = None


class AlunoDetailSchema(AlunoBase):
    id: int
    notas: List[NotaSchema] = []
    media: Optional[float] = None

class PaginationMeta(BaseModel):
    page: int
    per_page: int
    total: int
    pages: int

class AlunoCreate(AlunoBase):
    @field_validator("*", mode="before")
    @classmethod
    def strip_blank_strings(cls, value: object) -> object:
        return _blank_to_none(value)

    @field_validator("matricula", "nome", "turma", "turno")
    @classmethod
    def required_text(cls, value: str | None) -> str:
        if not value:
            raise ValueError("Campo obrigatório")
        return value

    @field_validator("email", "email_responsavel")
    @classmethod
    def email_format(cls, value: str | None) -> str | None:
        return _validate_email(value)

    @field_validator("telefones", "telefone_responsavel")
    @classmethod
    def phone_format(cls, value: str | None) -> str | None:
        return _validate_phone(value)

    @field_validator("cpf")
    @classmethod
    def cpf_format(cls, value: str | None) -> str | None:
        return _validate_cpf(value)

class AlunoUpdate(BaseModel):
    matricula: Optional[str] = Field(default=None, max_length=32)
    nome: Optional[str] = Field(default=None, max_length=255)
    turma: Optional[str] = Field(default=None, max_length=100)
    turno: Optional[str] = Field(default=None, max_length=50)
    status: Optional[str] = Field(default=None, max_length=32)
    sexo: Optional[str] = Field(default=None, max_length=10)
    data_nascimento: Optional[str] = Field(default=None, max_length=20)
    naturalidade: Optional[str] = Field(default=None, max_length=100)
    zona: Optional[str] = Field(default=None, max_length=50)
    endereco: Optional[str] = Field(default=None, max_length=500)
    filiacao: Optional[str] = Field(default=None, max_length=500)
    telefones: Optional[str] = Field(default=None, max_length=100)
    cpf: Optional[str] = Field(default=None, max_length=20)
    nis: Optional[str] = Field(default=None, max_length=20)
    inep: Optional[str] = Field(default=None, max_length=32)
    situacao_anterior: Optional[str] = Field(default=None, max_length=100)
    email: Optional[str] = Field(default=None, max_length=255)
    email_responsavel: Optional[str] = Field(default=None, max_length=255)
    telefone_responsavel: Optional[str] = Field(default=None, max_length=100)

    @field_validator("*", mode="before")
    @classmethod
    def strip_blank_strings(cls, value: object) -> object:
        return _blank_to_none(value)

    @field_validator("matricula", "nome", "turma", "turno")
    @classmethod
    def non_empty_when_sent(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("Campo não pode ficar vazio")
        return value

    @field_validator("email", "email_responsavel")
    @classmethod
    def email_format(cls, value: str | None) -> str | None:
        return _validate_email(value)

    @field_validator("telefones", "telefone_responsavel")
    @classmethod
    def phone_format(cls, value: str | None) -> str | None:
        return _validate_phone(value)

    @field_validator("cpf")
    @classmethod
    def cpf_format(cls, value: str | None) -> str | None:
        return _validate_cpf(value)

class AlunoPaginatedResponse(BaseModel):
    items: List[AlunoListSchema]
    meta: PaginationMeta
