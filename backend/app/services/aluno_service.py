from typing import Optional
from sqlalchemy.orm import Session
from math import ceil

from app.repositories.aluno_repository import AlunoRepository
from app.services.audit import log_action
from app.schemas.aluno import (
    AlunoPaginatedResponse, 
    AlunoListSchema, 
    PaginationMeta,
    AlunoDetailSchema,
    NotaSchema
)

class AlunoService:
    def __init__(self, session: Session, user_id: Optional[int] = None):
        self.repository = AlunoRepository(session)
        self.user_id = user_id

    def list_alunos(
        self,
        page: int,
        per_page: int,
        turno: Optional[str] = None,
        turma: Optional[str] = None,
        query_text: Optional[str] = None,
        include_archived: bool = False,
    ) -> AlunoPaginatedResponse:

        results, total = self.repository.get_paginated_with_average(
            page=page,
            per_page=per_page,
            turno=turno,
            turma=turma,
            query_text=query_text,
            include_archived=include_archived,
        )

        from app.services.analytics import get_grading_stage
        tenant_id = None
        academic_year_id = None
        try:
            from flask import g
            tenant_id = getattr(g, "tenant_id", None)
            academic_year_id = getattr(g, "academic_year_id", None)
        except Exception:
            pass

        try:
            stage = get_grading_stage(self.repository.session, tenant_id, academic_year_id)
            max_pts = stage["max_pts"]
        except Exception:
            max_pts = 30

        items = []
        for aluno, media, faltas, media_faltas in results:
            items.append(
                AlunoListSchema(
                    id=aluno.id,
                    matricula=aluno.matricula,
                    nome=aluno.nome,
                    turma=aluno.turma,
                    turno=aluno.turno,
                    status=aluno.status,
                    media=float(media) if media is not None else None,
                    faltas=int(faltas) if faltas is not None else 0,
                    media_faltas=round(float(media_faltas), 1) if media_faltas is not None else None,
                    is_archived=aluno.is_archived,
                    deleted_at=aluno.deleted_at,
                    telefones=aluno.telefones,
                    email=aluno.email,
                    email_responsavel=aluno.email_responsavel,
                    telefone_responsavel=aluno.telefone_responsavel,
                    max_pts=max_pts,
                )
            )


        return AlunoPaginatedResponse(
            items=items,
            meta=PaginationMeta(
                page=page,
                per_page=per_page,
                total=total,
                pages=ceil(total / per_page) if total else 0
            )
        )

    def get_aluno_details(self, aluno_id: int) -> Optional[AlunoDetailSchema]:
        aluno, media, notas = self.repository.get_with_notes(aluno_id)
        
        if not aluno:
            return None

        notas_schema = [NotaSchema.model_validate(nota) for nota in notas]

        from app.services.analytics import get_grading_stage
        tenant_id = None
        academic_year_id = None
        try:
            from flask import g
            tenant_id = getattr(g, "tenant_id", None)
            academic_year_id = getattr(g, "academic_year_id", None)
        except Exception:
            pass

        try:
            stage = get_grading_stage(self.repository.session, tenant_id, academic_year_id)
            max_pts = stage["max_pts"]
        except Exception:
            max_pts = 30

        return AlunoDetailSchema(
            id=aluno.id,
            matricula=aluno.matricula,
            nome=aluno.nome,
            turma=aluno.turma,
            turno=aluno.turno,
            status=aluno.status,
            media=float(media) if media is not None else None,
            notas=notas_schema,
            # Personal info
            sexo=aluno.sexo,
            data_nascimento=aluno.data_nascimento,
            naturalidade=aluno.naturalidade,
            zona=aluno.zona,
            endereco=aluno.endereco,
            filiacao=aluno.filiacao,
            telefones=aluno.telefones,
            cpf=aluno.cpf,
            nis=aluno.nis,
            inep=aluno.inep,
            situacao_anterior=aluno.situacao_anterior,
            email=aluno.email,
            # Contato do responsável
            email_responsavel=aluno.email_responsavel,
            telefone_responsavel=aluno.telefone_responsavel,
            max_pts=max_pts,
        )

    def get_aluno_by_matricula(self, matricula: str) -> tuple:
        """Find the aluno for the current academic year by matricula.

        The ORM event listener automatically applies tenant_id and academic_year_id filters.
        """
        from app.models import Aluno
        aluno = self.repository.session.query(Aluno).filter(
            Aluno.matricula == matricula
        ).first()
        if not aluno:
            return None, None, []
        return self.repository.get_with_notes(aluno.id)

    def create_aluno(self, data: dict) -> AlunoListSchema:
        aluno = self.repository.create(data)
        log_action(self.repository.session, self.user_id, "CREATE", "Aluno", aluno.id, data)
        from app.services.accounts import ensure_aluno_user, ensure_responsavel_user
        _usuario_aluno, senha_aluno = ensure_aluno_user(self.repository.session, aluno)
        ensure_responsavel_user(self.repository.session, aluno)
        return AlunoListSchema(
            id=aluno.id,
            matricula=aluno.matricula,
            nome=aluno.nome,
            turma=aluno.turma,
            turno=aluno.turno,
            status=aluno.status,
            senha_inicial=senha_aluno,
        )

    def update_aluno(self, aluno_id: int, data: dict) -> Optional[AlunoListSchema]:
        aluno = self.repository.get_scoped(aluno_id)
        if not aluno:
            return None

        updated = self.repository.update(aluno, data)
        log_action(self.repository.session, self.user_id, "UPDATE", "Aluno", aluno_id, data)
        return AlunoListSchema(
            id=updated.id,
            matricula=updated.matricula,
            nome=updated.nome,
            turma=updated.turma,
            turno=updated.turno,
            status=updated.status
        )

    def delete_aluno(self, aluno_id: int) -> bool:
        """Soft-delete: archives the aluno rather than permanently removing the record."""
        success = self.repository.soft_delete_scoped(aluno_id)
        if success:
            log_action(self.repository.session, self.user_id, "ARCHIVE", "Aluno", aluno_id)
        return success

    def restore_aluno(self, aluno_id: int) -> Optional[AlunoListSchema]:
        """Restore a previously archived aluno to active status."""
        aluno = self.repository.restore_scoped(aluno_id)
        if not aluno:
            return None
        log_action(self.repository.session, self.user_id, "RESTORE", "Aluno", aluno_id)
        return AlunoListSchema(
            id=aluno.id,
            matricula=aluno.matricula,
            nome=aluno.nome,
            turma=aluno.turma,
            turno=aluno.turno,
            status=aluno.status,
        )

    def list_archived(
        self,
        page: int,
        per_page: int,
        query_text: Optional[str] = None,
    ) -> AlunoPaginatedResponse:
        return self.list_alunos(
            page=page,
            per_page=per_page,
            query_text=query_text,
            include_archived=True,
        )

    def get_bulletin_data(self, aluno_id: int) -> Optional[dict]:
        aluno, media, notas = self.repository.get_with_notes(aluno_id)
        if not aluno:
            return None
        
        from datetime import datetime
        notas_list = [
            {
                "disciplina": n.disciplina,
                "trimestre1": float(n.trimestre1) if n.trimestre1 is not None else None,
                "trimestre2": float(n.trimestre2) if n.trimestre2 is not None else None,
                "trimestre3": float(n.trimestre3) if n.trimestre3 is not None else None,
                "total": float(n.total) if n.total is not None else None,
                "recuperacao": float(n.recuperacao) if n.recuperacao is not None else None,
                "conselho_de_classe": float(n.conselho_de_classe) if n.conselho_de_classe is not None else None,
                "faltas": n.faltas or 0,
                "situacao": n.situacao,
            }
            for n in notas
        ]
        total_faltas = sum(n["faltas"] for n in notas_list)
        return {
            "nome": aluno.nome,
            "matricula": aluno.matricula,
            "turma": aluno.turma,
            "turno": aluno.turno,
            "media": float(media) if media is not None else 0.0,
            "total_faltas": total_faltas,
            "notas": notas_list,
            "generated_at": datetime.now().strftime("%d/%m/%Y %H:%M"),
        }
