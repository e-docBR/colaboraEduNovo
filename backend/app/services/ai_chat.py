"""Motor de análise educacional com IA.

Arquitetura híbrida:
  1. Detecção de intenção por regras (regex) → extração de dados do banco
  2. Se LLM configurado → enriquece a resposta com análise contextual
  3. Se não → usa templates de texto pré-definidos

Acesso restrito: admin, super_admin, diretor, coordenador, orientador.
Escopo: todos os dados são filtrados pelo tenant_id do usuário autenticado.
"""
from __future__ import annotations

import json
import re
from typing import Any, Optional, TypedDict

from loguru import logger
from sqlalchemy import select, func, desc, and_
from sqlalchemy.orm import Session

from ..core.database import session_scope
from ..models import Aluno, Nota, Comunicado, Ocorrencia, Tenant
from ..models.ai_configuration import AIConfiguration
from .intervention_service import intervention_service
from .llm_provider import call_llm


# ─── Tipos ──────────────────────────────────────────────────────────────────

class AIResponse(TypedDict):
    text: str
    type: str          # 'text' | 'table' | 'chart'
    data: Optional[Any]
    chart_config: Optional[Any]
    ai_name: str


# ─── Labels ──────────────────────────────────────────────────────────────────

TIPO_OC_LABELS = {
    "ADVERTENCIA": "Advertência", "ELOGIO": "Elogio",
    "ATRASO": "Atraso", "SUSPENSAO": "Suspensão", "OUTRO": "Outro",
}
GRAVIDADE_LABELS = {
    "LEVE": "Leve", "MEDIA": "Média", "GRAVE": "Grave", "GRAVISSIMA": "Gravíssima",
}

DEFAULT_AI_NAME = "FreiRonaldo"

# Paleta de cores alinhada ao tema da aplicação
COLORS = {
    "primary": "#0A3CA0",
    "success": "#147864",
    "danger": "#d32f2f",
    "warning": "#e65100",
    "info": "#1565c0",
    "purple": "#6a1b9a",
    "teal": "#00695c",
}


# ─── Padrões de intenção ─────────────────────────────────────────────────────

INTENT_PATTERNS: dict[str, list[str]] = {
    # Gráficos e comparativos
    "chart_grades":         [r"gr[áa]fico.*not[as]", r"comparar.*m[ée]dia", r"desempenho.*turma",
                             r"m[ée]dias.*disciplina", r"desempenho.*escola", r"gr[áa]fico.*desempenho"],
    "class_ranking":        [r"ranking.*turma", r"turma.*melhor", r"turma.*pior",
                             r"diferen[çc]a.*turma", r"comparar.*turma"],
    "turno_comparison":     [r"turno", r"matutino", r"vespertino", r"noturno",
                             r"manh[ãa]", r"tarde", r"noite"],
    "grade_by_subject":     [r"not[as].*disciplina", r"disciplina.*nota", r"por.*mat[ée]ria",
                             r"dif[íi]cil", r"complexa", r"pior.*not[as]", r"disciplina.*baix"],
    "grade_evolution":      [r"evolu[çc][ãa]o", r"trimestre.*trimestre", r"progresso.*not",
                             r"melhorou", r"subiu nota", r"piorou nota", r"queda.*not"],
    "grade_distribution":   [r"distribui[çc][ãa]o.*not[as]", r"faixa.*not[as]",
                             r"quantos.*aprovad", r"por[çc]ent.*not"],
    "status_distribution":  [r"status", r"situa[çc][ãa]o.*aluno", r"aprovad", r"recupera[çc][ãa]o",
                             r"reprovad", r"distribui[çc][ãa]o.*aluno"],

    # Alunos
    "risky_students":       [r"risco", r"reprovad", r"not[as].*baix", r"vermelho",
                             r"abaixo.*50", r"perigo", r"cr[íi]tico"],
    "best_students":        [r"melhor.*aluno", r"maior.*not[as]", r"destaque",
                             r"top.*aluno", r"medalha", r"excel[êe]ncia", r"honor"],
    "recovery_students":    [r"recupera[çc][ãa]o", r"rec\b", r"depend[êe]ncia",
                             r"exame final", r"segunda chamada"],
    "failed_students":      [r"reprovado", r"reprovar", r"n[ãa]o passou", r"reprova[çc][ãa]o"],
    "dropout_radar":        [r"abandono", r"evas[ãa]o", r"desistir", r"radar", r"largou"],
    "missing_grades":       [r"sem not[as]", r"faltando.*nota", r"incompleto", r"pend[êe]ncia.*nota"],
    "student_info":         [r"quem [ée]", r"sobre o aluno", r"perfil de", r"boletim do",
                             r"situa[çc][ãa]o de", r"dados de", r"hist[óo]rico.*aluno"],
    "student_evolution":    [r"evolu[çc][ãa]o.*aluno", r"progresso.*aluno", r"trimestre.*aluno",
                             r"notas.*do aluno"],
    "count_stats":          [r"quantos", r"total.*aluno", r"contar", r"n[úu]mero de aluno",
                             r"quantidade.*aluno"],
    "students_per_class":   [r"aluno.*turma", r"turma.*quantos", r"tamanho.*turma",
                             r"quantos.*turma"],
    "class_profile":        [r"perfil.*turma", r"turma completa", r"toda.*turma", r"resumo.*turma"],

    # Faltas
    "report_faults":        [r"falt[as]", r"frequ[êe]ncia", r"aus[êe]nci", r"n[ãa]o veio",
                             r"infrequente", r"presen[çc]a", r"falto"],
    "high_absence_risk":    [r"risco.*falta", r"muita.*falta", r"falta.*risco",
                             r"limite.*falta", r"percentual.*falta"],

    # Ocorrências
    "occurrences":          [r"ocorr[êe]ncia", r"advert[êe]ncia", r"elogio", r"comportamento",
                             r"disciplinar", r"suspens[ãa]o"],
    "recent_occurrences":   [r"ocorr[êe]ncia.*recente", r"[úu]ltima.*ocorr[êe]ncia",
                             r"hoje.*ocorr[êe]ncia", r"esta semana.*ocorr[êe]ncia"],
    "occurrence_severity":  [r"gravidade", r"grave", r"grav[íi]ssima", r"ocorr[êe]ncia.*grave"],
    "occurrence_by_student":[r"ocorr[êe]ncia.*aluno", r"hist[óo]rico.*comportamento"],

    # Comunicados
    "notices":              [r"comunicado", r"aviso", r"mural", r"not[íi]cia", r"novidade"],
    "notices_read_rate":    [r"lido", r"leitura", r"visuali[sz]ad", r"comunicado.*confirmad"],

    # Pedagógico
    "pedagogical_interventions": [r"ajuda.*aluno", r"interven[çc][ãa]o", r"pedag[óo]gic",
                                  r"como melhorar", r"estrat[ée]gia"],
    "intervention_priority":     [r"prioridade.*interven", r"interven[çc][ãa]o.*urgente",
                                  r"quem precisa.*ajuda.*mais"],

    # Resumos e relatórios gerais
    "academic_summary":     [r"resumo.*escolar", r"vis[ãa]o geral", r"panorama",
                             r"relat[óo]rio geral", r"overview", r"resumo geral"],
    "help":                 [r"o que voc[êe] faz", r"o que pode", r"ajuda", r"comandos",
                             r"como usar", r"capacidades", r"relat[óo]rios dispon"],
}


