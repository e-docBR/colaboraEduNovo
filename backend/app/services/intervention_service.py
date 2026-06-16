"""Pedagogical Intervention Service for ColaboraEdu."""
from typing import Dict, Any
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..models import Nota, Aluno
from loguru import logger

class PedagogicalInterventionService:
    @staticmethod
    def get_subject_category(disciplina: str) -> str:
        """Categorizes subjects to provide clustered insights."""
        disciplina = disciplina.upper()
        categories = {
            "EXATAS": ["MATEMATICA", "FISICA", "QUIMICA", "LOGICA"],
            "HUMANAS": ["HISTORIA", "GEOGRAFIA", "SOCIOLOGIA", "FILOSOFIA"],
            "LINGUAGENS": ["PORTUGUES", "INGLES", "ESPANHOL", "ARTES", "LITERATURA", "LINGUA"],
            "BIOLOGICAS": ["CIENCIAS", "BIOLOGIA"],
            "OUTROS": ["EDUCACAO FISICA", "ENSINO RELIGIOSO"]
        }
        
        for cat, subjects in categories.items():
            if any(s in disciplina for s in subjects):
                return cat
        return "GERAL"

    @staticmethod
    def analyze_student(session: Session, aluno_id: int) -> Dict[str, Any]:
        """
        Analyzes a student's performance and generates actionable pedagogical interventions.
        """
        try:
            from flask import g
            tenant_id = getattr(g, "tenant_id", None)
            year_id = getattr(g, "academic_year_id", None)

            # Tenant obrigatório — falhar explicitamente para evitar vazamento cross-tenant
            if not tenant_id:
                logger.error("analyze_student chamado sem tenant_id no contexto Flask g (aluno_id={})", aluno_id)
                return {"error": "Contexto de tenant obrigatório"}

            aluno_query = session.query(Aluno).filter(
                Aluno.id == aluno_id,
                Aluno.tenant_id == tenant_id,
            )
            if year_id:
                aluno_query = aluno_query.filter(Aluno.academic_year_id == year_id)
            aluno = aluno_query.first()
            if not aluno:
                return {}

            stm = select(Nota).where(Nota.aluno_id == aluno_id, Nota.tenant_id == tenant_id)
            if year_id:
                stm = stm.where(Nota.academic_year_id == year_id)
            notas = session.execute(stm).scalars().all()
            
            if not notas:
                return {
                    "aluno_nome": aluno.nome,
                    "status": "DADOS_INSUFICIENTES",
                    "interventions": []
                }

            # 1. Performance Analysis
            low_performing_subjects = []
            categories_risk = {}
            total_faltas = 0
            
            for nota in notas:
                score = float(nota.total or 0)
                total_faltas += (nota.faltas or 0)
                
                if score < 60:
                    cat = PedagogicalInterventionService.get_subject_category(nota.disciplina)
                    low_performing_subjects.append({
                        "disciplina": nota.disciplina,
                        "media": score,
                        "faltas": nota.faltas,
                        "category": cat
                    })
                    categories_risk[cat] = categories_risk.get(cat, 0) + 1

            interventions = []
            
            # 2. Logic for Intervention Generation
            # Priority A: Attendance
            if total_faltas > 20:
                interventions.append({
                    "priority": "HIGH",
                    "type": "BEHAVIORAL",
                    "title": "Monitoramento de Infrequência",
                    "description": f"O aluno apresenta {total_faltas} faltas. Recomenda-se contato imediato com os responsáveis para entender o motivo das ausências.",
                    "impact": "EVASAO_ESCOLAR"
                })

            # Priority B: Targeted Academic Support
            for cat, count in categories_risk.items():
                if count >= 2:
                    interventions.append({
                        "priority": "MEDIUM",
                        "type": "ACADEMIC",
                        "title": f"Reforço em {cat.capitalize()}",
                        "description": f"Dificuldade acumulada em disciplinas de {cat}. Sugere-se encaminhamento para aulas de reforço ou material complementar focado nesse cluster.",
                        "impact": "RETENCAO_CONTEUDO"
                    })

            # Priority C: Specific Subject Crisis
            for lp in low_performing_subjects:
                if lp['media'] < 40:
                    interventions.append({
                        "priority": "HIGH",
                        "type": "EMERGENCY",
                        "title": f"Alerta Crítico: {lp['disciplina']}",
                        "description": f"O desempenho em {lp['disciplina']} ({lp['media']}) está muito abaixo do esperado. Recomenda-se avaliação individual para detectar lacunas de base.",
                        "impact": "REPROVACAO"
                    })

            # Default if everything is fine
            if not interventions and not low_performing_subjects:
                interventions.append({
                    "priority": "LOW",
                    "type": "MAINTENANCE",
                    "title": "Incentivo e Extensão",
                    "description": "O aluno mantém bom desempenho. Sugerir atividades de monitoria ou projetos de extensão para manter o engajamento.",
                    "impact": "EXCELENCIA"
                })

            return {
                "aluno_nome": aluno.nome,
                "aluno_id": aluno_id,
                "turma": aluno.turma,
                "global_risk": "ALTO" if any(i['priority'] == 'HIGH' for i in interventions) else "MEDIO" if interventions else "BAIXO",
                "interventions": interventions,
                "stats": {
                    "total_faltas": total_faltas,
                    "disciplinas_abaixo_media": len(low_performing_subjects)
                }
            }

        except Exception as e:
            logger.error(f"Error analyzing student {aluno_id}: {e}")
            return {"error": "Não foi possível analisar o aluno. Tente novamente."}

# Singleton helper
intervention_service = PedagogicalInterventionService()
