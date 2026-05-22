"""Endpoints para gráficos dinâmicos do dashboard."""
from __future__ import annotations

from typing import Callable

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from ...core.database import session_scope
from ...core.cache import cache_response
from ...core.decorators import require_roles
from ...models import Aluno, Nota

DISCIPLINA_NORMALIZACAO = {
    "ARTES": "ARTE",
    "INGLES": "LÍNGUA INGLESA",
    "INGLÊS": "LÍNGUA INGLESA",
    "LÍNGUA PORTUGUÊSA": "LÍNGUA PORTUGUESA",
    "LINGUA PORTUGUESA": "LÍNGUA PORTUGUESA",
}


def _normalize_disciplina(nome: str | None) -> str:
    if not nome:
        return "OUTROS"
    chave = nome.strip().upper()
    return DISCIPLINA_NORMALIZACAO.get(chave, nome.strip())


GraphBuilder = Callable[
    [Session, str | None, str | None, str | None, str | None, str | None],
    list[dict[str, object]],
]


def register(parent: Blueprint) -> None:
    bp = Blueprint("graficos", __name__)

    @bp.get("/graficos/<string:slug>")
    @jwt_required()
    @require_roles("admin", "super_admin", "coordenador", "diretor", "orientador", "professor")
    @cache_response(timeout=300, key_prefix="graficos")
    def get_grafico(slug: str):
        builder = GRAPH_BUILDERS.get(slug)
        if not builder:
            return jsonify({"error": "Gráfico não encontrado"}), 404

        turno = request.args.get("turno") or None
        serie = request.args.get("serie") or None
        turma = request.args.get("turma") or None
        trimestre = request.args.get("trimestre") or None
        disciplina = request.args.get("disciplina") or None

        with session_scope() as session:
            data = builder(session, turno, serie, turma, trimestre, disciplina)

        return jsonify({"slug": slug, "dados": data})

    parent.register_blueprint(bp)


TRIMESTRE_COLUMNS = {
    "1": Nota.trimestre1,
    "2": Nota.trimestre2,
    "3": Nota.trimestre3,
}

_ABAIXO_THRESHOLD: dict[str, int] = {
    "1": 15, "2": 15, "3": 20, "final": 50,
}


def _resolve_trimestre_column(trimestre: str | None):
    if trimestre in TRIMESTRE_COLUMNS:
        return TRIMESTRE_COLUMNS[trimestre]
    return Nota.total


def _apply_common_filters(query, turno: str | None, serie: str | None, turma: str | None, disciplina: str | None):
    from flask import g
    tenant_id = getattr(g, "tenant_id", None)
    year_id = getattr(g, "academic_year_id", None)

    if tenant_id:
        query = query.filter(Aluno.tenant_id == tenant_id)
    if year_id:
        query = query.filter(Aluno.academic_year_id == year_id)

    if turno:
        query = query.filter(Aluno.turno == turno)
    if serie:
        query = query.filter(Aluno.turma.ilike(f"{serie}%"))
    if turma:
        query = query.filter(Aluno.turma == turma)
    if disciplina:
        query = query.filter(Nota.disciplina.ilike(f"%{disciplina}%"))
    return query


# ── Agrupamento de situação para o gráfico de rosca ─────────────────────────

_SITUACAO_GRUPO = {
    "APR":  "Aprovado",
    "APCC": "Aprovado",
    "AR":   "Aprovado",
    "AFC":  "Aprovado",
    "REP":  "Reprovado",
    "DPC":  "Reprovado",
    "REC":  "Em Recuperação",
    "EMR":  "Em Recuperação",
    "EMC":  "Em Curso",
    "TRN":  "Transferido",
    "ABA":  "Abandono",
}


