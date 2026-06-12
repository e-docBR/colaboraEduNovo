from typing import List, Tuple, Optional
from sqlalchemy import func, distinct, and_
from sqlalchemy.orm import Session

from app.models import Aluno, Nota
from app.repositories.base import BaseRepository

class TurmaRepository(BaseRepository[Aluno]):
    """
    Turma is not a model, but an aggregation of Alunos.
    We inherit from BaseRepository[Aluno] but methods are specific.
    """
    def __init__(self, session: Session):
        super().__init__(session, Aluno)

    def get_summaries(self) -> List[Tuple[str, str, int, float, float]]:
        from flask import g
        from loguru import logger
        
        tenant_id = getattr(g, "tenant_id", None)
        academic_year_id = getattr(g, "academic_year_id", None)

        logger.info(f"get_summaries V2 EXPLICIT JOIN tenant={tenant_id} year={academic_year_id}")

        query = (
            self.session.query(
                Aluno.turma,
                func.max(Aluno.turno).label("turno"),
                func.count(distinct(Aluno.id)).label("total_alunos"),
                func.avg(Nota.total).label("media"),
                func.avg(Nota.faltas).label("faltas_medias"),
            )
            .select_from(Aluno)
            .outerjoin(
                Nota, 
                and_(
                    Aluno.id == Nota.aluno_id,
                    Nota.tenant_id == tenant_id,
                    Nota.academic_year_id == academic_year_id
                )
            )
            .execution_options(include_all_tenants=True)
        )

        if tenant_id:
            query = query.filter(Aluno.tenant_id == tenant_id)
        if academic_year_id:
            query = query.filter(Aluno.academic_year_id == academic_year_id)

        query = query.group_by(Aluno.turma).order_by(Aluno.turma)
        
        results = query.all()
        logger.info(f"get_summaries V2 found {len(results)} turmas")
        return results

    def get_real_name(self, name_or_slug: str, slugify_func) -> Optional[str]:
        from flask import g
        tenant_id = getattr(g, "tenant_id", None)
        # academic_year_id is less critical for the name itself, but good to have.
        
        # Direct match
        query = self.session.query(Aluno.turma).filter(func.lower(Aluno.turma) == name_or_slug.lower())
        if tenant_id:
             query = query.filter(Aluno.tenant_id == tenant_id)
        
        row = query.first()
        direct_match = row[0] if row else None
        if direct_match:
            return direct_match

        # Slug match
        query_distinct = self.session.query(Aluno.turma).distinct()
        if tenant_id:
             query_distinct = query_distinct.filter(Aluno.tenant_id == tenant_id)
             
        turmas = query_distinct.all()
        for (turma,) in turmas:
            if slugify_func(turma) == slugify_func(name_or_slug):
                return turma
        return None

    def get_alunos_by_turma(self, turma_nome: str) -> List[Aluno]:
        from flask import g
        tenant_id = getattr(g, "tenant_id", None)
        academic_year_id = getattr(g, "academic_year_id", None)
        
        query = self.session.query(Aluno).filter(Aluno.turma == turma_nome)
        if tenant_id:
            query = query.filter(Aluno.tenant_id == tenant_id)
        if academic_year_id:
            query = query.filter(Aluno.academic_year_id == academic_year_id)
            
        return query.order_by(Aluno.nome).all()

    def get_notas_for_alunos(self, aluno_ids: List[int]) -> List[Nota]:
        return (
            self.session.query(Nota)
            .filter(Nota.aluno_id.in_(aluno_ids))
            .order_by(Nota.aluno_id, Nota.disciplina)
            .all()
        )

    def rename_turma(self, old_name: str, new_name: str, new_turno: Optional[str] = None) -> int:
        from flask import g
        tenant_id = getattr(g, "tenant_id", None)
        academic_year_id = getattr(g, "academic_year_id", None)

        query = self.session.query(Aluno).filter(Aluno.turma == old_name)
        if tenant_id:
            query = query.filter(Aluno.tenant_id == tenant_id)
        if academic_year_id:
            query = query.filter(Aluno.academic_year_id == academic_year_id)

        alunos = query.all()
        for aluno in alunos:
            aluno.turma = new_name
            if new_turno:
                aluno.turno = new_turno
        self.session.flush()
        return len(alunos)

    def delete_turma(self, turma_nome: str) -> int:
        from datetime import datetime, timezone
        from flask import g
        from app.models.usuario import Usuario

        tenant_id = getattr(g, "tenant_id", None)
        academic_year_id = getattr(g, "academic_year_id", None)

        alunos = self.get_alunos_by_turma(turma_nome)
        aluno_ids = [a.id for a in alunos]

        if aluno_ids:
            # Soft-delete user accounts linked to these students
            now = datetime.now(timezone.utc)
            self.session.query(Usuario).filter(
                Usuario.aluno_id.in_(aluno_ids)
            ).update({"deleted_at": now, "is_active": False}, synchronize_session=False)

            # Delete grades then students
            self.session.query(Nota).filter(Nota.aluno_id.in_(aluno_ids)).delete(synchronize_session=False)
            query = self.session.query(Aluno).filter(Aluno.turma == turma_nome)
            if tenant_id:
                query = query.filter(Aluno.tenant_id == tenant_id)
            if academic_year_id:
                query = query.filter(Aluno.academic_year_id == academic_year_id)
            query.delete(synchronize_session=False)
            self.session.flush()

        return len(aluno_ids)
