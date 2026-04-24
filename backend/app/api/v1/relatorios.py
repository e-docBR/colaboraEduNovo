"""Relatório endpoints."""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, jwt_required
from sqlalchemy import func
from loguru import logger

from ...core.database import session_scope
from ...core.cache import cache_response
from ...models import Aluno, Nota


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
            query = query.filter(Aluno.turma.ilike(f"{serie_limpa}%"))
    if disciplina:
        query = query.filter(func.upper(Nota.disciplina) == disciplina.strip().upper())
    return query


def build_turmas_mais_faltas(
    session,
    turno: str | None = None,
    serie: str | None = None,
    turma: str | None = None,
    disciplina: str | None = None,
):
    query = session.query(Aluno.turma, func.sum(Nota.faltas).label("faltas")).join(Nota)
    query = _apply_aluno_filters(query, turno, serie, turma, disciplina)
    query = query.group_by(Aluno.turma).order_by(func.sum(Nota.faltas).desc()).limit(10)
    
    results = query.all()
    total_faltas = sum(int(r.faltas or 0) for r in results)
    turma_critica = results[0].turma if results else "-"

    return {
        "summary": {
            "main": {"label": "Total de Faltas", "value": total_faltas, "color": "error"},
            "secondary": {"label": "Turma Crítica", "value": turma_critica, "color": "warning"}
        },
        "data": [
            {"turma": t, "faltas": int(f or 0)}
            for t, f in results
        ]
    }


def build_melhores_medias(
    session,
    turno: str | None = None,
    serie: str | None = None,
    turma: str | None = None,
    disciplina: str | None = None,
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
):
    query = session.query(
        Aluno.nome, 
        Aluno.turma, 
        func.avg(Nota.total).label("media"),
        func.sum(Nota.faltas).label("total_faltas")
    ).join(Nota)
    
    query = _apply_aluno_filters(query, turno, serie, turma, disciplina)
    query = (
        query.group_by(Aluno.id, Aluno.nome, Aluno.turma)
        .having(func.avg(Nota.total) < 50.0)
        .order_by(func.avg(Nota.total))
        .limit(20)
    )
    
    results = query.all()
    
    return {
        "summary": {
            "main": {"label": "Alunos em Risco", "value": len(results), "color": "error"},
            "secondary": {"label": "Nota de Corte", "value": "< 50.0", "color": "info"}
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
        if not d_nome: continue
        d_norm = normalizacao.get(d_nome.upper(), d_nome.upper())
        bucket = acumulado.setdefault(d_norm, {"soma": 0.0, "qtd": 0})
        bucket["soma"] += float(soma or 0)
        bucket["qtd"] += int(qtd or 0)

    result = []
    for d_nome, val in acumulado.items():
        if not val["qtd"]: continue
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
):
    query = session.query(
        Aluno.turma,
        func.avg(Nota.total).label("media_geral"),
        func.avg(Nota.faltas).label("media_faltas")
    ).join(Nota)
    
    query = _apply_aluno_filters(query, turno, serie, turma, disciplina)
    results = query.group_by(Aluno.turma).limit(10).all()
    
    data = [
        {
            "subject": r.turma,
            "Média Geral": round(float(r.media_geral or 0), 1),
            "Assiduidade": max(0, 100 - (float(r.media_faltas or 0) * 2))
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
):
    query = session.query(
        Aluno.nome,
        Aluno.turma,
        func.avg(Nota.total).label("media"),
        func.sum(Nota.faltas).label("total_faltas")
    ).join(Nota)
    
    query = _apply_aluno_filters(query, turno, serie, turma, disciplina)
    query = (
        query.group_by(Aluno.id, Aluno.nome, Aluno.turma)
        .having(func.avg(Nota.total) < 50.0)
        .having(func.sum(Nota.faltas) > 15)
        .order_by(func.sum(Nota.faltas).desc())
        .limit(20)
    )
    
    results = query.all()
    data = [
        {
            "nome": r.nome,
            "turma": r.turma,
            "media": round(float(r.media or 0), 1),
            "faltas": int(r.total_faltas or 0),
            "risco": 0.95
        }
        for r in results
    ]
    
    return {
        "summary": {
            "main": {"label": "Alunos Críticos", "value": len(data), "color": "error"},
            "secondary": {"label": "Critério", "value": "Faltas > 15", "color": "warning"}
        },
        "data": data
    }


def build_comparativo_eficiencia(
    session,
    turno: str | None = None,
    serie: str | None = None,
    turma: str | None = None,
    disciplina: str | None = None,
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
):
    query = session.query(
        Aluno.nome,
        Aluno.turma,
        func.avg(Nota.trimestre2 - Nota.trimestre1).label("delta_avg")
    ).join(Nota)
    
    query = _apply_aluno_filters(query, turno, serie, turma, disciplina)
    query = query.filter(Nota.trimestre1.isnot(None), Nota.trimestre2.isnot(None))
    query = query.group_by(Aluno.id, Aluno.nome, Aluno.turma)
    query = query.order_by(func.abs(func.avg(Nota.trimestre2 - Nota.trimestre1)).desc()).limit(20)
    
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
            "secondary": {"label": "Maior Queda", "value": f"{max_drop}", "color": "error"}
        },
        "data": data
    }