def _situacao_distribuicao(
    session,
    turno: str | None,
    serie: str | None,
    turma: str | None,
    _trimestre: str | None,
    _disciplina: str | None,
):
    """Distribuição de alunos por grupo de situação (Aprovado / Em Recuperação / Reprovado / Em Curso / …)."""
    from flask import g
    tenant_id = getattr(g, "tenant_id", None)
    year_id   = getattr(g, "academic_year_id", None)

    query = session.query(Nota.aluno_id, Nota.situacao, Aluno.status)
    query = query.join(Aluno, Nota.aluno_id == Aluno.id)
    if tenant_id:
        query = query.filter(Nota.tenant_id == tenant_id)
    if year_id:
        query = query.filter(Nota.academic_year_id == year_id)
    if turno:
        query = query.filter(Aluno.turno == turno)
    if serie:
        query = query.filter(Aluno.turma.ilike(f"{serie}%"))
    if turma:
        query = query.filter(Aluno.turma == turma)

    # Acumula situações por aluno (1 aluno pode ter várias disciplinas)
    aluno_situacoes: dict[int, set[str]] = {}
    aluno_status:    dict[int, str]       = {}

    for aluno_id, nota_sit, student_status in query.all():
        if student_status:
            aluno_status[aluno_id] = student_status
        if nota_sit:
            aluno_situacoes.setdefault(aluno_id, set()).add(nota_sit.strip().upper())

    counts: dict[str, int] = {}

    for aluno_id, situacoes in aluno_situacoes.items():
        # Alunos com status administrativo (TRN, ABA, …) têm prioridade
        if aluno_id in aluno_status:
            grupo = _SITUACAO_GRUPO.get(aluno_status[aluno_id].upper(), "Outros")
            counts[grupo] = counts.get(grupo, 0) + 1
            continue

        # Classifica pelo "pior" status acadêmico entre as disciplinas
        if situacoes & {"REP", "DPC"}:
            grupo = "Reprovado"
        elif situacoes & {"REC", "EMR"}:
            grupo = "Em Recuperação"
        elif situacoes & {"APR", "APCC", "AR", "AFC"}:
            grupo = "Aprovado"
        elif situacoes & {"EMC"}:
            grupo = "Em Curso"
        else:
            grupo = "Outros"

        counts[grupo] = counts.get(grupo, 0) + 1

    # Ordem de exibição natural
    ORDER = ["Aprovado", "Em Recuperação", "Reprovado", "Em Curso", "Abandono", "Transferido", "Outros"]
    return [
        {"situacao": grupo, "total": counts[grupo]}
        for grupo in ORDER
        if grupo in counts
    ]


# ── Disciplinas: média por disciplina ────────────────────────────────────────

def _disciplinas_medias(
    session,
    turno: str | None,
    serie: str | None,
    turma: str | None,
    trimestre: str | None,
    disciplina: str | None,
):
    column = _resolve_trimestre_column(trimestre)
    query = session.query(
        Nota.disciplina,
        func.sum(column).label("soma"),
        func.count(column).label("quantidade"),
    )
    query = query.join(Aluno)
    query = _apply_common_filters(query, turno, serie, turma, disciplina)
    query = query.group_by(Nota.disciplina)

    agregados: dict[str, dict[str, float]] = {}
    for disc, soma, quantidade in query.all():
        disc_norm = _normalize_disciplina(disc)
        bucket = agregados.setdefault(disc_norm, {"soma": 0.0, "quantidade": 0})
        bucket["soma"] += float(soma or 0.0)
        bucket["quantidade"] += int(quantidade or 0)

    resultados = [
        {"disciplina": d, "media": round(v["soma"] / v["quantidade"], 2) if v["quantidade"] else 0.0}
        for d, v in agregados.items()
    ]
    resultados.sort(key=lambda x: x["media"])  # crescente: piores primeiro → útil para diagnóstico
    return resultados


# ── Médias por trimestre (evolução) ──────────────────────────────────────────

