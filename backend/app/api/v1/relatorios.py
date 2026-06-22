"""Relatório endpoints."""
from flask import Blueprint, Response, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import case, func
from loguru import logger
from werkzeug.utils import secure_filename

from ...core.database import session_scope
from ...core.cache import cache_response
from ...core.decorators import require_roles
from ...core.extensions import limiter
from ...core.helpers import escape_like
from ...models import Aluno, Nota
from ...services.analytics import get_grading_stage
from ...services.audit import log_action


def _apply_aluno_filters(
    query,
    turno: str | None,
    serie: str | None,
    turma: str | None,
    disciplina: str | None,
):
    from flask import g
    tenant_id = getattr(g, "tenant_id", None)
    year_id = getattr(g, "academic_year_id", None)
    
    if tenant_id:
        query = query.filter(Aluno.tenant_id == tenant_id)
    if year_id:
        query = query.filter(Aluno.academic_year_id == year_id)

    if turno:
        query = query.filter(func.upper(Aluno.turno) == turno.strip().upper())
    if turma:
        query = query.filter(Aluno.turma == turma.strip())
    if serie:
        serie_limpa = serie.strip()
        if serie_limpa:
            escaped = escape_like(serie_limpa)
            query = query.filter(Aluno.turma.ilike(f"{escaped}%", escape="\\"))
    if disciplina:
        query = query.filter(func.upper(Nota.disciplina) == disciplina.strip().upper())
    return query


def _export_safe_cell(value) -> str:
    if value is None:
        return ""
    text = str(value)
    if text.startswith(("=", "+", "-", "@", "\t", "\r")):
        return "'" + text
    return text


def _export_filename(slug: str) -> str:
    return secure_filename(f"relatorio_{slug}") or "relatorio"


def _apply_download_headers(response: Response) -> Response:
    response.headers["Cache-Control"] = "no-store, no-cache, private"
    response.headers["Pragma"] = "no-cache"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


def build_turmas_mais_faltas(
    session,
    turno: str | None = None,
    serie: str | None = None,
    turma: str | None = None,
    disciplina: str | None = None,
    trimestre: str | None = None,
):
    query = session.query(
        Aluno.turma,
        func.sum(Nota.faltas).label("total_faltas"),
        func.count(func.distinct(Aluno.id)).label("qtd_alunos")
    ).join(Nota)
    query = _apply_aluno_filters(query, turno, serie, turma, disciplina)
    query = query.group_by(Aluno.turma)
    
    results = query.all()
    processed = []
    for t, total, count in results:
        count = count or 1
        avg_faltas = round(float(total or 0) / count, 1)
        processed.append({"turma": t, "faltas": avg_faltas})
        
    processed.sort(key=lambda x: x["faltas"], reverse=True)
    processed = processed[:10]
    
    total_avg = round(sum(p["faltas"] for p in processed) / len(processed), 1) if processed else 0
    turma_critica = processed[0]["turma"] if processed else "-"

    return {
        "summary": {
            "main": {"label": "Média Geral de Faltas", "value": total_avg, "color": "error"},
            "secondary": {"label": "Turma Crítica", "value": turma_critica, "color": "warning"}
        },
        "data": processed
    }


def build_faltas_por_disciplina(
    session,
    turno: str | None = None,
    serie: str | None = None,
    turma: str | None = None,
    disciplina: str | None = None,
    trimestre: str | None = None,
):
    query = session.query(
        Nota.disciplina,
        func.sum(Nota.faltas).label("total_faltas"),
        func.count(func.distinct(Aluno.id)).label("qtd_alunos")
    ).join(Aluno)
    query = _apply_aluno_filters(query, turno, serie, turma, disciplina)
    query = query.group_by(Nota.disciplina)
    
    results = query.all()
    processed = []
    for d_nome, total, count in results:
        if not d_nome:
            continue
        count = count or 1
        avg_faltas = round(float(total or 0) / count, 1)
        processed.append({"disciplina": d_nome.upper(), "faltas": avg_faltas})
        
    processed.sort(key=lambda x: x["faltas"], reverse=True)
    
    critica = processed[0]["disciplina"] if processed else "-"
    media_geral = round(sum(p["faltas"] for p in processed) / len(processed), 1) if processed else 0
    
    return {
        "summary": {
            "main": {"label": "Matéria com Mais Faltas", "value": critica, "color": "error"},
            "secondary": {"label": "Média Geral de Faltas", "value": media_geral, "color": "warning"}
        },
        "data": processed
    }