REPORT_BUILDERS = {
    "turmas-mais-faltas": build_turmas_mais_faltas,
    "melhores-medias": build_melhores_medias,
    "alunos-em-risco": build_alunos_em_risco,
    "disciplinas-notas-baixas": build_disciplinas_notas_baixas,
    "melhores-alunos": build_melhores_alunos,
    "performance-heatmap": build_performance_heatmap,
    "attendance-correlation": build_attendance_grade_correlation,
    "class-radar": build_class_radar,
    "radar-abandono": build_radar_abandono,
    "comparativo-eficiencia": build_comparativo_eficiencia,
    "top-movers": build_top_movers,
}


def register(parent: Blueprint) -> None:
    bp = Blueprint("relatorios", __name__)

    @bp.get("/relatorios/<string:slug>")
    @jwt_required()
    @cache_response(timeout=300, key_prefix="relatorios")
    def get_relatorio(slug: str):
        if "aluno" in (get_jwt().get("roles") or []):
            return jsonify({"error": "Acesso restrito"}), 403
            
        builder = REPORT_BUILDERS.get(slug)
        if not builder:
            return jsonify({"error": "Relatório não encontrado"}), 404

        def _cap(val, max_len=50):
            return (val or "")[:max_len] or None

        params = {
            "turno": _cap(request.args.get("turno"), 20),
            "serie": _cap(request.args.get("serie"), 5),
            "turma": _cap(request.args.get("turma"), 30),
            "disciplina": _cap(request.args.get("disciplina"), 50),
        }

        with session_scope() as session:
            try:
                result = builder(session, **params)
                data_list = result["data"] if isinstance(result, dict) and "data" in result else result
                
                export_format = request.args.get("format")
                if export_format in ("csv", "xlsx") and data_list:
                    import io
                    import csv
                    from flask import Response, send_file
                    
                    if not isinstance(data_list, list) or len(data_list) == 0 or not isinstance(data_list[0], dict):
                        return jsonify({"error": "Nenhum dado para exportar"}), 400
                        
                    keys = list(data_list[0].keys())
                    
                    if export_format == "csv":
                        si = io.StringIO()
                        writer = csv.DictWriter(si, fieldnames=keys)
                        writer.writeheader()
                        writer.writerows(data_list)
                        
                        return Response(
                            si.getvalue(),
                            mimetype="text/csv",
                            headers={"Content-disposition": f"attachment; filename=relatorio_{slug}.csv"}
                        )
                        
                    elif export_format == "xlsx":
                        import openpyxl
                        wb = openpyxl.Workbook()
                        ws = wb.active
                        ws.title = "Relatório"
                        
                        ws.append(keys)
                        for row in data_list:
                            ws.append([row.get(key) for key in keys])
                            
                        output = io.BytesIO()
                        wb.save(output)
                        output.seek(0)
                        
                        return send_file(
                            output,
                            mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                            as_attachment=True,
                            download_name=f"relatorio_{slug}.xlsx"
                        )

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