def _medias_por_trimestre(
    session,
    turno: str | None,
    serie: str | None,
    turma: str | None,
    _trimestre: str | None,
    disciplina: str | None,
):
    # Retorna também os limites de cada trimestre para referência no gráfico
    TRIMESTRE_META = {"1": 15, "2": 30, "3": 50}
    TRIMESTRE_MAX  = {"1": 30, "2": 30, "3": 40}

    resultados: list[dict[str, object]] = []
    for t_key, column in TRIMESTRE_COLUMNS.items():
        query = session.query(func.avg(column))
        query = query.join(Aluno)
        query = _apply_common_filters(query, turno, serie, turma, disciplina)
        media = query.scalar()
        resultados.append({
            "trimestre": f"{t_key}º Trim.",
            "media":     round(float(media), 1) if media else 0.0,
            "meta":      TRIMESTRE_META[t_key],
            "max_pts":   TRIMESTRE_MAX[t_key],
        })
    return resultados


# ── Evolução por turno ao longo dos trimestres ───────────────────────────────

def _evolucao_turnos(
    session: Session,
    _turno: str | None,
    serie: str | None,
    _turma: str | None,
    _trimestre: str | None,
    disciplina: str | None,
):
    """Média por trimestre para cada turno detectado dinamicamente."""
    from flask import g
    tenant_id = getattr(g, "tenant_id", None)
    year_id   = getattr(g, "academic_year_id", None)

    # Detecta os turnos realmente existentes
    q_turnos = session.query(func.distinct(Aluno.turno)).filter(Aluno.turno.isnot(None))
    if tenant_id:
        q_turnos = q_turnos.filter(Aluno.tenant_id == tenant_id)
    if year_id:
        q_turnos = q_turnos.filter(Aluno.academic_year_id == year_id)
    turnos = sorted([r[0] for r in q_turnos.all() if r[0]])

    periodos = [("1º", Nota.trimestre1), ("2º", Nota.trimestre2), ("3º", Nota.trimestre3)]
    results = []

    for periodo_label, col in periodos:
        row: dict[str, object] = {"periodo": periodo_label}
        for turno_nome in turnos:
            q = session.query(func.avg(col)).join(Aluno).filter(Aluno.turno == turno_nome)
            if tenant_id:
                q = q.filter(Aluno.tenant_id == tenant_id)
            if year_id:
                q = q.filter(Aluno.academic_year_id == year_id)
            if serie:
                q = q.filter(Aluno.turma.ilike(f"{serie}%"))
            if disciplina:
                q = q.filter(Nota.disciplina.ilike(f"%{disciplina}%"))
            media = q.scalar()
            row[turno_nome] = round(float(media), 1) if media else 0.0
        results.append(row)

    return results


# ── Gauss: distribuição de pontos totais ─────────────────────────────────────

def _gauss_escola(
    session: Session,
    turno: str | None,
    serie: str | None,
    turma: str | None,
    trimestre: str | None,
    disciplina: str | None,
):
    """Histograma de alunos por faixa de pontuação total (0-100)."""
    # Média por aluno (para contar um aluno uma vez, não por disciplina)
    subq = (
        session.query(Nota.aluno_id, func.avg(Nota.total).label("media"))
        .join(Aluno)
    )
    subq = _apply_common_filters(subq, turno, serie, turma, disciplina)
    subq = subq.group_by(Nota.aluno_id).subquery()

    FAIXAS = [
        ("0–10",   0,  10),
        ("11–20",  10, 20),
        ("21–30",  20, 30),
        ("31–40",  30, 40),
        ("41–50",  40, 50),
        ("51–60",  50, 60),
        ("61–70",  60, 70),
        ("71–80",  70, 80),
        ("81–90",  80, 90),
        ("91–100", 90, 101),
    ]

    faixa_col = case(
        *[
            (subq.c.media.between(low, high - 0.01), label)
            for label, low, high in FAIXAS
        ],
        else_="91–100",
    ).label("faixa")

    from sqlalchemy import select as sa_select
    stm = (
        sa_select(faixa_col, func.count().label("alunos"))
        .select_from(subq)
        .group_by(faixa_col)
    )

    raw: dict[str, int] = {label: 0 for label, *_ in FAIXAS}
    for row in session.execute(stm).all():
        raw[row.faixa] = int(row.alunos)

    return [{"faixa": label, "alunos": raw.get(label, 0)} for label, *_ in FAIXAS]


