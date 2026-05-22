"""Analytics service responsible for KPIs and reports."""
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import case, func, select
from sqlalchemy.orm import Session

from ..models import Aluno, Nota

# Distribuição de pontos por trimestre: (campo, max_acumulado, aprovação_acumulada)
# Ordem importa: verificamos do mais avançado para o menos avançado.
GRADING_STAGES = [
    ("trimestre3", 100, 50),  # T1+T2+T3 disponíveis
    ("trimestre2",  60, 30),  # somente T1+T2
    ("trimestre1",  30, 15),  # somente T1
]

# Mapa trimestre → label legível
_STAGE_LABELS = {
    "trimestre3": "T3",
    "trimestre2": "T2",
    "trimestre1": "T1",
}


def get_grading_stage(session: Session, tenant_id: int | None, year_id: int | None) -> dict[str, Any]:
    """Retorna o estágio atual do ano letivo com base no campo trimestre_atual do AcademicYear.

    Retorna {"trimester": "T1"|"T2"|"T3", "max_pts": int, "threshold": int, "trimestre_atual": int}.
    """
    from ..models.academic_year import AcademicYear as AcademicYearModel

    trimestre = 1  # default
    if year_id:
        row = session.query(AcademicYearModel.trimestre_atual).filter(
            AcademicYearModel.id == year_id
        ).scalar()
        if row is not None:
            trimestre = int(row)
    elif tenant_id:
        row = session.query(AcademicYearModel.trimestre_atual).filter(
            AcademicYearModel.tenant_id == tenant_id,
            AcademicYearModel.is_current.is_(True),
        ).scalar()
        if row is not None:
            trimestre = int(row)

    # Configuração acumulada por trimestre
    _STAGE_MAP = {
        1: ("T1",  30,  15),
        2: ("T2",  60,  30),
        3: ("T3", 100,  50),
    }
    label, max_pts, threshold = _STAGE_MAP.get(trimestre, ("T3", 100, 50))
    return {
        "trimester":      label,
        "max_pts":        max_pts,
        "threshold":      threshold,
        "trimestre_atual": trimestre,
    }


@dataclass(slots=True)
class DashboardAnalytics:
    total_alunos: int
    total_turmas: int
    media_geral: float
    alunos_em_risco: int
    ocorrencias_abertas: int = 0
    comunicados_recentes: int = 0
    grading_stage: dict[str, Any] = field(default_factory=lambda: {"trimester": "T3", "max_pts": 100, "threshold": 50})
    # Teacher specific
    distribution: dict[str, int] | None = None

    @classmethod
    def empty(cls) -> "DashboardAnalytics":
        return cls(total_alunos=0, total_turmas=0, media_geral=0.0, alunos_em_risco=0)

    def to_dict(self) -> dict[str, float | int | dict]:
        data = {
            "total_alunos": self.total_alunos,
            "total_turmas": self.total_turmas,
            "media_geral": self.media_geral,
            "alunos_em_risco": self.alunos_em_risco,
            "ocorrencias_abertas": self.ocorrencias_abertas,
            "comunicados_recentes": self.comunicados_recentes,
            "grading_stage": self.grading_stage,
        }
        if self.distribution:
            data["distribution"] = self.distribution
        return data


def build_dashboard_metrics(session: Session) -> DashboardAnalytics:
    from flask import g
    from loguru import logger
    
    tenant_id = getattr(g, 'tenant_id', None)
    year_id = getattr(g, 'academic_year_id', None)
    
    logger.info("Building dashboard metrics. tenant_id: {}, year_id: {}", tenant_id, year_id)
    
    # Base filters
    aluno_filter = [Aluno.status.is_(None)]
    if tenant_id:
        aluno_filter.append(Aluno.tenant_id == tenant_id)
    if year_id:
        aluno_filter.append(Aluno.academic_year_id == year_id)
        
    total_alunos = session.query(func.count(Aluno.id)).filter(*aluno_filter).scalar() or 0
    
    # For turmas, we need distinct count.
    normalized_turma = func.trim(
        func.replace(
            func.replace(func.upper(Aluno.turma), " ANO ", " "),
            "  ",
            " ",
        )
    )
    total_turmas = session.query(func.count(func.distinct(normalized_turma))).filter(*aluno_filter).scalar() or 0
    
    # Filtros base para notas
    nota_filter = [Aluno.status.is_(None)]
    if tenant_id:
        nota_filter.append(Nota.tenant_id == tenant_id)
    if year_id:
        nota_filter.append(Nota.academic_year_id == year_id)

    # Estágio atual — determina a expressão acumulada e o threshold
    stage = get_grading_stage(session, tenant_id, year_id)
    risk_threshold = stage["threshold"]
    trimester = stage["trimester"]

    # Expressão acumulada de pontos de acordo com o trimestre vigente
    if trimester == "T1":
        accumulated = Nota.trimestre1
        stage_not_null = Nota.trimestre1.isnot(None)
    elif trimester == "T2":
        accumulated = func.coalesce(Nota.trimestre1, 0) + func.coalesce(Nota.trimestre2, 0)
        stage_not_null = Nota.trimestre2.isnot(None)
    else:  # T3 — usa total já calculado (T1+T2+T3)
        accumulated = func.coalesce(Nota.total, 0)
        stage_not_null = Nota.total.isnot(None)

    # Subquery: média acumulada POR ALUNO (evita distorção por quantidade de disciplinas)
    per_student_sq = (
        session.query(
            Nota.aluno_id,
            func.avg(accumulated).label("avg_pts"),
        )
        .join(Aluno)
        .filter(stage_not_null, *nota_filter)
        .group_by(Nota.aluno_id)
        .subquery()
    )

    media_geral_value = float(
        session.query(func.avg(per_student_sq.c.avg_pts)).scalar() or 0
    )

    alunos_em_risco = (
        session.query(func.count())
        .select_from(per_student_sq)
        .filter(per_student_sq.c.avg_pts < risk_threshold)
        .scalar() or 0
    )

    # Ocorrências abertas (não resolvidas)
    from ..models import Ocorrencia
    oc_filter = []
    if tenant_id:
        oc_filter.append(Ocorrencia.tenant_id == tenant_id)
    if year_id:
        oc_filter.append(Ocorrencia.academic_year_id == year_id)
    ocorrencias_abertas = session.query(func.count(Ocorrencia.id)).filter(
        Ocorrencia.resolvida == False, *oc_filter  # noqa: E712
    ).scalar() or 0

    # Comunicados dos últimos 7 dias
    from ..models import Comunicado
    from datetime import datetime, timedelta, timezone
    sete_dias_atras = datetime.now(timezone.utc) - timedelta(days=7)
    com_filter = []
    if tenant_id:
        com_filter.append(Comunicado.tenant_id == tenant_id)
    if year_id:
        com_filter.append(Comunicado.academic_year_id == year_id)
    comunicados_recentes = session.query(func.count(Comunicado.id)).filter(
        Comunicado.data_envio >= sete_dias_atras, *com_filter
    ).scalar() or 0

    return DashboardAnalytics(
        total_alunos=total_alunos,
        total_turmas=total_turmas,
        media_geral=round(media_geral_value, 2),
        alunos_em_risco=alunos_em_risco,
        ocorrencias_abertas=ocorrencias_abertas,
        comunicados_recentes=comunicados_recentes,
        grading_stage=stage,
    )

