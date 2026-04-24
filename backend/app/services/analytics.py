"""Analytics service responsible for KPIs and reports."""
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Aluno, Nota


@dataclass(slots=True)
class DashboardAnalytics:
    total_alunos: int
    total_turmas: int
    media_geral: float
    alunos_em_risco: int
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
    
    # Media Geral
    nota_filter = [Aluno.status.is_(None)]
    if tenant_id:
        nota_filter.append(Nota.tenant_id == tenant_id)
    if year_id:
        nota_filter.append(Nota.academic_year_id == year_id)
        
    media_geral = session.query(func.avg(Nota.total)).join(Aluno).filter(*nota_filter).scalar()
    media_geral_value = float(media_geral) if media_geral is not None else 0.0

    # Risk alerts
    alunos_em_risco = session.query(func.count(func.distinct(Nota.aluno_id))).join(Aluno).filter(
        Nota.total < 50,
        *nota_filter
    ).scalar() or 0

    return DashboardAnalytics(
        total_alunos=total_alunos,
        total_turmas=total_turmas,
        media_geral=round(media_geral_value, 2),
        alunos_em_risco=alunos_em_risco,
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
            term = f"%{query}%"
            stm = stm.where(Aluno.nome.ilike(term) | Aluno.matricula.ilike(term))
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
    
    # Bucket queries
    ranges = [
        (0, 20, "0-20"),
        (20, 40, "20-40"),
        (40, 60, "40-60"),
        (60, 80, "60-80"),
        (80, 101, "80-100")
    ]
    
    for start, end, label in ranges:
        stm_dist = select(func.count()).select_from(subq).where(subq.c.media >= start, subq.c.media < end)
        count = session.execute(stm_dist).scalar() or 0
        dist[label] = int(count)

    # 2. Risk Alerts (Simulated AI or Heuristic)
    # Fetch top 10 risky students based on grades < 60
    base_stm = select(Aluno, func.avg(Nota.total).label("media")) \
        .join(Nota) \
        .group_by(Aluno.id) \
        .having(func.avg(Nota.total) < 60) \
        .order_by("media") \
        .limit(10)
    
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
    stm_classes = select(func.count(func.distinct(Aluno.turma)))
    # If filtering by Aluno properties, we just query from Aluno
    stm_classes_src = select(func.count(func.distinct(Aluno.turma)))
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