# ── Correlação frequência × nota ─────────────────────────────────────────────

def _correlacao_frequencia(
    session: Session,
    turno: str | None,
    serie: str | None,
    turma: str | None,
    _trimestre: str | None,
    disciplina: str | None,
):
    query = (
        session.query(
            Aluno.id,
            Aluno.nome,
            Aluno.turma,
            func.avg(Nota.total).label("media"),
            func.sum(Nota.faltas).label("faltas"),
        )
        .join(Nota)
    )
    query = _apply_common_filters(query, turno, serie, turma, disciplina)
    query = query.group_by(Aluno.id, Aluno.nome, Aluno.turma).limit(400)

    results = []
    for _, nome, turma_aluno, media, faltas in query.all():
        results.append({
            "nome":    nome,
            "turma":   turma_aluno,
            "media":   round(float(media or 0), 1),
            "faltas":  int(faltas or 0),
        })
    return results


# ── Faltas por turma ──────────────────────────────────────────────────────────

def _faltas_por_turma(
    session,
    turno: str | None,
    serie: str | None,
    turma: str | None,
    _trimestre: str | None,
    _disciplina: str | None,
):
    query = (
        session.query(
            Aluno.turma,
            func.sum(Nota.faltas).label("faltas"),
            func.count(func.distinct(Aluno.id)).label("alunos"),
        )
        .join(Nota)
        .group_by(Aluno.turma)
        .order_by(func.sum(Nota.faltas).desc())
    )
    query = _apply_common_filters(query, turno, serie, turma, None)
    results = query.limit(15).all()
    return [
        {
            "turma":         turma_nome,
            "faltas":        int(faltas or 0),
            "alunos":        int(alunos or 0),
            "media_faltas":  round(int(faltas or 0) / int(alunos), 1) if alunos else 0.0,
        }
        for turma_nome, faltas, alunos in results
    ]


# ── Heatmap disciplina × turma ────────────────────────────────────────────────

def _heatmap_disciplinas(
    session,
    turno: str | None,
    serie: str | None,
    turma: str | None,
    trimestre: str | None,
    disciplina: str | None,
):
    column = _resolve_trimestre_column(trimestre)
    query = session.query(Aluno.turma, Nota.disciplina, func.avg(column).label("media"))
    query = query.join(Aluno)
    query = _apply_common_filters(query, turno, serie, turma, disciplina)
    query = query.group_by(Aluno.turma, Nota.disciplina)

    agregados: dict[tuple[str, str], dict[str, float]] = {}
    for turma_nome, disc, media in query.all():
        disc_norm = _normalize_disciplina(disc)
        chave = (turma_nome, disc_norm)
        bucket = agregados.setdefault(chave, {"soma": 0.0, "quantidade": 0})
        bucket["soma"]       += float(media or 0.0)
        bucket["quantidade"] += 1

    resultados = [
        {
            "turma":      turma_nome,
            "disciplina": disc_norm,
            "media":      round(v["soma"] / v["quantidade"], 1) if v["quantidade"] else 0.0,
        }
        for (turma_nome, disc_norm), v in agregados.items()
    ]
    resultados.sort(key=lambda x: (x["turma"], x["disciplina"]))
    return resultados


# ── Turmas × trimestre (evolução por turma) ───────────────────────────────────

def _turmas_trimestre(
    session,
    turno: str | None,
    serie: str | None,
    turma: str | None,
    _trimestre: str | None,
    disciplina: str | None,
):
    results: list[dict[str, object]] = []
    for t_key, column in TRIMESTRE_COLUMNS.items():
        query = session.query(func.avg(column))
        query = query.join(Aluno)
        query = _apply_common_filters(query, turno, serie, turma, disciplina)
        media = query.scalar()
        results.append({"trimestre": f"{t_key}º", "media": round(float(media), 2) if media else 0.0})
    return results


