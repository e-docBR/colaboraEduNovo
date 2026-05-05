"""Endpoints para gráficos dinâmicos do dashboard."""
from __future__ import annotations

from datetime import datetime
from typing import Callable

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from sqlalchemy import func
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
    @cache_response(timeout=600, key_prefix="graficos")
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
    for disciplina, soma, quantidade in query.all():
        disciplina_normalizada = _normalize_disciplina(disciplina)
        bucket = agregados.setdefault(disciplina_normalizada, {"soma": 0.0, "quantidade": 0})
        bucket["soma"] += float(soma or 0.0)
        bucket["quantidade"] += int(quantidade or 0)

    resultados = []
    for disciplina_normalizada, valores in agregados.items():
        media_final = valores["soma"] / valores["quantidade"] if valores["quantidade"] else 0.0
        resultados.append({"disciplina": disciplina_normalizada, "media": round(media_final, 2)})

    resultados.sort(key=lambda item: item["media"], reverse=True)
    return resultados


def _turmas_trimestre(
    session,
    turno: str | None,
    serie: str | None,
    turma: str | None,
    _trimestre: str | None,
    disciplina: str | None,
):
    results: list[dict[str, object]] = []
    for trimestre, column in TRIMESTRE_COLUMNS.items():
        query = session.query(func.avg(column))
        query = query.join(Aluno)
        query = _apply_common_filters(query, turno, serie, turma, disciplina)
        media = query.scalar()
        results.append({"trimestre": f"{trimestre}º", "media": round(float(media), 2) if media else 0.0})
    return results


def _situacao_distribuicao(
    session,
    turno: str | None,
    serie: str | None,
    turma: str | None,
    _trimestre: str | None,
    _disciplina: str | None,
):
    # Conta alunos únicos por situação
    # Prioridade: Status do Aluno (Desistente, Transferido) > Status das Notas (Reprovado, Aprovado)
    
    # Busca todas as notas e o status do aluno
    query = session.query(Nota.aluno_id, Nota.situacao, Aluno.status)
    query = query.join(Aluno, Nota.aluno_id == Aluno.id)
    query = _apply_common_filters(query, turno, serie, turma, None)
    
    aluno_grades_status: dict[int, set[str]] = {}
    aluno_special_status: dict[int, str] = {}
    
    STATUS_REPROVADO = {"REP", "REC", "REPROVADO"}
    STATUS_APROVADO = {"APR", "APROVADO", "AR", "ACC", "APCC"}
    
    for aluno_id, grade_situacao, student_status in query.all():
        if aluno_id not in aluno_grades_status:
            aluno_grades_status[aluno_id] = set()
        
        # Capture special status if present
        if student_status:
            aluno_special_status[aluno_id] = student_status
            
        if grade_situacao:
            aluno_grades_status[aluno_id].add(grade_situacao.upper())
            
    # Determinar status final de cada aluno
    final_counts: dict[str, int] = {}
    
    # Get all unique student IDs found
    all_student_ids = set(aluno_grades_status.keys())
    
    for aluno_id in all_student_ids:
        # 1. Special Status (Administrative)
        if aluno_id in aluno_special_status:
            status = aluno_special_status[aluno_id]
            # Normalize common terms if needed, or keep as is
            final_counts[status] = final_counts.get(status, 0) + 1
            continue
            
        # 2. Grade-based Status (Academic)
        status_set = aluno_grades_status[aluno_id]
        label = "Outros"
        
        if not status_set.isdisjoint(STATUS_REPROVADO):
            label = "Reprovado" # or Recuperação
        elif not status_set.isdisjoint(STATUS_APROVADO):
            label = "Aprovado"
            
        final_counts[label] = final_counts.get(label, 0) + 1
    
    return [
        {"situacao": label, "total": quantidade}
        for label, quantidade in sorted(final_counts.items())
    ]


def _faltas_por_turma(
    session,
    turno: str | None,
    serie: str | None,
    turma: str | None,
    _trimestre: str | None,
    _disciplina: str | None,
):
    query = (
        session.query(Aluno.turma, func.sum(Nota.faltas).label("faltas"))
        .join(Nota)
        .group_by(Aluno.turma)
        .order_by(func.sum(Nota.faltas).desc())
    )
    query = _apply_common_filters(query, turno, serie, turma, None)
    results = query.limit(10).all()
    return [
        {"turma": turma_nome, "faltas": int(faltas or 0)}
        for turma_nome, faltas in results
    ]


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
    for turma_nome, disciplina, media in query.all():
        disciplina_normalizada = _normalize_disciplina(disciplina)
        chave = (turma_nome, disciplina_normalizada)
        bucket = agregados.setdefault(chave, {"soma": 0.0, "quantidade": 0})
        bucket["soma"] += float(media or 0.0)
        bucket["quantidade"] += 1

    resultados = []
    for (turma_nome, disciplina_normalizada), valores in agregados.items():
        media_final = valores["soma"] / valores["quantidade"] if valores["quantidade"] else 0.0
        resultados.append(
            {
                "turma": turma_nome,
                "disciplina": disciplina_normalizada,
                "media": round(media_final, 2),
            }
        )

    resultados.sort(key=lambda item: (item["turma"], item["disciplina"]))
    return resultados


