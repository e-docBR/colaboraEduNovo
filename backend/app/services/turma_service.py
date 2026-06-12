from statistics import mean
from typing import Optional, List, Dict
from sqlalchemy.orm import Session

from app.repositories.turma_repository import TurmaRepository
from app.schemas.turma import (
    TurmaListResponse, 
    TurmaSummarySchema, 
    TurmaDetailResponse, 
    AlunoTurmaDetailSchema,
    NotaSimplificadaSchema
)
from app.models import Nota

class TurmaService:
    def __init__(self, session: Session):
        self.repository = TurmaRepository(session)

    def _slugify(self, value: str) -> str:
        if not value:
            return ""
        import re
        from unicodedata import normalize as u_norm
        normalized = u_norm("NFKD", value).encode("ascii", "ignore").decode("ascii")
        # Remove "ANO" to match 7º ANO F with 7º F
        ascii_value = re.sub(r"\bano\b", "", normalized, flags=re.IGNORECASE)
        ascii_value = ascii_value.strip().lower()
        ascii_value = re.sub(r"[^a-z0-9]+", "-", ascii_value)
        return "-".join(filter(None, ascii_value.split("-")))

    def list_turmas(self) -> TurmaListResponse:
        from flask import g
        from app.models import UsuarioTurma, Aluno
        from collections import defaultdict
        
        tenant_id = getattr(g, "tenant_id", None)
        academic_year_id = getattr(g, "academic_year_id", None)
        
        # Pull linkages
        links = self.repository.session.query(UsuarioTurma.turma, UsuarioTurma.usuario_id).filter(
            UsuarioTurma.tenant_id == tenant_id,
            UsuarioTurma.academic_year_id == academic_year_id
        ).all()
        
        turma_prof_ids = defaultdict(list)
        for t_name, u_id in links:
            turma_prof_ids[t_name].append(u_id)

        rows = self.repository.get_summaries()
        
        # Build deterministic slug map
        query_distinct = self.repository.session.query(Aluno.turma).distinct()
        if tenant_id:
             query_distinct = query_distinct.filter(Aluno.tenant_id == tenant_id)
             
        turmas = [r[0] for r in query_distinct.all() if r[0]]
        turmas.sort()
        
        slug_map = {}
        seen_slugs = set()
        for t in turmas:
            base_slug = self._slugify(t)
            slug = base_slug
            counter = 2
            while slug in seen_slugs:
                slug = f"{base_slug}-{counter}"
                counter += 1
            seen_slugs.add(slug)
            slug_map[t] = slug
        
        items = [
            TurmaSummarySchema(
                turma=turma,
                turno=turno,
                total_alunos=total,
                media=round(float(media), 2) if media is not None else None,
                faltas_medias=round(float(faltas), 1) if faltas is not None else 0.0,
                slug=slug_map.get(turma, self._slugify(turma)),
                professor_ids=turma_prof_ids.get(turma, [])
            )
            for turma, turno, total, media, faltas in rows
        ]
        
        return TurmaListResponse(items=items, total=len(items))

    def get_turma_detail(self, turma_nome_or_slug: str) -> Optional[TurmaDetailResponse]:
        turma_real = self.repository.get_real_name(turma_nome_or_slug, self._slugify)
        if not turma_real:
            return None

        alunos = self.repository.get_alunos_by_turma(turma_real)
        if not alunos:
            return TurmaDetailResponse(turma=turma_real, turno="", total=0, alunos=[])

        aluno_ids = [a.id for a in alunos]
        notas = self.repository.get_notas_for_alunos(aluno_ids)

        notas_por_aluno: Dict[int, List[Nota]] = {aid: [] for aid in aluno_ids}
        for nota in notas:
            notas_por_aluno[nota.aluno_id].append(nota)

        alunos_payload = []
        for aluno in alunos:
            notas_aluno = notas_por_aluno.get(aluno.id, [])
            media_total = self._calcular_media(notas_aluno)
            situacao = self._calcular_situacao(notas_aluno)
            
            # Map Nota model to Schema
            notas_schema = [
                NotaSimplificadaSchema(
                    disciplina=n.disciplina,
                    trimestre1=float(n.trimestre1) if n.trimestre1 is not None else None,
                    trimestre2=float(n.trimestre2) if n.trimestre2 is not None else None,
                    trimestre3=float(n.trimestre3) if n.trimestre3 is not None else None,
                    total=float(n.total) if n.total is not None else None,
                    faltas=n.faltas,
                    situacao=n.situacao
                ) for n in notas_aluno
            ]

            alunos_payload.append(
                AlunoTurmaDetailSchema(
                    id=aluno.id,
                    nome=aluno.nome,
                    matricula=aluno.matricula,
                    turma=aluno.turma,
                    turno=aluno.turno,
                    media=media_total,
                    situacao=situacao,
                    status=aluno.status,
                    sexo=aluno.sexo,
                    data_nascimento=aluno.data_nascimento,
                    notas=notas_schema
                )
            )

        return TurmaDetailResponse(
            turma=turma_real,
            turno=alunos[0].turno,
            total=len(alunos_payload),
            alunos=alunos_payload
        )

    def rename_turma(self, slug: str, new_nome: str, new_turno: Optional[str] = None) -> Optional[int]:
        turma_real = self.repository.get_real_name(slug, self._slugify)
        if not turma_real:
            return None
        return self.repository.rename_turma(turma_real, new_nome, new_turno)

    def delete_turma(self, slug: str) -> Optional[int]:
        turma_real = self.repository.get_real_name(slug, self._slugify)
        if not turma_real:
            return None
        return self.repository.delete_turma(turma_real)

    def _calcular_media(self, notas: List[Nota]) -> Optional[float]:
        valores = [float(n.total) for n in notas if n.total is not None]
        if not valores:
            return None
        return round(mean(valores), 1)

    def _calcular_situacao(self, notas: List[Nota]) -> str:
        situacoes = [str(n.situacao).upper() for n in notas if n.situacao]
        if not situacoes:
            return "APR" # Default to APR if no data? Or unknown. Logic copied from orig.
            
        if any(sit in {"REP", "REPROVADO"} for sit in situacoes):
            return "REP"
        
        if any(sit not in {"APR", "APROVADO", "ACC", "APCC", "AR"} for sit in situacoes):
            return "REC"
            
        if any(sit in {"ACC", "APCC"} for sit in situacoes):
            return "APCC"

        if any(sit == "AR" for sit in situacoes):
            return "AR"

        return "APR"