# ─── Motor principal ─────────────────────────────────────────────────────────

class AIAnalystEngine:

    # ── Intent Detection ─────────────────────────────────────────────────────

    def _detect_intent(self, message: str) -> str | None:
        ml = message.lower()
        for intent, patterns in INTENT_PATTERNS.items():
            if any(re.search(p, ml) for p in patterns):
                return intent
        return None

    def _extract_filters(self, message: str) -> dict:
        filters: dict = {}
        mu = message.upper()

        # Turmas múltiplas (ex: "7º ANO B", "6A")
        turmas: list[str] = []
        for m in re.finditer(r"\b([1-9])\s*(?:º|O)?\s*ANO\s*([A-Z])\b", mu):
            turmas.append(f"{m.group(1)}º ANO {m.group(2)}")
        for m in re.finditer(r"\b([1-9])\s*([A-Z])\b", mu):
            val = f"{m.group(1)}º ANO {m.group(2)}"
            if val not in turmas:
                turmas.append(val)
        if turmas:
            filters["turmas"] = turmas
        elif "ANO" in mu:
            am = re.search(r"([1-9])\s*ANO", mu)
            if am:
                filters["serie"] = am.group(1)

        # Turno
        if re.search(r"MATUTIN|MANH[ÃA]", mu):
            filters["turno"] = "Matutino"
        elif re.search(r"VESPERTIN|TARDE", mu):
            filters["turno"] = "Vespertino"
        elif re.search(r"NOTURIN|NOITE", mu):
            filters["turno"] = "Noturno"

        # Trimestre
        tm = re.search(r"([1-3])\s*(?:º|O)?\s*(?:TRIMESTRE|TRI)", mu)
        if tm:
            filters["trimestre"] = int(tm.group(1))

        # Nome do aluno
        nm = re.search(
            r"(?:DO ALUNO|SOBRE|QUEM [ÉE]|ALUNO|PERFIL DE|BOLETIM DO)\s+([A-ZÀ-Ú\s]{3,40})",
            mu,
        )
        if nm:
            filters["aluno_nome"] = nm.group(1).strip().title()

        # Disciplina
        disc_map = {
            r"MATEM[ÁA]T": "Matemática", r"PORTUGU[EÊ]S": "Português",
            r"CI[EÊ]NCIAS": "Ciências", r"HIST[OÓ]RIA": "História",
            r"GEOGRAFIA": "Geografia", r"INGL[EÊ]S": "Inglês",
            r"F[ÍI]SICA": "Física", r"QU[ÍI]MICA": "Química",
            r"BIOLOGIA": "Biologia", r"ARTES": "Artes", r"ED\.?\s*F[ÍI]S": "Ed. Física",
        }
        for pattern, name in disc_map.items():
            if re.search(pattern, mu):
                filters["disciplina"] = name
                break

        return filters

    # ── LLM Enrichment ────────────────────────────────────────────────────────

    def _enrich_with_llm(
        self,
        session: Session,
        tenant_id: int,
        base_text: str,
        data_context: dict,
        question: str,
        ai_name: str,
    ) -> str:
        """Chama o LLM para enriquecer a resposta com análise contextual."""
        ai_config = session.execute(
            select(AIConfiguration).where(AIConfiguration.tenant_id == tenant_id)
        ).scalar_one_or_none()

        if not ai_config or not ai_config.is_active:
            return base_text

        tenant = session.get(Tenant, tenant_id)
        school = tenant.name if tenant else "ColaboraEdu"

        extra_instructions = ""
        if ai_config.system_prompt:
            extra_instructions = f"\n\nInstruções adicionais: {ai_config.system_prompt}"

        system_msg = (
            f"Você é {ai_name}, assistente de análise educacional da {school}. "
            "Responda sempre em português brasileiro. Seja direto, profissional e pedagógico. "
            "Use emojis moderadamente para destacar pontos importantes. "
            "Ao analisar dados, sempre forneça insights práticos e recomendações acionáveis. "
            "Nunca invente dados — analise apenas o que for fornecido."
            + extra_instructions
        )

        context_json = json.dumps(data_context, ensure_ascii=False, indent=2)
        user_msg = (
            f"Pergunta do usuário: {question}\n\n"
            f"Dados extraídos do banco de dados:\n{context_json}\n\n"
            f"Com base nesses dados reais, forneça uma análise pedagógica útil e insights acionáveis. "
            f"Seja conciso (máximo 4 parágrafos)."
        )

        enriched = call_llm(
            ai_config,
            [
                {"role": "system", "content": system_msg},
                {"role": "user", "content": user_msg},
            ],
        )
        return enriched if enriched else base_text

    # ── Helpers de query ──────────────────────────────────────────────────────

    def _apply_turma_filter(self, query, filters: dict):
        if filters.get("turmas"):
            return query.where(Aluno.turma.in_(filters["turmas"]))
        if filters.get("turno"):
            return query.where(Aluno.turno == filters["turno"])
        return query

    def _grade_col(self, filters: dict):
        tri = filters.get("trimestre")
        if tri == 1:
            return Nota.trimestre1, "1º Tri"
        if tri == 2:
            return Nota.trimestre2, "2º Tri"
        if tri == 3:
            return Nota.trimestre3, "3º Tri"
        return Nota.total, "Global"

    # ── Handlers ─────────────────────────────────────────────────────────────

    def _chart_grades(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        col, label = self._grade_col(f)
        q = select(Aluno.turma, func.avg(col).label("m")).join(Nota).where(
            Aluno.tenant_id == tenant_id
        ).group_by(Aluno.turma)
        q = self._apply_turma_filter(q, f)
        rows = s.execute(q).all()
        data = sorted(
            [{"name": r.turma, "value": round(float(r.m or 0), 1)} for r in rows],
            key=lambda x: x["value"], reverse=True,
        )
        base = f"Comparativo de médias ({label}) por turma — {len(data)} turma(s) analisadas."
        return {"text": base, "type": "chart", "data": data,
                "chart_config": {"type": "bar", "xKey": "name", "yKey": "value",
                                 "color": COLORS["primary"], "title": f"Média {label} por Turma"},
                "_ctx": {"turmas": data, "label": label}}

    def _class_ranking(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        q = select(
            Aluno.turma,
            func.avg(Nota.total).label("media"),
            func.count(Aluno.id.distinct()).label("alunos"),
        ).join(Nota).where(Aluno.tenant_id == tenant_id).group_by(Aluno.turma).order_by(desc("media"))
        rows = s.execute(q).all()
        data = [{"Turma": r.turma, "Média": round(float(r.media or 0), 1), "Alunos": r.alunos}
                for r in rows]
        base = f"Ranking de {len(data)} turmas por média geral."
        return {"text": base, "type": "table", "data": data, "chart_config": None,
                "_ctx": {"ranking": data[:5]}}

    def _turno_comparison(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        q = select(
            Aluno.turno, func.avg(Nota.total).label("media"),
            func.count(Aluno.id.distinct()).label("alunos"),
        ).join(Nota).where(Aluno.tenant_id == tenant_id).group_by(Aluno.turno)
        rows = s.execute(q).all()
        data = [{"name": r.turno or "Não informado", "value": round(float(r.media or 0), 1)}
                for r in rows]
        base = "Comparativo de desempenho por turno."
        return {"text": base, "type": "chart", "data": data,
                "chart_config": {"type": "bar", "xKey": "name", "yKey": "value",
                                 "color": COLORS["info"], "title": "Média por Turno"},
                "_ctx": {"turnos": data}}

    def _grade_by_subject(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        q = select(Nota.disciplina, func.avg(Nota.total).label("media")).where(
            Nota.aluno_id.in_(select(Aluno.id).where(Aluno.tenant_id == tenant_id))
        ).group_by(Nota.disciplina).order_by("media")
        if f.get("disciplina"):
            q = q.where(Nota.disciplina.ilike(f"%{f['disciplina']}%"))
        q = q.limit(10)
        rows = s.execute(q).all()
        data = [{"name": r.disciplina, "value": round(float(r.media or 0), 1)} for r in rows]
        base = f"Desempenho médio por disciplina — {len(data)} disciplinas."
        return {"text": base, "type": "chart", "data": data,
                "chart_config": {"type": "bar", "xKey": "name", "yKey": "value",
                                 "color": COLORS["warning"], "title": "Média por Disciplina"},
                "_ctx": {"disciplinas": data}}

    def _grade_evolution(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        aluno_filter = select(Aluno.id).where(Aluno.tenant_id == tenant_id)
        aluno_nome = f.get("aluno_nome")
        if aluno_nome:
            aluno_filter = aluno_filter.where(Aluno.nome.ilike(f"%{aluno_nome}%"))
        if f.get("turmas"):
            aluno_filter = aluno_filter.where(Aluno.turma.in_(f["turmas"]))

        q = select(
            func.avg(Nota.trimestre1).label("t1"),
            func.avg(Nota.trimestre2).label("t2"),
            func.avg(Nota.trimestre3).label("t3"),
        ).where(Nota.aluno_id.in_(aluno_filter))
        row = s.execute(q).one()
        data = [
            {"name": "1º Tri", "value": round(float(row.t1 or 0), 1)},
            {"name": "2º Tri", "value": round(float(row.t2 or 0), 1)},
            {"name": "3º Tri", "value": round(float(row.t3 or 0), 1)},
        ]
        scope = aluno_nome or (f["turmas"][0] if f.get("turmas") else "toda a escola")
        base = f"Evolução trimestral de notas — {scope}."
        return {"text": base, "type": "chart", "data": data,
                "chart_config": {"type": "bar", "xKey": "name", "yKey": "value",
                                 "color": COLORS["success"], "title": "Evolução Trimestral"},
                "_ctx": {"evolucao": data, "scope": scope}}

    def _grade_distribution(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        base_filter = Nota.aluno_id.in_(select(Aluno.id).where(Aluno.tenant_id == tenant_id))
        buckets = [
            ("Excelente (≥90)", 90, 101),
            ("Ótimo (75–89)", 75, 90),
            ("Regular (60–74)", 60, 75),
            ("Recuperação (50–59)", 50, 60),
            ("Crítico (<50)", 0, 50),
        ]
        data = []
        for label, lo, hi in buckets:
            count = s.execute(
                select(func.count(Nota.id)).where(base_filter, Nota.total >= lo, Nota.total < hi)
            ).scalar() or 0
            data.append({"name": label, "value": count})
        base = "Distribuição de notas por faixa de desempenho."
        return {"text": base, "type": "chart", "data": data,
                "chart_config": {"type": "pie", "xKey": "name", "yKey": "value",
                                 "title": "Distribuição de Notas"},
                "_ctx": {"faixas": data}}

    def _status_distribution(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        q = select(Nota.situacao, func.count(Nota.id)).where(
            Nota.situacao.is_not(None),
            Nota.aluno_id.in_(select(Aluno.id).where(Aluno.tenant_id == tenant_id)),
        ).group_by(Nota.situacao)
        rows = s.execute(q).all()
        data = [{"name": r.situacao, "value": r[1]} for r in rows if r.situacao]
        base = "Distribuição dos alunos por situação escolar."
        return {"text": base, "type": "chart", "data": data,
                "chart_config": {"type": "pie", "xKey": "name", "yKey": "value",
                                 "title": "Situação Escolar"},
                "_ctx": {"situacoes": data}}

    def _risky_students(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        q = select(Aluno.nome, Aluno.turma, func.avg(Nota.total).label("media")).join(Nota).where(
            Aluno.tenant_id == tenant_id
        ).group_by(Aluno.id).having(func.avg(Nota.total) < 50).order_by("media").limit(15)
        q = self._apply_turma_filter(q, f)
        rows = s.execute(q).all()
        if not rows:
            return {"text": "Nenhum aluno em situação crítica (média < 50) encontrado com esses filtros. ✅",
                    "type": "text", "data": None, "chart_config": None, "_ctx": {}}
        data = [{"Aluno": r.nome, "Turma": r.turma, "Média": round(float(r.media), 1)} for r in rows]
        base = f"⚠️ {len(rows)} alunos com média abaixo de 50. O mais crítico: {rows[0].nome} ({round(float(rows[0].media),1)})."
        return {"text": base, "type": "table", "data": data, "chart_config": None,
                "_ctx": {"total_risco": len(rows), "mais_critico": rows[0].nome, "dados": data[:5]}}

    def _best_students(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        q = select(Aluno.nome, Aluno.turma, func.avg(Nota.total).label("media")).join(Nota).where(
            Aluno.tenant_id == tenant_id
        ).group_by(Aluno.id).order_by(desc("media")).limit(10)
        q = self._apply_turma_filter(q, f)
        rows = s.execute(q).all()
        data = [{"#": i + 1, "Aluno": r.nome, "Turma": r.turma, "Média": round(float(r.media), 1)}
                for i, r in enumerate(rows)]
        base = f"🏆 Top {len(rows)} alunos em desempenho acadêmico."
        return {"text": base, "type": "table", "data": data, "chart_config": None,
                "_ctx": {"top_alunos": data[:5]}}

    def _recovery_students(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        q = select(Aluno.nome, Aluno.turma, Nota.disciplina, Nota.total).join(Nota).where(
            Aluno.tenant_id == tenant_id, Nota.situacao.in_(["REC", "Recuperação", "Em Recuperação"])
        ).order_by(Aluno.turma, Aluno.nome)
        q = self._apply_turma_filter(q, f)
        rows = s.execute(q).all()
        if not rows:
            return {"text": "Nenhum aluno em recuperação encontrado. ✅",
                    "type": "text", "data": None, "chart_config": None, "_ctx": {}}
        data = [{"Aluno": r.nome, "Turma": r.turma, "Disciplina": r.disciplina,
                 "Nota": round(float(r.total or 0), 1)} for r in rows]
        base = f"📋 {len(rows)} registro(s) de alunos em recuperação."
        return {"text": base, "type": "table", "data": data, "chart_config": None,
                "_ctx": {"em_recuperacao": len(rows)}}

    def _failed_students(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        q = select(Aluno.nome, Aluno.turma, func.avg(Nota.total).label("media")).join(Nota).where(
            Aluno.tenant_id == tenant_id
        ).group_by(Aluno.id).having(func.avg(Nota.total) < 60).order_by("media").limit(20)
        q = self._apply_turma_filter(q, f)
        rows = s.execute(q).all()
        data = [{"Aluno": r.nome, "Turma": r.turma, "Média": round(float(r.media), 1)} for r in rows]
        base = f"📉 {len(rows)} alunos com média abaixo de 60 (em risco de reprovação)."
        return {"text": base, "type": "table", "data": data, "chart_config": None,
                "_ctx": {"total": len(rows), "media_grupo": round(sum(r.media for r in rows) / max(len(rows), 1), 1)}}

    def _dropout_radar(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        q = select(
            Aluno.nome, Aluno.turma, Aluno.turno,
            func.avg(Nota.total).label("media"),
            func.sum(Nota.faltas).label("faltas"),
        ).join(Nota).where(Aluno.tenant_id == tenant_id).group_by(Aluno.id).having(
            and_(func.avg(Nota.total) < 50, func.sum(Nota.faltas) > 10)
        ).order_by(desc("faltas")).limit(15)
        rows = s.execute(q).all()
        if not rows:
            return {"text": "✅ Radar de abandono: nenhum aluno em risco iminente com os critérios atuais (média < 50 + faltas > 10).",
                    "type": "text", "data": None, "chart_config": None, "_ctx": {}}
        data = [{"Aluno": r.nome, "Turma": r.turma, "Turno": r.turno,
                 "Média": round(float(r.media), 1), "Faltas": int(r.faltas or 0),
                 "Risco": "🔴 Crítico"} for r in rows]
        base = f"🚨 Radar de Abandono: {len(rows)} alunos em risco iminente (média baixa + alta infrequência)."
        return {"text": base, "type": "table", "data": data, "chart_config": None,
                "_ctx": {"total_risco_abandono": len(rows), "dados": data[:5]}}

    def _report_faults(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        q = select(Aluno.nome, Aluno.turma, func.sum(Nota.faltas).label("faltas")).join(Nota).where(
            Aluno.tenant_id == tenant_id
        ).group_by(Aluno.id).order_by(desc("faltas")).limit(10)
        q = self._apply_turma_filter(q, f)
        rows = s.execute(q).all()
        data = [{"name": r.nome, "value": int(r.faltas or 0), "extra": r.turma} for r in rows]
        base = f"📊 Top {len(rows)} alunos com maior índice de faltas."
        return {"text": base, "type": "chart", "data": data,
                "chart_config": {"type": "bar", "xKey": "name", "yKey": "value",
                                 "color": COLORS["danger"], "title": "Alunos com Mais Faltas"},
                "_ctx": {"top_faltas": [{"nome": d["name"], "faltas": d["value"]} for d in data[:5]]}}

    def _high_absence_risk(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        # Limite legal BR: 25% de faltas reprova (200 dias letivos = 50 faltas)
        q = select(
            Aluno.nome, Aluno.turma,
            func.sum(Nota.faltas).label("faltas"),
            func.avg(Nota.total).label("media"),
        ).join(Nota).where(Aluno.tenant_id == tenant_id).group_by(Aluno.id).having(
            func.sum(Nota.faltas) >= 30
        ).order_by(desc("faltas")).limit(20)
        rows = s.execute(q).all()
        if not rows:
            return {"text": "✅ Nenhum aluno atingiu o limite de risco por faltas (≥30).",
                    "type": "text", "data": None, "chart_config": None, "_ctx": {}}
        data = [{"Aluno": r.nome, "Turma": r.turma, "Faltas": int(r.faltas or 0),
                 "Média": round(float(r.media or 0), 1),
                 "Status": "🔴 Crítico" if r.faltas >= 50 else "🟡 Atenção"} for r in rows]
        base = f"⚠️ {len(rows)} alunos com frequência comprometida (≥30 faltas)."
        return {"text": base, "type": "table", "data": data, "chart_config": None,
                "_ctx": {"total": len(rows)}}

    def _occurrences(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        q = select(Ocorrencia.tipo, func.count(Ocorrencia.id)).where(
            Ocorrencia.tenant_id == tenant_id
        ).group_by(Ocorrencia.tipo)
        rows = s.execute(q).all()
        if not rows:
            return {"text": "Nenhuma ocorrência registrada.", "type": "text",
                    "data": None, "chart_config": None, "_ctx": {}}
        data = [{"name": TIPO_OC_LABELS.get(r[0], r[0]), "value": r[1]} for r in rows]
        total = sum(d["value"] for d in data)
        base = f"📊 Total de {total} ocorrências registradas, distribuídas em {len(data)} tipo(s)."
        return {"text": base, "type": "chart", "data": data,
                "chart_config": {"type": "bar", "xKey": "name", "yKey": "value",
                                 "color": COLORS["danger"], "title": "Ocorrências por Tipo"},
                "_ctx": {"total": total, "tipos": data}}

    def _recent_occurrences(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        from sqlalchemy import text as sa_text
        q = select(
            Ocorrencia.tipo, Ocorrencia.descricao, Ocorrencia.data_registro,
            Aluno.nome.label("aluno"), Aluno.turma,
        ).join(Aluno).where(Ocorrencia.tenant_id == tenant_id).order_by(
            desc(Ocorrencia.data_registro)
        ).limit(10)
        rows = s.execute(q).all()
        if not rows:
            return {"text": "Nenhuma ocorrência recente.", "type": "text",
                    "data": None, "chart_config": None, "_ctx": {}}
        data = [{"Data": str(r.data_registro)[:10], "Aluno": r.aluno, "Turma": r.turma,
                 "Tipo": TIPO_OC_LABELS.get(r.tipo, r.tipo),
                 "Descrição": (r.descricao or "")[:60] + "..."} for r in rows]
        base = f"📋 {len(rows)} ocorrências mais recentes."
        return {"text": base, "type": "table", "data": data, "chart_config": None,
                "_ctx": {"recentes": len(rows)}}

    def _occurrence_severity(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        q = select(Ocorrencia.gravidade, func.count(Ocorrencia.id)).where(
            Ocorrencia.tenant_id == tenant_id, Ocorrencia.gravidade.is_not(None)
        ).group_by(Ocorrencia.gravidade)
        rows = s.execute(q).all()
        data = [{"name": GRAVIDADE_LABELS.get(r[0], r[0]), "value": r[1]} for r in rows]
        base = "Distribuição de ocorrências por gravidade."
        return {"text": base, "type": "chart", "data": data,
                "chart_config": {"type": "pie", "xKey": "name", "yKey": "value",
                                 "title": "Ocorrências por Gravidade"},
                "_ctx": {"gravidades": data}}

    def _occurrence_by_student(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        nome = f.get("aluno_nome")
        if not nome:
            return {"text": "Informe o nome do aluno. Ex: 'Ocorrências do aluno João Silva'",
                    "type": "text", "data": None, "chart_config": None, "_ctx": {}}
        q = select(
            Ocorrencia.tipo, Ocorrencia.gravidade, Ocorrencia.descricao, Ocorrencia.data_registro
        ).join(Aluno).where(
            Aluno.tenant_id == tenant_id, Aluno.nome.ilike(f"%{nome}%")
        ).order_by(desc(Ocorrencia.data_registro))
        rows = s.execute(q).all()
        if not rows:
            return {"text": f"Nenhuma ocorrência para '{nome}'.", "type": "text",
                    "data": None, "chart_config": None, "_ctx": {}}
        data = [{"Data": str(r.data_registro)[:10], "Tipo": TIPO_OC_LABELS.get(r.tipo, r.tipo),
                 "Gravidade": GRAVIDADE_LABELS.get(r.gravidade or "", "-"),
                 "Descrição": (r.descricao or "")[:80]} for r in rows]
        base = f"Histórico de {len(rows)} ocorrência(s) para '{nome}'."
        return {"text": base, "type": "table", "data": data, "chart_config": None,
                "_ctx": {"aluno": nome, "total": len(rows)}}

    def _notices(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        q = select(Comunicado).where(
            Comunicado.arquivado.is_(False), Comunicado.tenant_id == tenant_id
        ).order_by(desc(Comunicado.data_envio)).limit(8)
        rows = s.execute(q).scalars().all()
        if not rows:
            return {"text": "Nenhum comunicado ativo no momento.", "type": "text",
                    "data": None, "chart_config": None, "_ctx": {}}
        data = [{"Título": r.titulo, "Data": str(r.data_envio)[:10],
                 "Destino": getattr(r, "target", "-") or "-"} for r in rows]
        base = f"📢 {len(rows)} comunicado(s) ativos no mural."
        return {"text": base, "type": "table", "data": data, "chart_config": None,
                "_ctx": {"total_comunicados": len(rows), "comunicados": data[:3]}}

    def _notices_read_rate(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        from ..models import ComunicadoLeitura
        q = select(
            Comunicado.titulo,
            func.count(ComunicadoLeitura.id).label("leituras"),
        ).outerjoin(ComunicadoLeitura).where(
            Comunicado.tenant_id == tenant_id
        ).group_by(Comunicado.id).order_by(desc("leituras")).limit(10)
        rows = s.execute(q).all()
        if not rows:
            return {"text": "Nenhum comunicado encontrado.", "type": "text",
                    "data": None, "chart_config": None, "_ctx": {}}
        data = [{"name": (r.titulo or "")[:30], "value": r.leituras} for r in rows]
        base = f"Taxa de leitura dos comunicados — {len(data)} comunicados analisados."
        return {"text": base, "type": "chart", "data": data,
                "chart_config": {"type": "bar", "xKey": "name", "yKey": "value",
                                 "color": COLORS["teal"], "title": "Leituras por Comunicado"},
                "_ctx": {"comunicados_lidos": data[:5]}}

    def _missing_grades(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        q = select(Aluno.nome, Aluno.turma, func.count(Nota.id).label("notas")).outerjoin(Nota).where(
            Aluno.tenant_id == tenant_id
        ).group_by(Aluno.id).having(func.count(Nota.id) < 4).limit(15)
        q = self._apply_turma_filter(q, f)
        rows = s.execute(q).all()
        if not rows:
            return {"text": "✅ Todos os alunos têm o número esperado de notas lançadas.",
                    "type": "text", "data": None, "chart_config": None, "_ctx": {}}
        data = [{"Aluno": r.nome, "Turma": r.turma, "Notas Lançadas": r.notas} for r in rows]
        base = f"⚠️ {len(rows)} alunos com pendências no boletim (menos de 4 disciplinas lançadas)."
        return {"text": base, "type": "table", "data": data, "chart_config": None,
                "_ctx": {"pendencias": len(rows)}}

    def _student_info(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        nome = f.get("aluno_nome")
        if not nome:
            return {"text": "Informe o nome. Ex: 'Perfil do aluno João Silva'",
                    "type": "text", "data": None, "chart_config": None, "_ctx": {}}
        aluno = s.execute(
            select(Aluno).where(Aluno.tenant_id == tenant_id, Aluno.nome.ilike(f"%{nome}%"))
        ).scalar_one_or_none()
        if not aluno:
            return {"text": f"Aluno '{nome}' não encontrado.", "type": "text",
                    "data": None, "chart_config": None, "_ctx": {}}
        media = s.execute(
            select(func.avg(Nota.total)).where(Nota.aluno_id == aluno.id)
        ).scalar() or 0
        faltas = s.execute(
            select(func.sum(Nota.faltas)).where(Nota.aluno_id == aluno.id)
        ).scalar() or 0
        notas_detail = s.execute(
            select(Nota.disciplina, Nota.total, Nota.situacao).where(Nota.aluno_id == aluno.id)
        ).all()
        situacao = "🔴 Em Risco" if media < 50 else ("🟡 Atenção" if media < 60 else "🟢 Regular")
        perfil = (
            f"👤 **{aluno.nome}** — {aluno.turma} ({aluno.turno})\n"
            f"📛 Matrícula: {aluno.matricula or '—'}\n"
            f"📊 Média Geral: **{round(float(media), 1)}** | Faltas: **{int(faltas)}**\n"
            f"📋 Situação: {situacao}"
        )
        data = [{"Disciplina": n.disciplina, "Nota": round(float(n.total or 0), 1),
                 "Situação": n.situacao or "—"} for n in notas_detail]
        return {"text": perfil, "type": "table", "data": data, "chart_config": None,
                "_ctx": {"aluno": aluno.nome, "media": round(float(media), 1),
                         "faltas": int(faltas), "situacao": situacao}}

    def _student_evolution(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        nome = f.get("aluno_nome")
        if not nome:
            return {"text": "Informe o nome do aluno. Ex: 'Evolução trimestral do aluno Maria'",
                    "type": "text", "data": None, "chart_config": None, "_ctx": {}}
        aluno = s.execute(
            select(Aluno).where(Aluno.tenant_id == tenant_id, Aluno.nome.ilike(f"%{nome}%"))
        ).scalar_one_or_none()
        if not aluno:
            return {"text": f"Aluno '{nome}' não encontrado.", "type": "text",
                    "data": None, "chart_config": None, "_ctx": {}}
        rows = s.execute(
            select(Nota.disciplina, Nota.trimestre1, Nota.trimestre2, Nota.trimestre3)
            .where(Nota.aluno_id == aluno.id)
        ).all()
        data = [{"Disciplina": r.disciplina,
                 "1º Tri": round(float(r.trimestre1 or 0), 1),
                 "2º Tri": round(float(r.trimestre2 or 0), 1),
                 "3º Tri": round(float(r.trimestre3 or 0), 1)} for r in rows]
        avg_t1 = sum(r["1º Tri"] for r in data) / max(len(data), 1)
        avg_t3 = sum(r["3º Tri"] for r in data) / max(len(data), 1)
        trend = "📈 melhora" if avg_t3 > avg_t1 else ("📉 queda" if avg_t3 < avg_t1 else "➡️ estável")
        base = f"Evolução trimestral de {aluno.nome}: tendência de {trend}."
        return {"text": base, "type": "table", "data": data, "chart_config": None,
                "_ctx": {"aluno": aluno.nome, "tendencia": trend,
                         "media_t1": round(avg_t1, 1), "media_t3": round(avg_t3, 1)}}

    def _count_stats(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        total = s.execute(
            select(func.count(Aluno.id)).where(Aluno.tenant_id == tenant_id)
        ).scalar() or 0
        by_turma = s.execute(
            select(Aluno.turma, func.count(Aluno.id)).where(
                Aluno.tenant_id == tenant_id
            ).group_by(Aluno.turma).order_by(Aluno.turma)
        ).all()
        data = [{"Turma": r.turma or "Não informado", "Alunos": r[1]} for r in by_turma]
        base = f"📊 Total: **{total}** alunos matriculados em {len(data)} turma(s)."
        return {"text": base, "type": "table", "data": data, "chart_config": None,
                "_ctx": {"total": total, "turmas": len(data)}}

    def _students_per_class(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        q = select(Aluno.turma, func.count(Aluno.id).label("n")).where(
            Aluno.tenant_id == tenant_id
        ).group_by(Aluno.turma).order_by(desc("n"))
        rows = s.execute(q).all()
        data = [{"name": r.turma or "Não informado", "value": r.n} for r in rows]
        base = f"Tamanho das turmas — {len(data)} turmas."
        return {"text": base, "type": "chart", "data": data,
                "chart_config": {"type": "bar", "xKey": "name", "yKey": "value",
                                 "color": COLORS["purple"], "title": "Alunos por Turma"},
                "_ctx": {"turmas": data[:5]}}

    def _class_profile(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        turmas = f.get("turmas")
        if not turmas:
            return {"text": "Informe a turma. Ex: 'Perfil da turma 7A'",
                    "type": "text", "data": None, "chart_config": None, "_ctx": {}}
        turma = turmas[0]
        rows = s.execute(
            select(Aluno.nome, func.avg(Nota.total).label("media"),
                   func.sum(Nota.faltas).label("faltas")).join(Nota).where(
                Aluno.tenant_id == tenant_id, Aluno.turma == turma
            ).group_by(Aluno.id).order_by(desc("media"))
        ).all()
        if not rows:
            return {"text": f"Turma '{turma}' não encontrada.", "type": "text",
                    "data": None, "chart_config": None, "_ctx": {}}
        data = [{"Aluno": r.nome, "Média": round(float(r.media or 0), 1),
                 "Faltas": int(r.faltas or 0)} for r in rows]
        avg_turma = sum(d["Média"] for d in data) / len(data)
        base = f"Perfil completo da turma {turma}: {len(data)} alunos, média {round(avg_turma, 1)}."
        return {"text": base, "type": "table", "data": data, "chart_config": None,
                "_ctx": {"turma": turma, "alunos": len(data), "media_turma": round(avg_turma, 1)}}

    def _pedagogical_interventions(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        nome = f.get("aluno_nome")
        if not nome:
            return {"text": "Informe o nome. Ex: 'Intervenção pedagógica para João'",
                    "type": "text", "data": None, "chart_config": None, "_ctx": {}}
        aluno = s.execute(
            select(Aluno).where(Aluno.tenant_id == tenant_id, Aluno.nome.ilike(f"%{nome}%"))
        ).scalar_one_or_none()
        if not aluno:
            return {"text": f"Aluno '{nome}' não encontrado.", "type": "text",
                    "data": None, "chart_config": None, "_ctx": {}}
        analysis = intervention_service.analyze_student(s, aluno.id)
        if not analysis.get("interventions"):
            return {"text": f"✅ {aluno.nome} está com bom desempenho — sem alertas pedagógicos.",
                    "type": "text", "data": None, "chart_config": None, "_ctx": {}}
        lines = "\n".join(
            f"• [{i['priority']}] **{i['title']}**: {i['description']}"
            for i in analysis["interventions"]
        )
        base = f"📚 Análise pedagógica de {aluno.nome} ({aluno.turma}):\n\n{lines}"
        return {"text": base, "type": "text", "data": analysis, "chart_config": None,
                "_ctx": {"aluno": aluno.nome, "intervencoes": len(analysis["interventions"]),
                         "areas": [i["title"] for i in analysis["interventions"]]}}

    def _intervention_priority(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        q = select(
            Aluno.nome, Aluno.turma, func.avg(Nota.total).label("media"),
            func.sum(Nota.faltas).label("faltas"),
        ).join(Nota).where(Aluno.tenant_id == tenant_id).group_by(Aluno.id).having(
            func.avg(Nota.total) < 60
        ).order_by("media").limit(15)
        rows = s.execute(q).all()
        if not rows:
            return {"text": "✅ Nenhum aluno necessitando intervenção prioritária encontrado.",
                    "type": "text", "data": None, "chart_config": None, "_ctx": {}}
        data = [{"Aluno": r.nome, "Turma": r.turma,
                 "Média": round(float(r.media), 1), "Faltas": int(r.faltas or 0),
                 "Prioridade": "🔴 Alta" if r.media < 50 else "🟡 Média"} for r in rows]
        base = f"📋 {len(rows)} alunos necessitando intervenção pedagógica prioritária."
        return {"text": base, "type": "table", "data": data, "chart_config": None,
                "_ctx": {"total": len(rows)}}

    def _academic_summary(self, s: Session, f: dict, tenant_id: int, **kw) -> dict:
        total_alunos = s.execute(
            select(func.count(Aluno.id)).where(Aluno.tenant_id == tenant_id)
        ).scalar() or 0
        media_geral = s.execute(
            select(func.avg(Nota.total)).where(
                Nota.aluno_id.in_(select(Aluno.id).where(Aluno.tenant_id == tenant_id))
            )
        ).scalar() or 0
        total_ocorrencias = s.execute(
            select(func.count(Ocorrencia.id)).where(Ocorrencia.tenant_id == tenant_id)
        ).scalar() or 0
        comunicados_ativos = s.execute(
            select(func.count(Comunicado.id)).where(
                Comunicado.tenant_id == tenant_id, Comunicado.arquivado.is_(False)
            )
        ).scalar() or 0
        alunos_risco = s.execute(
            select(func.count()).select_from(
                select(Aluno.id).join(Nota).where(Aluno.tenant_id == tenant_id)
                .group_by(Aluno.id).having(func.avg(Nota.total) < 50).subquery()
            )
        ).scalar() or 0
        summary = {
            "Total de Alunos": total_alunos,
            "Média Geral": round(float(media_geral), 1),
            "Alunos em Risco": alunos_risco,
            "Ocorrências": total_ocorrencias,
            "Comunicados Ativos": comunicados_ativos,
        }
        data = [{"Indicador": k, "Valor": v} for k, v in summary.items()]
        base = (
            f"📊 **Visão Geral da Escola**\n"
            f"👥 {total_alunos} alunos | 📈 Média {round(float(media_geral), 1)} | "
            f"⚠️ {alunos_risco} em risco | 📢 {comunicados_ativos} comunicados ativos"
        )
        return {"text": base, "type": "table", "data": data, "chart_config": None,
                "_ctx": summary}

    def _help(self, ai_name: str = DEFAULT_AI_NAME, **kw) -> dict:
        text = (
            f"Olá! Sou o **{ai_name}**, seu assistente de análise educacional. "
            "Posso gerar relatórios e insights sobre:\n\n"
            "**📊 Desempenho:**\n"
            "• Gráfico de médias por turma ou disciplina\n"
            "• Ranking de turmas | Comparativo por turno\n"
            "• Evolução trimestral | Distribuição de notas\n\n"
            "**👥 Alunos:**\n"
            "• Alunos em risco | Melhores alunos | Em recuperação\n"
            "• Radar de abandono | Perfil completo de aluno\n"
            "• Evolução trimestral individual | Turma completa\n\n"
            "**📅 Frequência:**\n"
            "• Alunos com mais faltas | Risco por infrequência\n\n"
            "**⚖️ Ocorrências:**\n"
            "• Ocorrências por tipo | Por gravidade | Recentes\n"
            "• Histórico de ocorrências de um aluno\n\n"
            "**📢 Comunicados:**\n"
            "• Comunicados ativos | Taxa de leitura\n\n"
            "**🎓 Pedagógico:**\n"
            "• Intervenção para um aluno | Prioridades de intervenção\n"
            "• Resumo geral da escola\n\n"
            "💡 *Dica*: Especifique turma, turno ou trimestre para filtrar. "
            "Ex: '**Alunos em risco da turma 7A**' ou '**Evolução da Maria no 2º tri**'"
        )
        return {"text": text, "type": "text", "data": None, "chart_config": None, "_ctx": {}}

    # ── Dispatcher ────────────────────────────────────────────────────────────

    INTENT_HANDLERS = {
        "chart_grades": "_chart_grades",
        "class_ranking": "_class_ranking",
        "turno_comparison": "_turno_comparison",
        "grade_by_subject": "_grade_by_subject",
        "grade_evolution": "_grade_evolution",
        "grade_distribution": "_grade_distribution",
        "status_distribution": "_status_distribution",
        "risky_students": "_risky_students",
        "best_students": "_best_students",
        "recovery_students": "_recovery_students",
        "failed_students": "_failed_students",
        "dropout_radar": "_dropout_radar",
        "report_faults": "_report_faults",
        "high_absence_risk": "_high_absence_risk",
        "occurrences": "_occurrences",
        "recent_occurrences": "_recent_occurrences",
        "occurrence_severity": "_occurrence_severity",
        "occurrence_by_student": "_occurrence_by_student",
        "notices": "_notices",
        "notices_read_rate": "_notices_read_rate",
        "missing_grades": "_missing_grades",
        "student_info": "_student_info",
        "student_evolution": "_student_evolution",
        "count_stats": "_count_stats",
        "students_per_class": "_students_per_class",
        "class_profile": "_class_profile",
        "pedagogical_interventions": "_pedagogical_interventions",
        "intervention_priority": "_intervention_priority",
        "academic_summary": "_academic_summary",
        "help": "_help",
    }

    def process_query(self, message: str, tenant_id: int) -> AIResponse:
        intent = self._detect_intent(message)
        filters = self._extract_filters(message)

        with session_scope() as session:
            # Resolve AI name for this tenant
            ai_cfg = session.execute(
                select(AIConfiguration).where(AIConfiguration.tenant_id == tenant_id)
            ).scalar_one_or_none()
            tenant = session.get(Tenant, tenant_id)
            tenant_name = tenant.name if tenant else "ColaboraEdu"

            if ai_cfg:
                ai_name = ai_cfg.display_name(tenant_name)
            else:
                first_word = tenant_name.split()[0]
                ai_name = f"AI {first_word}"

            # Help intent (no DB needed)
            if intent == "help" or not intent:
                result = self._help(ai_name=ai_name)
                result["ai_name"] = ai_name
                return result  # type: ignore

            # Dispatch to handler
            handler_name = self.INTENT_HANDLERS.get(intent)
            if not handler_name:
                result = self._help(ai_name=ai_name)
                result["ai_name"] = ai_name
                return result  # type: ignore

            handler = getattr(self, handler_name)
            try:
                result = handler(s=session, f=filters, tenant_id=tenant_id, ai_name=ai_name)
            except Exception as exc:
                logger.error(f"AI handler '{handler_name}' failed: {exc}")
                return {
                    "text": "Erro ao processar a consulta. Verifique os dados e tente novamente.",
                    "type": "text", "data": None, "chart_config": None, "ai_name": ai_name,
                }

            # LLM enrichment (only for text/table responses with meaningful context)
            ctx = result.pop("_ctx", {})
            if ctx and result.get("type") in ("text", "table") and result.get("text"):
                enriched = self._enrich_with_llm(
                    session, tenant_id,
                    base_text=result["text"],
                    data_context=ctx,
                    question=message,
                    ai_name=ai_name,
                )
                result["text"] = enriched

            result["ai_name"] = ai_name
            return result  # type: ignore


# ─── Singleton ───────────────────────────────────────────────────────────────

_engine = AIAnalystEngine()


def process_chat_message(message: str, tenant_id: int) -> dict:
    return _engine.process_query(message, tenant_id)