def build_distribuicao_situacao(
    session,
    turno: str | None = None,
    serie: str | None = None,
    turma: str | None = None,
    disciplina: str | None = None,
    trimestre: str | None = None,
):
    query = session.query(
        Aluno.id,
        Aluno.nome,
        Aluno.turma,
        func.avg(Nota.total).label("media")
    ).join(Nota).group_by(Aluno.id, Aluno.nome, Aluno.turma)
    query = _apply_aluno_filters(query, turno, serie, turma, disciplina)
    results = query.all()
    
    aprovados = 0
    recuperacao = 0
    reprovados = 0
    
    for r in results:
        media = float(r.media or 0)
        if media >= 60.0:
            aprovados += 1
        elif media >= 40.0:
            recuperacao += 1
        else:
            reprovados += 1
            
    total = len(results) or 1
    pct_aprovados = round((aprovados / total) * 100, 1)
    
    data = []
    for r in results:
        media = float(r.media or 0)
        if media >= 60.0:
            sit = "APROVADO"
        elif media >= 40.0:
            sit = "RECUPERAÇÃO"
        else:
            sit = "REPROVADO"
        data.append({
            "nome": r.nome,
            "turma": r.turma,
            "media": round(media, 1),
            "situacao": sit
        })
        
    return {
        "summary": {
            "main": {"label": "Taxa de Aprovação", "value": f"{pct_aprovados}%", "color": "success"},
            "secondary": {"label": "Em Recuperação", "value": recuperacao, "color": "warning"},
            "extra": {"label": "Reprovados", "value": reprovados, "color": "danger"}
        },
        "data": data
    }


def build_evolucao_trimestres(
    session,
    turno: str | None = None,
    serie: str | None = None,
    turma: str | None = None,
    disciplina: str | None = None,
    trimestre: str | None = None,
):
    query = session.query(
        func.avg(Nota.trimestre1).label("t1"),
        func.avg(Nota.trimestre2).label("t2"),
        func.avg(Nota.trimestre3).label("t3")
    ).join(Aluno)
    query = _apply_aluno_filters(query, turno, serie, turma, disciplina)
    
    first_res = query.first()
    t1, t2, t3 = first_res if first_res else (0, 0, 0)
    t1_val = round(float(t1 or 0), 1)
    t2_val = round(float(t2 or 0), 1)
    t3_val = round(float(t3 or 0), 1)
    
    query_turmas = session.query(
        Aluno.turma,
        func.avg(Nota.trimestre1).label("t1"),
        func.avg(Nota.trimestre2).label("t2"),
        func.avg(Nota.trimestre3).label("t3")
    ).join(Nota).group_by(Aluno.turma)
    query_turmas = _apply_aluno_filters(query_turmas, turno, serie, turma, disciplina)
    results = query_turmas.all()
    
    data = []
    for t, vt1, vt2, vt3 in results:
        data.append({
            "turma": t,
            "t1": round(float(vt1 or 0), 1),
            "t2": round(float(vt2 or 0), 1),
            "t3": round(float(vt3 or 0), 1)
        })
        
    data.sort(key=lambda x: x["turma"])
    
    return {
        "summary": {
            "main": {"label": "Média T1", "value": t1_val, "color": "info"},
            "secondary": {"label": "Média T2", "value": t2_val, "color": "primary"},
            "extra": {"label": "Média T3", "value": t3_val, "color": "success"}
        },
        "data": data
    }



def build_melhores_medias(
    session,
    turno: str | None = None,
    serie: str | None = None,
    turma: str | None = None,
    disciplina: str | None = None,
    trimestre: str | None = None,
):
    query = session.query(Aluno.turma, Aluno.turno, func.avg(Nota.total).label("media")).join(Nota)
    query = _apply_aluno_filters(query, turno, serie, turma, disciplina)
    query = query.group_by(Aluno.turma, Aluno.turno).order_by(func.avg(Nota.total).desc()).limit(10)
    
    results = query.all()
    best_turma = results[0].turma if results else "-"
    
    avg_school_q = session.query(func.avg(Nota.total)).join(Aluno)
    avg_school_q = _apply_aluno_filters(avg_school_q, turno, serie, turma, disciplina)
    avg_perf = avg_school_q.scalar() or 0
    
    return {
        "summary": {
            "main": {"label": "Melhor Turma", "value": best_turma, "color": "success"},
            "secondary": {"label": "Média Geral", "value": round(float(avg_perf), 1), "color": "primary"}
        },
        "data": [
            {"turma": t, "turno": tn, "media": round(float(m or 0), 2)}
            for t, tn, m in results
        ]
    }