# ── Aprovação por turma ───────────────────────────────────────────────────────

def _aprovacao_por_turma(
    session: Session,
    turno: str | None,
    serie: str | None,
    turma: str | None,
    _trimestre: str | None,
    _disciplina: str | None,
):
    """Taxa de aprovação (média ≥ threshold) por turma, com ranking."""
    from flask import g
    from ...services.analytics import get_grading_stage

    tenant_id = getattr(g, "tenant_id", None)
    year_id   = getattr(g, "academic_year_id", None)
    stage     = get_grading_stage(session, tenant_id, year_id)
    threshold = stage["threshold"]

    # Subquery: média total por aluno
    subq = (
        session.query(
            Aluno.turma,
            Nota.aluno_id,
            func.avg(Nota.total).label("media"),
        )
        .join(Aluno)
    )
    if tenant_id:
        subq = subq.filter(Nota.tenant_id == tenant_id)
    if year_id:
        subq = subq.filter(Nota.academic_year_id == year_id)
    if turno:
        subq = subq.filter(Aluno.turno == turno)
    if serie:
        subq = subq.filter(Aluno.turma.ilike(f"{serie}%"))
    if turma:
        subq = subq.filter(Aluno.turma == turma)
    subq = subq.group_by(Aluno.turma, Nota.aluno_id).subquery()

    rows = (
        session.query(
            subq.c.turma,
            func.count().label("total"),
            func.sum(case((subq.c.media >= threshold, 1), else_=0)).label("aprovados"),
            func.sum(case((subq.c.media < threshold, 1), else_=0)).label("em_risco"),
            func.avg(subq.c.media).label("media_turma"),
        )
        .group_by(subq.c.turma)
        .order_by(func.avg(subq.c.media).desc())
        .all()
    )

    return [
        {
            "turma":          r.turma,
            "total":          int(r.total),
            "aprovados":      int(r.aprovados),
            "em_risco":       int(r.em_risco),
            "taxa_aprovacao": round(int(r.aprovados) / int(r.total) * 100, 1) if r.total else 0.0,
            "media":          round(float(r.media_turma), 1) if r.media_turma else 0.0,
        }
        for r in rows
    ]


def _abaixo_por_disciplina(
    session: Session,
    turno: str | None,
    serie: str | None,
    turma: str | None,
    trimestre: str | None,
    disciplina: str | None,
):
    """Disciplinas com mais registros abaixo do threshold do trimestre selecionado."""
    col = _resolve_trimestre_column(trimestre)
    threshold = _ABAIXO_THRESHOLD.get(trimestre or "", 50)

    query = (
        session.query(
            Nota.disciplina,
            func.count().label("registros"),
            func.sum(case((col < threshold, 1), else_=0)).label("abaixo"),
        )
        .join(Aluno)
        .filter(col.isnot(None))
    )
    query = _apply_common_filters(query, turno, serie, turma, disciplina)
    query = (
        query.group_by(Nota.disciplina)
        .having(func.sum(case((col < threshold, 1), else_=0)) > 0)
        .order_by(func.sum(case((col < threshold, 1), else_=0)).desc())
    )

    return [
        {
            "disciplina": _normalize_disciplina(r.disciplina),
            "registros":  int(r.registros),
            "abaixo":     int(r.abaixo),
            "percentual": round(int(r.abaixo) / int(r.registros) * 100, 1) if r.registros else 0.0,
        }
        for r in query.all()
    ]


