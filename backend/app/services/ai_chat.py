import re
from sqlalchemy import select, func, desc
from sqlalchemy.orm import Session
from ..models import Aluno, Nota, Comunicado, Ocorrencia
from ..core.database import session_scope
from .intervention_service import intervention_service

from typing import TypedDict, Any, Optional

class AIResponse(TypedDict):
    text: str
    type: str # 'text', 'table', 'chart'
    data: Optional[Any]
    chart_config: Optional[Any]

class AIAnalystEngine:
    def __init__(self):
        self.intent_patterns = {
            'chart_grades': [r'gr[áa]fico.*not[as]', r'comparar.*m[ée]dia', r'desempenho.*turma', r'm[ée]dias.*disciplina', r'desempenho.*escola'],
            'risky_students': [r'risco', r'reprovad', r'not[as].*baix[as]', r'vermelho', r'abaixo.*50', r'perigo'],
            'best_students': [r'melhor.*aluno', r'maior.*not[as]', r'destaque', r'top.*aluno', r'medalha', r'excel[êe]ncia'],
            'count_stats': [r'quantos', r'total', r'contar', r'n[úu]mero de', r'quantidade'],
            'report_faults': [r'faltas', r'frequ[êe]ncia', r'aus[êe]ncias', r'n[ãa]o veio', r'infrequente', r'presen[çc]a'],
            'notices': [r'comunicado', r'aviso', r'mural', r'not[íi]cia', r'[úu]ltimas novidades'],
            'occurrences': [r'ocorr[êe]ncia', r'advert[êe]ncia', r'elogio', r'comportamento', r'disciplinar'],
            'student_info': [r'quem [ée]', r'sobre o aluno', r'perfil de', r'boletim do', r'situa[çc][ãa]o de', r'dados de'],
            'dropout_radar': [r'abandono', r'evas[ãa]o', r'desistir', r'radar'],
            'evolution': [r'melhorou', r'evolu', r'progresso', r'subiu', r'piorou', r'queda'],
            'missing_grades': [r'sem not[as]', r'faltando', r'incompleto', r'pend[êe]ncia'],
            'class_comparison': [r'diferen[çc]a.*turma', r'ranking.*turma', r'turma.*melhor'],
            'pedagogical_interventions': [r'ajuda', r'interven[çc][ãa]o', r'pedag[óo]gico', r'precisa de que', r'como melhorar']
        }





    def _extract_filters(self, message: str) -> dict:
        """Extracts filters like Class (Turma), Discipline, or Student Name from message."""
        filters = {}
        msg_upper = message.upper()
        
        # 1. Extract Turmas (e.g., "6A", "9º ANO D") - Support Multiple
        turmas_found = []
        # Pattern for "7º ANO B" or "7 ANO B"
        full_matches = re.finditer(r'\b([1-9])\s*(?:º|O)?\s*ANO\s*([A-Z])\b', msg_upper)
        for m in full_matches:
            turmas_found.append(f"{m.group(1)}º ANO {m.group(2)}")
            
        # Pattern for "6A" or "9B"
        compact_matches = re.finditer(r'\b([1-9])\s*([A-Z])\b', msg_upper)
        for m in compact_matches:
            val = f"{m.group(1)}º ANO {m.group(2)}"
            if val not in turmas_found:
                turmas_found.append(val)
        
        if turmas_found:
            filters['turmas'] = turmas_found
        elif 'ANO' in msg_upper:
            ano_match = re.search(r'([1-9])\s*ANO', msg_upper)
            if ano_match:
                filters['serie'] = ano_match.group(1)
        
        # 2. Extract Turno
        if 'MATUTINO' in msg_upper or 'MANH' in msg_upper: filters['turno'] = 'Matutino'
        if 'VESPERTINO' in msg_upper or 'TARDE' in msg_upper: filters['turno'] = 'Vespertino'
        if 'NOTURNO' in msg_upper or 'NOITE' in msg_upper: filters['turno'] = 'Noturno'

        # 3. Extract Trimester
        tri_match = re.search(r'([1-3])\s*(?:º|O)?\s*(?:TRIMESTRE|TRI)', msg_upper)
        if tri_match:
            filters['trimestre'] = int(tri_match.group(1))

        # 4. Extract Student Name
        name_match = re.search(r'(?:DO ALUNO|SOBRE|QUEM [ÉE]|ALUNO)\s+([A-Z\s]{3,40})', msg_upper)
        if name_match:
            filters['aluno_nome'] = name_match.group(1).strip()

        return filters





    def process_query(self, message: str) -> AIResponse:
        message_lower = message.lower()
        filters = self._extract_filters(message)

        with session_scope() as session:
            # 1. CHART INTENT: Grade Comparison
            if any(re.search(p, message_lower) for p in self.intent_patterns['chart_grades']):
                return self._generate_grade_chart(session, filters)

            # 2. LIST INTENT: Risky Students
            if any(re.search(p, message_lower) for p in self.intent_patterns['risky_students']):
                return self._analyze_risk(session, filters)

            # 3. STATS INTENT: Counts
            if any(re.search(p, message_lower) for p in self.intent_patterns['count_stats']):
                return self._analyze_stats(session, filters)

            # 4. REPORT INTENT: Faults
            if any(re.search(p, message_lower) for p in self.intent_patterns['report_faults']):
                return self._analyze_faults(session, filters)

            # 5. LIST INTENT: Best Students
            if any(re.search(p, message_lower) for p in self.intent_patterns['best_students']):
                return self._analyze_best_students(session, filters)

            # 6. LIST INTENT: Above/Below Average (generic fallback for 'media')
            if 'acima' in message_lower and 'média' in message_lower:
                return self._analyze_performance(session, filters, above_avg=True)
            if 'abaixo' in message_lower and 'média' in message_lower:
                return self._analyze_performance(session, filters, above_avg=False)

            # 7. CHART INTENT: Hardest Subjects
            if any(re.search(p, message_lower) for p in [r'dif[íi]cil', r'complexa', r'pior.*not[as]', r'disciplina.*baix[as]']):
                return self._analyze_hardest_subjects(session, filters)

            # 8. CHART INTENT: Status Distribution
            if any(re.search(p, message_lower) for p in [r'status', r'situa[çc][ãa]o', r'aprovad', r'recupera[çc][ãa]o']):
                return self._analyze_status_stats(session, filters)

            # 9. INFO INTENT: Notices
            if any(re.search(p, message_lower) for p in self.intent_patterns['notices']):
                return self._analyze_comunicados(session, filters)

            # 10. INFO INTENT: Occurrences
            if any(re.search(p, message_lower) for p in self.intent_patterns['occurrences']):
                return self._analyze_ocorrencias(session, filters)

            # 11. LOOKUP INTENT: Student details
            if any(re.search(p, message_lower) for p in self.intent_patterns['student_info']) or filters.get('aluno_nome'):
                return self._lookup_student(session, filters)

            # 12. SPECIAL INTENT: Dropout Radar
            if any(re.search(p, message_lower) for p in self.intent_patterns['dropout_radar']):
                return self._analyze_dropout_radar(session, filters)

            # 13. SPECIAL INTENT: Missing Grades
            if any(re.search(p, message_lower) for p in self.intent_patterns['missing_grades']):
                return self._analyze_missing_grades(session, filters)

            # 14. PEDAGOGICAL INTENT: Interventions
            if any(re.search(p, message_lower) for p in self.intent_patterns['pedagogical_interventions']):
                return self._analyze_interventions(session, filters)

            return {
                "text": "Sou o AI FreiRonaldo. Posso ajudar com:\n"
                        "• Alunos em risco ou com mais faltas\n"
                        "• Comparativo de médias por turma ou disciplina\n"
                        "• Lista de melhores alunos ou destaques\n"
                        "• Mural de avisos e histórico de ocorrências\n"
                        "• Perfil detalhado de qualquer aluno\n\n"
                        "Tente: 'Quem é o aluno Pedro?', 'Quais turmas têm as menores médias?' ou 'Radar de abandono'.",
                "type": "text",
                "data": None,
                "chart_config": None
            }

    def _generate_grade_chart(self, session: Session, filters: dict) -> AIResponse:
        """Generates a dataset for a chart comparing grades."""
        # Trimester logic
        tri = filters.get('trimestre')
        target_col = Nota.total
        title_suffix = "Global"
        
        if tri == 1: target_col, title_suffix = Nota.trimestre1, "1º Tri"
        elif tri == 2: target_col, title_suffix = Nota.trimestre2, "2º Tri"
        elif tri == 3: target_col, title_suffix = Nota.trimestre3, "3º Tri"

        query = select(
            Aluno.turma, 
            func.avg(target_col).label('media_val')
        ).join(Nota).group_by(Aluno.turma)

        if filters.get('turmas'):
            query = query.where(Aluno.turma.in_(filters['turmas']))
        if filters.get('turno'):
            query = query.where(Aluno.turno == filters['turno'])
        
        results = session.execute(query).all()
        data = [{"name": r.turma, "value": round(float(r.media_val or 0), 1)} for r in results]
        data.sort(key=lambda x: x['value'], reverse=True)

        return {
            "text": f"Comparativo de médias ({title_suffix}) entre as turmas:",
            "type": "chart",
            "data": data,
            "chart_config": {
                "type": "bar",
                "xKey": "name",
                "yKey": "value",
                "color": "#14b8a6",
                "title": f"Média {title_suffix} por Turma"
            }
        }


    def _analyze_risk(self, session: Session, filters: dict) -> AIResponse:
        """List students at risk."""
        query = select(Aluno.nome, Aluno.turma, func.avg(Nota.total).label('media'))\
            .join(Nota)\
            .group_by(Aluno.id)\
            .having(func.avg(Nota.total) < 50)\
            .order_by("media")\
            .limit(10)
        
        if filters.get('turmas'):
            query = query.where(Aluno.turma.in_(filters['turmas']))
        elif filters.get('turno'):
            query = query.where(Aluno.turno == filters['turno'])


        results = session.execute(query).all()
        
        if not results:
             return {"text": "Não encontrei alunos em risco crítico com os filtros atuais.", "type": "text", "data": None, "chart_config": None}

        table_data = [{"Aluno": r.nome, "Turma": r.turma, "Média": round(r.media, 1)} for r in results]

        return {
            # Dynamic text generation based on data
            "text": f"Encontrei {len(results)} alunos com desempenho abaixo do esperado (Média < 60). A situação mais crítica é de {results[0].nome}.",
            "type": "table",
            "data": table_data,
            "chart_config": None
        }

    def _analyze_stats(self, session: Session, filters: dict) -> AIResponse:
        count = session.execute(select(func.count(Aluno.id))).scalar_one()
        return {
            "text": f"Nossa base de dados contém {count} alunos ativos matriculados.",
            "type": "text",
            "data": None, 
            "chart_config": None
        }

    def _analyze_faults(self, session: Session, filters: dict) -> AIResponse:
        """Analyze students with high absence count."""
        query = select(Aluno.nome, Aluno.turma, func.sum(Nota.faltas).label('total_faltas'))\
            .join(Nota)\
            .group_by(Aluno.id)\
            .order_by(desc('total_faltas'))\
            .limit(5)

        results = session.execute(query).all()
        data = [{"name": r.nome, "value": r.total_faltas, "extra": r.turma} for r in results]
        
        return {
            "text": "Estes são os 5 alunos com maior índice de infrequência:",
            "type": "chart",
            "data": data,
            "chart_config": {
                "type": "bar",
                "xKey": "name",
                "yKey": "value",
                "color": "#d32f2f",
                "title": "Alunos com Mais Faltas"
            }
        }

    def _analyze_best_students(self, session: Session, filters: dict) -> AIResponse:
        """List top performing students based on total grade average."""
        query = select(Aluno.nome, Aluno.turma, func.avg(Nota.total).label('media'))\
            .join(Nota)\
            .group_by(Aluno.id)\
            .order_by(desc('media'))\
            .limit(5)
        
        if filters.get('turma'):
             query = query.where(Aluno.turma == filters['turma'])

        results = session.execute(query).all()
        data = [{"Aluno": r.nome, "Turma": r.turma, "Média": round(r.media, 1)} for r in results]
        
        return {
            "text": "Aqui estão os alunos com melhor desempenho acadêmico:",
            "type": "table",
            "data": data,
            "chart_config": None
        }

    def _analyze_performance(self, session: Session, filters: dict, above_avg: bool) -> AIResponse:
        """List students above or below global average (60.0 usually, or calculated)."""
        # Calculate global average first or use fixed 60
        threshold = 60.0
        
        op = func.avg(Nota.total) >= threshold if above_avg else func.avg(Nota.total) < threshold
        direction = "acima" if above_avg else "abaixo"

        query = select(Aluno.nome, Aluno.turma, func.avg(Nota.total).label('media'))\
            .join(Nota)\
            .group_by(Aluno.id)\
            .having(op)\
            .order_by(desc('media') if above_avg else 'media')\
            .limit(10)

        if filters.get('turma'):
             query = query.where(Aluno.turma == filters['turma'])

        results = session.execute(query).all()
        
        if not results:
             return {"text": f"Não encontrei alunos {direction} da média ({threshold}) com os filtros atuais.", "type": "text", "data": None, "chart_config": None}

        data = [{"Aluno": r.nome, "Turma": r.turma, "Média": round(r.media, 1)} for r in results]
        
        return {
            "text": f"Lista de alunos com desempenho {direction} da média de {threshold}:",
            "type": "table",
            "data": data,
            "chart_config": None
        }

    def _analyze_hardest_subjects(self, session: Session, filters: dict) -> AIResponse:
        """Identify subjects with lowest average grades."""
        query = select(Nota.disciplina, func.avg(Nota.total).label('media'))\
            .group_by(Nota.disciplina)\
            .order_by('media')\
            .limit(5)
            
        results = session.execute(query).all()
        data = [{"name": r.disciplina, "value": round(r.media, 1)} for r in results]
        
        return {
            "text": "As disciplinas com as menores médias globais são:",
            "type": "chart",
            "data": data,
            "chart_config": {
                "type": "bar",
                "xKey": "name",
                "yKey": "value",
                "color": "#e65100", # Orange/Dark
                "title": "Disciplinas com Menores Médias"
            }
        }

    def _analyze_status_stats(self, session: Session, filters: dict) -> AIResponse:
        """Count students by status (APR, REP, REC, etc)."""
        query = select(Nota.situacao, func.count(Nota.id))\
            .where(Nota.situacao != None)\
            .group_by(Nota.situacao)
        
        if filters.get('turma'):
            query = query.join(Aluno).where(Aluno.turma == filters['turma'])
            
        results = session.execute(query).all()
        data = [{"name": r.situacao, "value": r[1]} for r in results if r.situacao]
        
        return {
            "text": "Distribuição dos alunos por situação final:",
            "type": "chart",
            "data": data,
            "chart_config": {
                "type": "pie",
                "xKey": "name",
                "yKey": "value",
                "title": "Situação Final dos Alunos"
            }
        }

    def _analyze_comunicados(self, session: Session, filters: dict) -> AIResponse:
        """List current notices."""
        query = select(Comunicado).where(Comunicado.arquivado == False).order_by(desc(Comunicado.data_envio)).limit(5)
        results = session.execute(query).scalars().all()
        
        if not results:
            return {"text": "Não há comunicados ativos no momento.", "type": "text", "data": None, "chart_config": None}
            
        data = [r.to_dict() for r in results]
        table_data = [{"Título": r["titulo"], "Data": r["data_envio"][:10], "Destino": r["target"]} for r in data]
        
        return {
            "text": f"Encontrei {len(results)} comunicados recentes no mural.",
            "type": "table",
            "data": table_data,
            "chart_config": None
        }

    def _analyze_ocorrencias(self, session: Session, filters: dict) -> AIResponse:
        """Summary of occurrences."""
        query = select(Ocorrencia.tipo, func.count(Ocorrencia.id)).group_by(Ocorrencia.tipo)
        
        if filters.get('aluno_nome'):
            query = query.join(Aluno).where(Aluno.nome.ilike(f"%{filters['aluno_nome']}%"))
            
        results = session.execute(query).all()
        
        if not results:
            return {"text": "Nenhuma ocorrência registrada com esses critérios.", "type": "text", "data": None, "chart_config": None}
            
        data = [{"name": r[0], "value": r[1]} for r in results]
        
        return {
            "text": "Resumo de ocorrências por tipo:",
            "type": "chart",
            "data": data,
            "chart_config": {
                "type": "bar",
                "xKey": "name",
                "yKey": "value",
                "color": "#f44336",
                "title": "Tipos de Ocorrências"
            }
        }

    def _lookup_student(self, session: Session, filters: dict) -> AIResponse:
        """Look up detailed info for a student."""
        nome = filters.get('aluno_nome')
        if not nome:
            return {"text": "Preciso do nome do aluno para buscar os detalhes. Ex: 'Quem é o aluno João?'", "type": "text", "data": None, "chart_config": None}
            
        aluno = session.execute(select(Aluno).where(Aluno.nome.ilike(f"%{nome}%"))).scalar()
        
        if not aluno:
            return {"text": f"Não encontrei nenhum aluno chamado '{nome}'.", "type": "text", "data": None, "chart_config": None}
            
        # Get grades average
        media = session.execute(select(func.avg(Nota.total)).where(Nota.aluno_id == aluno.id)).scalar()
        # Get absence count
        faltas = session.execute(select(func.sum(Nota.faltas)).where(Nota.aluno_id == aluno.id)).scalar() or 0
        
        status = "Em Risco" if (media or 0) < 50 else "Regular"
        
        return {
            "text": f"Perfil do Aluno: {aluno.nome}\nTurma: {aluno.turma} ({aluno.turno})\nMatrícula: {aluno.matricula}\nMédia Geral: {round(float(media or 0), 1)}\nTotal de Faltas: {faltas}\nSituação: {status}",
            "type": "text",
            "data": {
                "id": aluno.id,
                "nome": aluno.nome,
                "turma": aluno.turma,
                "media": round(float(media or 0), 1)
            },
            "chart_config": None
        }

    def _analyze_dropout_radar(self, session: Session, filters: dict) -> AIResponse:
        """Identify students at high risk based on multi-factor analysis (grades + attendance)."""
        # Criteria: Media < 50 AND Faltas > 10
        # This is a simplified version of the Radar de Abandono
        query = select(Aluno.nome, Aluno.turma, func.avg(Nota.total).label('media'), func.sum(Nota.faltas).label('faltas'))\
            .join(Nota)\
            .group_by(Aluno.id)\
            .having(func.avg(Nota.total) < 50)\
            .having(func.sum(Nota.faltas) > 10)\
            .order_by(desc('faltas'))\
            .limit(10)

        results = session.execute(query).all()
        
        if not results:
            return {"text": "Excelente notícia! O radar não detectou alunos em risco iminente de abandono com os critérios atuais.", "type": "text", "data": None}
            
        data = [{"Aluno": r.nome, "Turma": r.turma, "Risco": "Crítico", "Faltas": r.faltas} for r in results]
        return {
            "text": f"⚠️ **Alerta de Abandono**: Identifiquei {len(results)} alunos com alta taxa de infrequência e baixas notas. Recomendo intervenção imediata.",
            "type": "table",
            "data": data,
            "chart_config": None
        }

    def _analyze_missing_grades(self, session: Session, filters: dict) -> AIResponse:
        """Find students who have disciplinas without grades."""
        # Simple count of students who have NO grades at all or incomplete ones
        query = select(Aluno.nome, Aluno.turma, func.count(Nota.id).label('num_notas'))\
            .outerjoin(Nota)\
            .group_by(Aluno.id)\
            .having(func.count(Nota.id) < 5)\
            .limit(5)
            
        results = session.execute(query).all()
        if not results:
            return {"text": "Todos os alunos possuem o número esperado de notas lançadas.", "type": "text", "data": None}
            
        return {
            "text": "Estes alunos podem estar com o boletim incompleto (menos de 5 disciplinas lançadas):",
            "type": "table",
            "data": [{"Aluno": r.nome, "Turma": r.turma, "Notas": r.num_notas} for r in results]
        }

    def _analyze_interventions(self, session: Session, filters: dict) -> AIResponse:
        """Provide pedagogical suggestions for a student or group."""
        aluno_nome = filters.get('aluno_nome')
        if not aluno_nome:
            return {"text": "Para sugerir uma intervenção, preciso saber o nome do aluno. Ex: 'Como ajudar o aluno Carlos?'", "type": "text", "data": None}
            
        aluno = session.execute(select(Aluno).where(Aluno.nome.ilike(f"%{aluno_nome}%"))).scalar()
        if not aluno:
             return {"text": f"Não encontrei o aluno '{aluno_nome}'.", "type": "text", "data": None}
             
        analysis = intervention_service.analyze_student(session, aluno.id)
        
        if not analysis.get('interventions'):
             return {"text": f"O aluno {aluno.nome} está com bom desempenho e sem alertas pedagógicos no momento.", "type": "text", "data": None}
             
        # Format interventions into text
        intro = f"Análise Pedagógica para {aluno.nome} ({aluno.turma}):\n\n"
        details = ""
        for i in analysis['interventions']:
            details += f"• **[{i['priority']}] {i['title']}**: {i['description']}\n"
            
        return {
            "text": intro + details,
            "type": "text",
            "data": analysis
        }



# Singleton instance
ai_engine = AIAnalystEngine()

def process_chat_message(message: str) -> dict:
    return ai_engine.process_query(message)