def build_alunos_em_risco(
    session,
    turno: str | None = None,
    serie: str | None = None,
    turma: str | None = None,
    disciplina: str | None = None,
    trimestre: str | None = None,
):
    from flask import g
    stage = get_grading_stage(session, getattr(g, "tenant_id", None), getattr(g, "academic_year_id", None))
    threshold = stage["threshold"]

    query = session.query(
        Aluno.nome,
        Aluno.turma,
        func.avg(Nota.total).label("media"),
        func.sum(Nota.faltas).label("total_faltas")
    ).join(Nota)

    query = _apply_aluno_filters(query, turno, serie, turma, disciplina)
    query = (
        query.group_by(Aluno.id, Aluno.nome, Aluno.turma)
        .having(func.avg(Nota.total) < float(threshold))
        .order_by(func.avg(Nota.total))
        .limit(20)
    )

    results = query.all()

    return {
        "summary": {
            "main": {"label": "Alunos em Risco", "value": len(results), "color": "error"},
            "secondary": {"label": "Corte", "value": f"< {threshold} pts ({stage['trimester']})", "color": "info"}
        },
        "data": [
            {"nome": r.nome, "turma": r.turma, "media": round(float(r.media or 0), 1), "faltas": int(r.total_faltas or 0)}
            for r in results
        ]
    }


def build_disciplinas_notas_baixas(
    session,
    turno: str | None = None,
    serie: str | None = None,
    turma: str | None = None,
    disciplina: str | None = None,
    trimestre: str | None = None,
):
    normalizacao = {
        "ARTES": "ARTE",
        "INGLÊS": "LÍNGUA INGLESA",
        "INGLES": "LÍNGUA INGLESA",
        "LÍNGUA PORTUGUÊSA": "LÍNGUA PORTUGUESA",
        "LINGUA PORTUGUESA": "LÍNGUA PORTUGUESA",
    }

    query = session.query(
        Nota.disciplina,
        func.sum(Nota.total).label("soma"),
        func.count(Nota.id).label("qtd"),
    ).join(Aluno)
    query = _apply_aluno_filters(query, turno, serie, turma, disciplina)
    query = query.group_by(Nota.disciplina)

    acumulado = {}
    for d_nome, soma, qtd in query.all():
        if not d_nome:
            continue
        d_norm = normalizacao.get(d_nome.upper(), d_nome.upper())
        bucket = acumulado.setdefault(d_norm, {"soma": 0.0, "qtd": 0})
        bucket["soma"] += float(soma or 0)
        bucket["qtd"] += int(qtd or 0)

    result = []
    for d_nome, val in acumulado.items():
        if not val["qtd"]:
            continue
        media = val["soma"] / val["qtd"]
        result.append({"disciplina": d_nome, "media": round(media, 1)})

    result.sort(key=lambda x: x["media"])
    critica = result[0]["disciplina"] if result else "-"
    
    return {
        "summary": {
            "main": {"label": "Disciplina Crítica", "value": critica, "color": "error"},
            "secondary": {"label": "Média", "value": result[0]["media"] if result else 0, "color": "warning"}
        },
        "data": result
    }


def build_melhores_alunos(
    session,
    turno: str | None = None,
    serie: str | None = None,
    turma: str | None = None,
    disciplina: str | None = None,
    trimestre: str | None = None,
):
    query = session.query(
        Aluno.nome,
        Aluno.turma,
        Aluno.turno,
        func.avg(Nota.total).label("media"),
    ).join(Nota)
    query = _apply_aluno_filters(query, turno, serie, turma, disciplina)
    query = (
        query.group_by(Aluno.id, Aluno.nome, Aluno.turma, Aluno.turno)
        .order_by(func.avg(Nota.total).desc())
        .limit(10)
    )
    results = query.all()
    data = [
        {
            "nome": r.nome,
            "turma": r.turma,
            "turno": r.turno,
            "media": round(float(r.media or 0), 2),
        }
        for r in results
    ]
    
    best_student = data[0]["nome"] if data else "-"
    
    return {
        "summary": {
            "main": {"label": "Melhor Aluno(a)", "value": best_student, "color": "success"},
            "secondary": {"label": "Média", "value": data[0]["media"] if data else 0, "color": "primary"}
        },
        "data": data
    }


