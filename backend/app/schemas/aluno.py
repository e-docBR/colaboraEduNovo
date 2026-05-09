from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict

class NotaBase(BaseModel):
    disciplina: str
    trimestre1: Optional[float] = None
    trimestre2: Optional[float] = None
    trimestre3: Optional[float] = None
    total: Optional[float] = None
    faltas: Optional[int] = 0
    situacao: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class NotaSchema(NotaBase):
    id: int

class AlunoBase(BaseModel):
    matricula: str
    nome: str
    turma: str
    turno: str
    status: Optional[str] = None
    
    # Personal info
    sexo: Optional[str] = None
    data_nascimento: Optional[str] = None
    naturalidade: Optional[str] = None
    zona: Optional[str] = None
    endereco: Optional[str] = None
    filiacao: Optional[str] = None
    telefones: Optional[str] = None
    cpf: Optional[str] = None
    nis: Optional[str] = None
    inep: Optional[str] = None
    situacao_anterior: Optional[str] = None
    email: Optional[str] = None

    # Contato do responsável — usado para notificações de ocorrências
    email_responsavel: Optional[str] = None
    telefone_responsavel: Optional[str] = None

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
    pass

class AlunoUpdate(BaseModel):
    matricula: Optional[str] = None
    nome: Optional[str] = None
    turma: Optional[str] = None
    turno: Optional[str] = None
    status: Optional[str] = None
    sexo: Optional[str] = None
    data_nascimento: Optional[str] = None
    naturalidade: Optional[str] = None
    zona: Optional[str] = None
    endereco: Optional[str] = None
    filiacao: Optional[str] = None
    telefones: Optional[str] = None
    cpf: Optional[str] = None
    nis: Optional[str] = None
    inep: Optional[str] = None
    situacao_anterior: Optional[str] = None
    email: Optional[str] = None
    email_responsavel: Optional[str] = None
    telefone_responsavel: Optional[str] = None

class AlunoPaginatedResponse(BaseModel):
    items: List[AlunoListSchema]
    meta: PaginationMeta

