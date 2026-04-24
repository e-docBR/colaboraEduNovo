from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class OcorrenciaBase(BaseModel):
    tipo: str
    descricao: str
    observacao_pais: Optional[str] = None
    gravidade: str = "LEVE"
    acao_tomada: Optional[str] = None
    data_registro: Optional[datetime] = None

class OcorrenciaCreate(OcorrenciaBase):
    aluno_id: int
    data_registro: Optional[str] = None # Accepts ISO string from frontend
    notificar_responsaveis: bool = False

class OcorrenciaUpdate(BaseModel):
    tipo: Optional[str] = None
    descricao: Optional[str] = None
    observacao_pais: Optional[str] = None
    gravidade: Optional[str] = None
    acao_tomada: Optional[str] = None
    resolvida: Optional[bool] = None

class OcorrenciaSchema(OcorrenciaBase):
    id: int
    aluno_id: int
    autor_id: int
    resolvida: bool = False

    # Extra fields for display
    aluno_nome: str
    autor_nome: str
    notificacao_status: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