def build_performance_heatmap(
    session,
    turno: str | None = None,
    serie: str | None = None,
    turma: str | None = None,
    disciplina: str | None = None,
    trimestre: str | None = None,
):
    query = session.query(
        Nota.disciplina,
        Aluno.turma,
        func.avg(Nota.total).label("media"),
    ).join(Aluno)
    query = _apply_aluno_filters(query, turno, serie, turma, disciplina)
    results = query.group_by(Nota.disciplina, Aluno.turma).all()
    
    processed = []
    for r in results:
        processed.append({
            "disciplina": r.disciplina.upper() if r.disciplina else "N/A",
            "turma": r.turma,
            "media": round(float(r.media or 0), 1)
        })
        
    return {
        "summary": {
            "main": {"label": "Turmas", "value": len(set(p["turma"] for p in processed)), "color": "info"},
            "secondary": {"label": "Disciplinas", "value": len(set(p["disciplina"] for p in processed)), "color": "secondary"}
        },
        "data": processed
    }


def build_attendance_grade_correlation(
    session,
    turno: str | None = None,
    serie: str | None = None,
    turma: str | None = None,
    disciplina: str | None = None,
    trimestre: str | None = None,
):
    query = session.query(
        Aluno.nome,
        Aluno.turma,
        func.sum(Nota.faltas).label("total_faltas"),
        func.avg(Nota.total).label("media_geral")
    ).join(Nota).group_by(Aluno.id, Aluno.nome, Aluno.turma)
    
    query = _apply_aluno_filters(query, turno, serie, turma, disciplina)
    results = query.having(func.avg(Nota.total) > 0).limit(300).all()
    
    data = [
        {
            "name": r.nome,
            "turma": r.turma,
            "faltas": int(r.total_faltas or 0),
            "media": round(float(r.media_geral or 0), 1)
        }
        for r in results
    ]
    
    avg_f = sum(d["faltas"] for d in data) / len(data) if data else 0
    
    return {
        "summary": {
            "main": {"label": "Alunos Analisados", "value": len(data), "color": "info"},
            "secondary": {"label": "Média Faltas", "value": round(avg_f, 1), "color": "warning"}
        },
        "data": data
    }


def build_class_radar(
    session,
    turno: str | None = None,
    serie: str | None = None,
    turma: str | None = None,
    disciplina: str | None = None,
    trimestre: str | None = None,
):
    query = session.query(
        Aluno.turma,
        func.avg(Nota.total).label("media_geral"),
        func.avg(Nota.faltas).label("media_faltas")
    ).join(Nota)
    
    query = _apply_aluno_filters(query, turno, serie, turma, disciplina)
    results = query.group_by(Aluno.turma).limit(10).all()
    
    max_faltas = max((float(r.media_faltas or 0) for r in results), default=1) or 1
    data = [
        {
            "subject": r.turma,
            "Média Geral": round(float(r.media_geral or 0), 1),
            "Assiduidade": round(max(0, 100 * (1 - float(r.media_faltas or 0) / max_faltas)), 1),
        }
        for r in results
    ]
    
    return {
        "summary": {
            "main": {"label": "Turmas", "value": len(data), "color": "info"},
            "secondary": {"label": "Indicadores", "value": 2, "color": "secondary"}
        },
        "data": data
    }