def _medias_por_trimestre(
    session,
    turno: str | None,
    serie: str | None,
    turma: str | None,
    _trimestre: str | None,
    disciplina: str | None,
):
    resultados: list[dict[str, object]] = []
    for trimestre_label, column in TRIMESTRE_COLUMNS.items():
        query = session.query(func.avg(column))
        query = query.join(Aluno)
        query = _apply_common_filters(query, turno, serie, turma, disciplina)
        media = query.scalar()
        resultados.append(
            {
                "trimestre": f"{trimestre_label}º",
                "media": round(float(media), 2) if media else 0.0,
            }
        )
    return resultados


def _gauss_escola(
    session: Session,
    turno: str | None,
    serie: str | None,
    turma: str | None,
    trimestre: str | None,
    disciplina: str | None,
):
    column = _resolve_trimestre_column(trimestre)
    query = session.query(column)
    query = query.join(Aluno)
    query = _apply_common_filters(query, turno, serie, turma, disciplina)
    
    notas = [n[0] for n in query.all() if n[0] is not None]
    
    # Distribuição em faixas de 0 a 100
    faixas = [
        {"faixa": f"{i}-{i+10}", "alunos": 0}
        for i in range(0, 100, 10)
    ]
    
    for nota in notas:
        idx = min(int(nota // 10), 9)
        faixas[idx]["alunos"] += 1
        
    return faixas


def _correlacao_frequencia(
    session: Session,
    turno: str | None,
    serie: str | None,
    turma: str | None,
    _trimestre: str | None,
    disciplina: str | None,
):
    # Correlação entre média global (ou da disciplina) e presença
    query = session.query(
        Aluno.id,
        func.avg(Nota.total).label("media"),
        func.avg(Nota.faltas).label("faltas")
    )
    query = query.join(Nota)
    query = _apply_common_filters(query, turno, serie, turma, disciplina)
    query = query.group_by(Aluno.id)
    
    results = []
    for _, media, faltas in query.all():
        # Cálculo simples de frequência: 100% - (faltas / 20 * 100)
        # Assumindo 20 dias letivos por disciplina/mês ou algo similar para visualização
        freq = max(0, 100 - (float(faltas or 0) * 2)) 
        results.append({
            "media": round(float(media or 0), 1),
            "frequencia": round(freq, 1)
        })
    return results


def _evolucao_turnos(
    session: Session,
    _turno: str | None,
    serie: str | None,
    _turma: str | None,
    _trimestre: str | None,
    disciplina: str | None,
):
    # Comparativo Matutino vs Vespertino ao longo dos trimestres
    periodos = ["1º", "2º", "3º"]
    results = []
    
    for i, trimestre_label in enumerate(periodos):
        col = TRIMESTRE_COLUMNS[str(i+1)]
        
        # Matutino
        q_mat = session.query(func.avg(col)).join(Aluno).filter(Aluno.turno == "Matutino")
        q_mat = _apply_common_filters(q_mat, None, serie, None, disciplina)
        m_mat = q_mat.scalar() or 0
        
        # Vespertino
        q_vesp = session.query(func.avg(col)).join(Aluno).filter(Aluno.turno == "Vespertino")
        q_vesp = _apply_common_filters(q_vesp, None, serie, None, disciplina)
        m_vesp = q_vesp.scalar() or 0
        
        results.append({
            "periodo": trimestre_label,
            "matutino": round(float(m_mat), 1),
            "vespertino": round(float(m_vesp), 1)
        })
        
    return results


GRAPH_BUILDERS: dict[str, GraphBuilder] = {
    "disciplinas-medias": _disciplinas_medias,
    "turmas-trimestre": _turmas_trimestre,
    "situacao-distribuicao": _situacao_distribuicao,
    "faltas-por-turma": _faltas_por_turma,
    "heatmap-disciplinas": _heatmap_disciplinas,
    "medias-por-trimestre": _medias_por_trimestre,
    "gauss-escola": _gauss_escola,
    "correlacao-frequencia": _correlacao_frequencia,
    "evolucao-turnos": _evolucao_turnos,
}