def build_teacher_dashboard(session: Session, query: str | None = None, turno: str | None = None, turma: str | None = None) -> dict[str, any]:
    from flask import g
    tenant_id = getattr(g, 'tenant_id', None)
    year_id = getattr(g, 'academic_year_id', None)

    # Base filter builder
    def apply_filters(stm):
        if tenant_id:
            stm = stm.where(Aluno.tenant_id == tenant_id)
        if year_id:
            stm = stm.where(Aluno.academic_year_id == year_id)
        if turno and turno != 'Todos':
            stm = stm.where(Aluno.turno == turno)
        if turma and turma != 'Todas':
            stm = stm.where(Aluno.turma == turma)
        if query:
            from ..core.helpers import escape_like
            escaped = escape_like(query)
            term = f"%{escaped}%"
            stm = stm.where(Aluno.nome.ilike(term, escape="\\") | Aluno.matricula.ilike(term, escape="\\"))
        # Exclude inactive students
        stm = stm.where(Aluno.status.is_(None))
        return stm

    # 1. Student Performance Distribution (By Average)
    # This reflects how many STUDENTS are in each performance bucket
    dist = {
        "0-20": 0,
        "20-40": 0,
        "40-60": 0,
        "60-80": 0,
        "80-100": 0
    }
    
    # Subquery to get average per student
    subq = select(Nota.aluno_id, func.avg(Nota.total).label("media")).join(Aluno)
    subq = apply_filters(subq)
    subq = subq.group_by(Nota.aluno_id).subquery()
    
    # Single query with CASE to bucket all students at once (replaces 5 separate queries)
    bucket_col = case(
        (subq.c.media < 20, "0-20"),
        (subq.c.media < 40, "20-40"),
        (subq.c.media < 60, "40-60"),
        (subq.c.media < 80, "60-80"),
        else_="80-100",
    ).label("bucket")
    stm_buckets = select(bucket_col, func.count().label("cnt")).select_from(subq).group_by(bucket_col)
    for row in session.execute(stm_buckets).all():
        dist[row.bucket] = int(row.cnt)

    # 2. Risk Alerts (Simulated AI or Heuristic)
    # Fetch top 10 risky students based on grades < 60
    # We can't easily apply WHERE after GROUP BY/HAVING in this structure without subqueries or careful ordering.
    # Instead, we apply filters to the JOIN source.
    # Re-writing query:
    stm_risk = select(
        Aluno,
        func.avg(Nota.total).label("media"),
        func.sum(Nota.faltas).label("faltas"),
    ).join(Nota)
    stm_risk = apply_filters(stm_risk)
    stm_risk = stm_risk.group_by(Aluno.id).having(func.avg(Nota.total) < 60).order_by("media").limit(10)

    risky_students = session.execute(stm_risk).all()

    alerts = []
    from .ai_predictor import predict_risk

    for aluno, media, faltas in risky_students:
        prediction = predict_risk(aluno.id, session)
        alerts.append({
            "id": aluno.id,
            "nome": aluno.nome,
            "turma": aluno.turma,
            "media": round(float(media), 1),
            "faltas": int(faltas or 0),
            "risk_score": prediction.get("score", 0.0),
            "risk_status": prediction.get("status", "BAIXO"),
        })

    # 3. Classes Count
    # apply_filters expects a statement that has Aluno. 
    # Let's fix apply_filters usage or create a fresh one.
    stm_c = select(func.count(func.distinct(Aluno.turma)))
    stm_c = apply_filters(stm_c)
    
    classes_count = session.execute(stm_c).scalar_one()

    # 4. Global Stats
    stm_total_alunos = select(func.count(Aluno.id))
    stm_total_alunos = apply_filters(stm_total_alunos)
    total_alunos = session.execute(stm_total_alunos).scalar_one()

    stm_mean = select(func.avg(Nota.total)).join(Aluno)
    stm_mean = apply_filters(stm_mean)
    global_avg = session.execute(stm_mean).scalar() or 0

    return {
        "distribution": dist,
        "alerts": alerts,
        "classes_count": classes_count,
        "total_students": total_alunos,
        "global_average": round(float(global_avg), 1)
    }