def build_radar_abandono(
    session,
    turno: str | None = None,
    serie: str | None = None,
    turma: str | None = None,
    disciplina: str | None = None,
    trimestre: str | None = None,
):
    from flask import g
    stage = get_grading_stage(session, getattr(g, "tenant_id", None), getattr(g, "academic_year_id", None))
    threshold = stage["threshold"]

    query = session.query(
        Aluno.nome,
        Aluno.turma,
        func.avg(Nota.total).label("media"),
        func.sum(Nota.faltas).label("total_faltas"),
        func.avg(Nota.trimestre1).label("t1_avg"),
        func.avg(Nota.trimestre2).label("t2_avg"),
    ).join(Nota)

    query = _apply_aluno_filters(query, turno, serie, turma, disciplina)
    query = (
        query.group_by(Aluno.id, Aluno.nome, Aluno.turma)
        .having(func.avg(Nota.total) < float(threshold))
        .having(func.sum(Nota.faltas) > 15)
        .order_by(func.sum(Nota.faltas).desc())
        .limit(20)
    )

    results = query.all()
    data = []
    for r in results:
        media = float(r.media or 0)
        faltas = int(r.total_faltas or 0)
        t1 = float(r.t1_avg) if r.t1_avg is not None else None
        t2 = float(r.t2_avg) if r.t2_avg is not None else None

        # Risco baseado em: nota vs threshold (50%), faltas (30%), tendência (20%)
        grade_factor = min(0.5, max(0, (threshold - media) / max(1, threshold)) * 0.5)
        absence_factor = min(0.3, (faltas / 50.0) * 0.3)
        trend_factor = 0.2 if (t2 is not None and t1 is not None and t2 < t1) else 0.0
        risco = round(min(1.0, grade_factor + absence_factor + trend_factor), 2)

        data.append({
            "nome": r.nome,
            "turma": r.turma,
            "media": round(media, 1),
            "faltas": faltas,
            "risco": risco,
        })

    data.sort(key=lambda x: -x["risco"])

    return {
        "summary": {
            "main": {"label": "Alunos Críticos", "value": len(data), "color": "error"},
            "secondary": {"label": "Critério", "value": f"< {threshold} pts e faltas > 15", "color": "warning"}
        },
        "data": data
    }


def build_comparativo_eficiencia(
    session,
    turno: str | None = None,
    serie: str | None = None,
    turma: str | None = None,
    disciplina: str | None = None,
    trimestre: str | None = None,
):
    q_global = session.query(func.avg(Nota.total)).join(Aluno)
    q_global = _apply_aluno_filters(q_global, turno, serie, None, disciplina)
    global_avg = float(q_global.scalar() or 0)
    
    q_turmas = session.query(Aluno.turma, func.avg(Nota.total).label("media")).join(Nota)
    q_turmas = _apply_aluno_filters(q_turmas, turno, serie, turma, disciplina)
    results = q_turmas.group_by(Aluno.turma).all()
    
    data = []
    for r in results:
        m_turma = float(r.media or 0)
        data.append({
            "turma": r.turma,
            "media": round(m_turma, 1),
            "delta": round(m_turma - global_avg, 1)
        })
    
    data.sort(key=lambda x: x["media"], reverse=True)
    
    return {
        "summary": {
            "main": {"label": "Média Geral", "value": round(global_avg, 1), "color": "info"},
            "secondary": {"label": "Turmas", "value": len(data), "color": "primary"}
        },
        "data": data
    }


def build_top_movers(
    session,
    turno: str | None = None,
    serie: str | None = None,
    turma: str | None = None,
    disciplina: str | None = None,
    trimestre: str | None = None,
):
    # Determinar qual transição usar com base no filtro de trimestre
    if trimestre == "2":
        # T1 → T2
        delta_expr = Nota.trimestre2 - Nota.trimestre1
        filter_expr = [Nota.trimestre1.isnot(None), Nota.trimestre2.isnot(None)]
        label = "T1 → T2"
    elif trimestre == "3":
        # T2 → T3
        delta_expr = Nota.trimestre3 - Nota.trimestre2
        filter_expr = [Nota.trimestre2.isnot(None), Nota.trimestre3.isnot(None)]
        label = "T2 → T3"
    else:
        # Auto: usa a transição mais recente disponível via CASE
        from sqlalchemy import and_
        delta_expr = case(
            (and_(Nota.trimestre3.isnot(None), Nota.trimestre2.isnot(None)),
             Nota.trimestre3 - Nota.trimestre2),
            else_=Nota.trimestre2 - Nota.trimestre1,
        )
        filter_expr = [Nota.trimestre1.isnot(None), Nota.trimestre2.isnot(None)]
        label = "Mais recente"

    query = session.query(
        Aluno.nome,
        Aluno.turma,
        func.avg(delta_expr).label("delta_avg"),
    ).join(Nota)

    query = _apply_aluno_filters(query, turno, serie, turma, disciplina)
    query = query.filter(*filter_expr)
    query = query.group_by(Aluno.id, Aluno.nome, Aluno.turma)
    query = query.order_by(func.abs(func.avg(delta_expr)).desc()).limit(20)

    results = query.all()
    data = [
        {"nome": r.nome, "turma": r.turma, "delta": round(float(r.delta_avg or 0), 1)}
        for r in results
    ]

    max_rise = max([d["delta"] for d in data if d["delta"] > 0], default=0)
    max_drop = min([d["delta"] for d in data if d["delta"] < 0], default=0)

    return {
        "summary": {
            "main": {"label": "Maior Evolução", "value": f"+{max_rise}", "color": "success"},
            "secondary": {"label": "Maior Queda", "value": f"{max_drop}", "color": "error"},
            "extra": {"label": "Transição", "value": label, "color": "info"},
        },
        "data": data
    }


