from typing import List, Optional, Tuple
from sqlalchemy import select, desc, func
from sqlalchemy.orm import Session, joinedload

from app.models import Ocorrencia
from app.repositories.base import BaseRepository

class OcorrenciaRepository(BaseRepository[Ocorrencia]):
    def __init__(self, session: Session):
        super().__init__(session, Ocorrencia)

    def list_filtered(
        self,
        aluno_id: Optional[int] = None,
        page: int = 1,
        per_page: int = 50,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> Tuple[List[Ocorrencia], int]:
        """Return (items, total) for the given page."""
        from flask import g
        tenant_id = getattr(g, "tenant_id", None)
        academic_year_id = getattr(g, "academic_year_id", None)

        base_query = (
            select(self.model)
            .options(joinedload(self.model.aluno), joinedload(self.model.autor))
            .order_by(desc(self.model.data_registro))
        )
        count_query = select(func.count()).select_from(self.model)

        for q in (base_query, count_query):
            pass  # conditions applied below via variable reassignment

        conditions = []
        if tenant_id:
            conditions.append(self.model.tenant_id == tenant_id)
        if academic_year_id:
            conditions.append(self.model.academic_year_id == academic_year_id)
        if aluno_id:
            conditions.append(self.model.aluno_id == aluno_id)
        if date_from:
            from datetime import datetime
            conditions.append(self.model.data_registro >= datetime.fromisoformat(date_from))
        if date_to:
            from datetime import datetime
            conditions.append(self.model.data_registro <= datetime.fromisoformat(date_to))

        if conditions:
            base_query = base_query.where(*conditions)
            count_query = count_query.where(*conditions)

        total = self.session.execute(count_query).scalar_one()
        offset = (page - 1) * per_page
        items = (
            self.session.execute(base_query.offset(offset).limit(per_page))
            .unique()
            .scalars()
            .all()
        )
        return items, total