def _abaixo_por_turma(
    session: Session,
    turno: str | None,
    serie: str | None,
    turma: str | None,
    trimestre: str | None,
    disciplina: str | None,
):
    """Por turma: alunos com ao menos uma disciplina abaixo do threshold vs acima."""
    from flask import g

    col = _resolve_trimestre_column(trimestre)
    threshold = _ABAIXO_THRESHOLD.get(trimestre or "", 50)
    tenant_id = getattr(g, "tenant_id", None)
    year_id   = getattr(g, "academic_year_id", None)

    # Subquery: nota mínima por aluno (qualquer disciplina abaixo ⇒ em risco)
    subq = (
        session.query(
            Aluno.turma,
            Nota.aluno_id,
            func.min(col).label("nota_min"),
        )
        .join(Aluno, Nota.aluno_id == Aluno.id)
        .filter(col.isnot(None))
    )
    if tenant_id:
        subq = subq.filter(Nota.tenant_id == tenant_id)
    if year_id:
        subq = subq.filter(Nota.academic_year_id == year_id)
    if turno:
        subq = subq.filter(Aluno.turno == turno)
    if serie:
        subq = subq.filter(Aluno.turma.ilike(f"{serie}%"))
    if turma:
        subq = subq.filter(Aluno.turma == turma)
    if disciplina:
        subq = subq.filter(Nota.disciplina.ilike(f"%{disciplina}%"))
    subq = subq.group_by(Aluno.turma, Nota.aluno_id).subquery()

    rows = (
        session.query(
            subq.c.turma,
            func.count().label("total"),
            func.sum(case((subq.c.nota_min < threshold, 1), else_=0)).label("abaixo"),
        )
        .group_by(subq.c.turma)
        .order_by(func.sum(case((subq.c.nota_min < threshold, 1), else_=0)).desc())
        .all()
    )

    return [
        {
            "turma":      r.turma,
            "total":      int(r.total),
            "abaixo":     int(r.abaixo),
            "acima":      int(r.total) - int(r.abaixo),
            "percentual": round(int(r.abaixo) / int(r.total) * 100, 1) if r.total else 0.0,
        }
        for r in rows
    ]


def _deficit_ranking(
    session: Session,
    turno: str | None,
    serie: str | None,
    turma: str | None,
    trimestre: str | None,
    disciplina: str | None,
):
    """Top 20 alunos com maior soma de déficit de pontos no trimestre."""
    col = _resolve_trimestre_column(trimestre)
    threshold = _ABAIXO_THRESHOLD.get(trimestre or "", 50)

    query = (
        session.query(
            Aluno.nome,
            Aluno.turma,
            func.sum(threshold - col).label("deficit_total"),
            func.count().label("disciplinas"),
        )
        .join(Aluno, Nota.aluno_id == Aluno.id)
        .filter(col.isnot(None), col < threshold)
    )
    query = _apply_common_filters(query, turno, serie, turma, disciplina)
    query = (
        query.group_by(Aluno.nome, Aluno.turma)
        .order_by(func.sum(threshold - col).desc())
        .limit(20)
    )

    return [
        {
            "nome":          r.nome,
            "turma":         r.turma,
            "deficit_total": round(float(r.deficit_total), 1) if r.deficit_total else 0.0,
            "disciplinas":   int(r.disciplinas),
        }
        for r in query.all()
    ]


# ── Registro de todos os builders ────────────────────────────────────────────

GRAPH_BUILDERS: dict[str, GraphBuilder] = {
    "disciplinas-medias":     _disciplinas_medias,
    "turmas-trimestre":       _turmas_trimestre,
    "situacao-distribuicao":  _situacao_distribuicao,
    "faltas-por-turma":       _faltas_por_turma,
    "heatmap-disciplinas":    _heatmap_disciplinas,
    "medias-por-trimestre":   _medias_por_trimestre,
    "gauss-escola":           _gauss_escola,
    "correlacao-frequencia":  _correlacao_frequencia,
    "evolucao-turnos":        _evolucao_turnos,
    "aprovacao-por-turma":    _aprovacao_por_turma,
    "abaixo-por-disciplina":  _abaixo_por_disciplina,
    "abaixo-por-turma":       _abaixo_por_turma,
    "deficit-ranking":        _deficit_ranking,
}