# Mapeamento trimestre → (coluna, máximo de pontos, threshold 50%)
_TRIM_CONFIG = {
    "1": (Nota.trimestre1, 30, 15),
    "2": (Nota.trimestre2, 30, 15),
    "3": (Nota.trimestre3, 40, 20),
}


def build_alunos_abaixo_trimestre(
    session,
    turno: str | None = None,
    serie: str | None = None,
    turma: str | None = None,
    disciplina: str | None = None,
    trimestre: str | None = None,
):
    """Lista alunos com nota inferior a 50% dos pontos distribuídos no trimestre selecionado.

    Sem filtro de trimestre usa Nota.total com threshold de 50 pts.
    Com filtro: T1 < 15, T2 < 15, T3 < 20.
    """
    if trimestre and trimestre in _TRIM_CONFIG:
        col, max_pts, threshold = _TRIM_CONFIG[trimestre]
        trim_label = f"{trimestre}º Trimestre (máx. {max_pts} pts)"
    else:
        col, max_pts, threshold = Nota.total, 100, 50
        trim_label = "Total de Pontos"

    query = session.query(
        Aluno.nome,
        Aluno.turma,
        Aluno.turno,
        Nota.disciplina,
        col.label("nota"),
    ).join(Nota, Nota.aluno_id == Aluno.id)

    query = query.filter(col.isnot(None), col < threshold)
    query = _apply_aluno_filters(query, turno, serie, turma, disciplina)
    query = query.order_by(Aluno.turma, Aluno.nome, Nota.disciplina)

    dados = [
        {
            "nome":       nome,
            "turma":      t,
            "turno":      tn,
            "disciplina": disc,
            "nota":       round(float(nota), 1),
            "max_pts":    max_pts,
            "threshold":  threshold,
            "deficit":    round(threshold - float(nota), 1),
        }
        for nome, t, tn, disc, nota in query.all()
    ]

    alunos_unicos = len({r["nome"] for r in dados})

    return {
        "summary": {
            "main":      {"label": "Registros abaixo da média", "value": len(dados),     "color": "error"},
            "secondary": {"label": "Alunos distintos",          "value": alunos_unicos,  "color": "warning"},
            "extra":     {"label": "Período analisado",         "value": trim_label,     "color": "info"},
        },
        "data": dados,
    }


def build_ocorrencias_reincidentes(
    session,
    turno: str | None = None,
    serie: str | None = None,
    turma: str | None = None,
    disciplina: str | None = None,
    trimestre: str | None = None,
):
    from ...models import Ocorrencia

    query = (
        session.query(
            Aluno.nome,
            Aluno.turma,
            Aluno.turno,
            func.count(Ocorrencia.id).label("total"),
            func.sum(case(
                (Ocorrencia.gravidade.in_(["GRAVE", "GRAVISSIMA"]), 1), else_=0
            )).label("graves"),
            func.sum(case(
                (Ocorrencia.resolvida == False, 1), else_=0  # noqa: E712
            )).label("pendentes"),
            func.max(Ocorrencia.data_registro).label("ultima"),
        )
        .join(Ocorrencia, Ocorrencia.aluno_id == Aluno.id)
        .filter(Aluno.status.is_(None))
    )
    query = _apply_aluno_filters(query, turno, serie, turma, None)
    query = (
        query.group_by(Aluno.id, Aluno.nome, Aluno.turma, Aluno.turno)
        .having(func.count(Ocorrencia.id) >= 2)
        .order_by(
            func.sum(case(
                (Ocorrencia.gravidade.in_(["GRAVE", "GRAVISSIMA"]), 1), else_=0
            )).desc(),
            func.count(Ocorrencia.id).desc(),
        )
        .limit(30)
    )

    dados = [
        {
            "nome": r.nome,
            "turma": r.turma,
            "turno": r.turno,
            "total": int(r.total),
            "graves": int(r.graves),
            "pendentes": int(r.pendentes),
            "ultima": r.ultima.strftime("%d/%m/%Y") if r.ultima else "-",
        }
        for r in query.all()
    ]

    return {
        "summary": {
            "main": {"label": "Alunos reincidentes", "value": len(dados), "color": "error"},
            "secondary": {
                "label": "Graves/Gravíssimas",
                "value": sum(d["graves"] for d in dados),
                "color": "warning",
            },
        },
        "data": dados,
    }


