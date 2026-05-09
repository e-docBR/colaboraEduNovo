from typing import List, Optional
from pydantic import BaseModel

class TurmaSummarySchema(BaseModel):
    turma: str
    turno: str
    total_alunos: int
    media: Optional[float] = None
    faltas_medias: float = 0.0
    slug: str

class TurmaListResponse(BaseModel):
    items: List[TurmaSummarySchema]
    total: int

class NotaSimplificadaSchema(BaseModel):
    disciplina: str
    trimestre1: Optional[float] = None
    trimestre2: Optional[float] = None
    trimestre3: Optional[float] = None
    total: Optional[float] = None
    faltas: int
    situacao: Optional[str] = None

class AlunoTurmaDetailSchema(BaseModel):
    id: int
    nome: str
    matricula: str
    turma: str
    turno: str
    media: Optional[float] = None
    situacao: str
    status: Optional[str] = None
    notas: List[NotaSimplificadaSchema]

class TurmaDetailResponse(BaseModel):
    turma: str
    turno: str
    total: int
    alunos: List[AlunoTurmaDetailSchema]