def build_comunicados_engajamento(
    session,
    turno: str | None = None,
    serie: str | None = None,
    turma: str | None = None,
    disciplina: str | None = None,
    trimestre: str | None = None,
):
    from flask import g
    from ...models import Comunicado
    from ...models.comunicado_leitura import ComunicadoLeitura
    from ...models import Usuario

    tenant_id = getattr(g, "tenant_id", None)
    year_id = getattr(g, "academic_year_id", None)

    # Subquery: contagem de leituras por comunicado (JOIN com Comunicado
    # para garantir isolamento de tenant — ComunicadoLeitura não tem tenant_id)
    leituras_sq = (
        session.query(
            ComunicadoLeitura.comunicado_id,
            func.count(ComunicadoLeitura.id).label("lidos"),
        )
        .join(Comunicado, ComunicadoLeitura.comunicado_id == Comunicado.id)
        .filter(Comunicado.tenant_id == tenant_id)
        .group_by(ComunicadoLeitura.comunicado_id)
        .subquery()
    )

    query = (
        session.query(
            Comunicado.id,
            Comunicado.titulo,
            Comunicado.target_type,
            Comunicado.target_value,
            Comunicado.data_envio,
            func.coalesce(leituras_sq.c.lidos, 0).label("lidos"),
        )
        .outerjoin(leituras_sq, leituras_sq.c.comunicado_id == Comunicado.id)
    )

    if tenant_id:
        query = query.filter(Comunicado.tenant_id == tenant_id)
    if year_id:
        query = query.filter(Comunicado.academic_year_id == year_id)

    query = query.filter(Comunicado.arquivado == False)  # noqa: E712
    query = query.order_by(Comunicado.data_envio.desc()).limit(30)

    # Calcular destinatários estimados
    total_usuarios = 1
    if tenant_id:
        total_usuarios = session.query(func.count(Usuario.id)).filter(
            Usuario.tenant_id == tenant_id,
            Usuario.is_active == True,  # noqa: E712
            Usuario.deleted_at.is_(None),
        ).scalar() or 1

    dados = []
    for r in query.all():
        if r.target_type == "TODOS":
            destinatarios = total_usuarios
        elif r.target_type == "TURMA":
            dest_count = session.query(func.count(Aluno.id)).filter(
                Aluno.turma == r.target_value,
            )
            if tenant_id:
                dest_count = dest_count.filter(Aluno.tenant_id == tenant_id)
            destinatarios = dest_count.scalar() or 1
        else:
            destinatarios = 1

        taxa = min(100, round(100 * int(r.lidos) / max(1, destinatarios)))
        dados.append({
            "titulo": r.titulo or "(sem título)",
            "target": f"{r.target_type}: {r.target_value or 'Todos'}",
            "data_envio": r.data_envio.strftime("%d/%m/%Y") if r.data_envio else "-",
            "lidos": int(r.lidos),
            "destinatarios": destinatarios,
            "taxa_leitura": taxa,
        })

    media_taxa = round(sum(d["taxa_leitura"] for d in dados) / max(1, len(dados)))

    return {
        "summary": {
            "main": {"label": "Comunicados analisados", "value": len(dados), "color": "info"},
            "secondary": {
                "label": "Taxa média de leitura",
                "value": f"{media_taxa}%",
                "color": "success" if media_taxa > 60 else "warning",
            },
        },
        "data": dados,
    }


REPORT_BUILDERS = {
    "turmas-mais-faltas":          build_turmas_mais_faltas,
    "melhores-medias":           build_melhores_medias,
    "alunos-em-risco":           build_alunos_em_risco,
    "disciplinas-notas-baixas":  build_disciplinas_notas_baixas,
    "melhores-alunos":           build_melhores_alunos,
    "performance-heatmap":       build_performance_heatmap,
    "attendance-correlation":    build_attendance_grade_correlation,
    "class-radar":               build_class_radar,
    "radar-abandono":            build_radar_abandono,
    "comparativo-eficiencia":    build_comparativo_eficiencia,
    "top-movers":                build_top_movers,
    "alunos-abaixo-trimestre":     build_alunos_abaixo_trimestre,
    "ocorrencias-reincidentes":    build_ocorrencias_reincidentes,
    "comunicados-engajamento":     build_comunicados_engajamento,
    "faltas-por-disciplina":       build_faltas_por_disciplina,
    "distribuicao-situacao":       build_distribuicao_situacao,
    "evolucao-trimestres":         build_evolucao_trimestres,
}


def register(parent: Blueprint) -> None:
    bp = Blueprint("relatorios", __name__)

    @bp.get("/relatorios/<string:slug>")
    @jwt_required()
    @limiter.limit("300 per hour")
    @require_roles("admin", "super_admin", "coordenador", "diretor", "orientador", "professor")
    @cache_response(timeout=300, key_prefix="relatorios")
    def get_relatorio(slug: str):
        builder = REPORT_BUILDERS.get(slug)
        if not builder:
            return jsonify({"error": "Relatório não encontrado"}), 404

        def _cap(val, max_len=50):
            return (val or "")[:max_len] or None

        params = {
            "turno":      _cap(request.args.get("turno"),      20),
            "serie":      _cap(request.args.get("serie"),       5),
            "turma":      _cap(request.args.get("turma"),      30),
            "disciplina": _cap(request.args.get("disciplina"), 50),
            "trimestre":  _cap(request.args.get("trimestre"),   1),
        }
        user_id = int(get_jwt_identity())

        with session_scope() as session:
            try:
                result = builder(session, **params)
                data_list = result["data"] if isinstance(result, dict) and "data" in result else result
                
                export_format = request.args.get("format")
                if export_format in ("csv", "xlsx") and data_list:
                    import io
                    import csv
                    from flask import send_file
                    
                    if not isinstance(data_list, list) or len(data_list) == 0 or not isinstance(data_list[0], dict):
                        return jsonify({"error": "Nenhum dado para exportar"}), 400
                        
                    keys = list(data_list[0].keys())

                    log_action(
                        session,
                        user_id,
                        "EXPORT_RELATORIO",
                        "Relatorio",
                        slug,
                        details={
                            "format": export_format,
                            "row_count": len(data_list),
                            "filters": params,
                        },
                    )
                    
                    if export_format == "csv":
                        si = io.StringIO()
                        writer = csv.DictWriter(si, fieldnames=keys)
                        writer.writeheader()
                        writer.writerows(
                            [{key: _export_safe_cell(row.get(key)) for key in keys} for row in data_list]
                        )
                        
                        response = Response(
                            si.getvalue(),
                            mimetype="text/csv",
                            headers={"Content-Disposition": f'attachment; filename="{_export_filename(slug)}.csv"'}
                        )
                        return _apply_download_headers(response)
                        
                    elif export_format == "xlsx":
                        import openpyxl
                        wb = openpyxl.Workbook()
                        ws = wb.active
                        ws.title = "Relatório"
                        
                        ws.append(keys)
                        for row in data_list:
                            ws.append([_export_safe_cell(row.get(key)) for key in keys])
                            
                        output = io.BytesIO()
                        wb.save(output)
                        output.seek(0)
                        
                        response = send_file(
                            output,
                            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            as_attachment=True,
                            download_name=f"{_export_filename(slug)}.xlsx"
                        )
                        return _apply_download_headers(response)

                if isinstance(result, dict) and "data" in result:
                    return jsonify({
                        "relatorio": slug,
                        "dados": result["data"],
                        "summary": result.get("summary")
                    })
                return jsonify({"relatorio": slug, "dados": result})
            except Exception as e:
                logger.error(f"Error building report {slug}: {e}")
                return jsonify({"error": "Falha ao processar relatório"}), 500

    parent.register_blueprint(bp)
