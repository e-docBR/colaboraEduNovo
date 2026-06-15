import json
import re
from typing import Dict, Any, List
from sqlalchemy import select
from sqlalchemy.orm import Session
from loguru import logger

from ..models.aluno import Aluno
from ..models.nota import Nota
from ..models.ocorrencia import Ocorrencia
from ..models.ai_configuration import AIConfiguration
from ..models.pedagogical_feedback import PedagogicalFeedback
from .llm_provider import call_llm


class PedagogicalAgentService:
    @staticmethod
    def _clean_json_response(content: str) -> str:
        """Cleans Markdown JSON wrapper block if present."""
        if not content:
            return ""
        content = content.strip()
        # Remove ```json ... ``` or ``` ... ```
        match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", content)
        if match:
            return match.group(1).strip()
        return content

    @classmethod
    def get_student_context(cls, session: Session, tenant_id: int, academic_year_id: int, aluno_id: int) -> Dict[str, Any]:
        """Gathers all relevant context for a student."""
        aluno = session.execute(
            select(Aluno).where(
                Aluno.id == aluno_id,
                Aluno.tenant_id == tenant_id,
                Aluno.academic_year_id == academic_year_id
            )
        ).scalar_one_or_none()

        if not aluno:
            return {}

        # Notas e faltas
        notas = session.execute(
            select(Nota).where(
                Nota.aluno_id == aluno_id,
                Nota.tenant_id == tenant_id,
                Nota.academic_year_id == academic_year_id
            )
        ).scalars().all()

        # Ocorrências comportamentais
        ocorrencias = session.execute(
            select(Ocorrencia).where(
                Ocorrencia.aluno_id == aluno_id,
                Ocorrencia.tenant_id == tenant_id,
                Ocorrencia.academic_year_id == academic_year_id
            )
        ).scalars().all()

        total_faltas = sum(n.faltas or 0 for n in notas)
        notas_list = []
        for n in notas:
            notas_list.append({
                "disciplina": n.disciplina,
                "nota_total": float(n.total or 0),
                "faltas": n.faltas or 0
            })

        ocorrencias_list = []
        for oc in ocorrencias:
            ocorrencias_list.append({
                "tipo": oc.tipo,
                "descricao": oc.descricao,
                "gravidade": oc.gravidade,
                "data": oc.data_registro.strftime("%Y-%m-%d") if oc.data_registro else ""
            })

        return {
            "aluno_nome": aluno.nome,
            "turma": aluno.turma,
            "total_faltas": total_faltas,
            "notas": notas_list,
            "ocorrencias": ocorrencias_list
        }

    @classmethod
    def get_few_shot_examples(cls, session: Session, tenant_id: int, academic_year_id: int) -> List[Dict[str, Any]]:
        """Retrieves recently approved pedagogical plans to serve as few-shot examples."""
        feedbacks = session.execute(
            select(PedagogicalFeedback)
            .where(
                PedagogicalFeedback.tenant_id == tenant_id,
                PedagogicalFeedback.academic_year_id == academic_year_id,
                PedagogicalFeedback.status == "APROVADO"
            )
            .order_by(PedagogicalFeedback.updated_at.desc())
            .limit(3)
        ).scalars().all()

        examples = []
        for fb in feedbacks:
            examples.append({
                "diagnostico": fb.diagnostico,
                "metas": fb.metas,
                "acoes": fb.acoes_finais or fb.acoes
            })
        return examples

    @classmethod
    def generate_plan(cls, session: Session, tenant_id: int, academic_year_id: int, aluno_id: int) -> Dict[str, Any]:
        """Generates a structured pedagogical intervention plan via AI."""
        try:
            # 1. Configurações da IA
            ai_config = session.execute(
                select(AIConfiguration).where(AIConfiguration.tenant_id == tenant_id)
            ).scalar_one_or_none()

            if not ai_config or not ai_config.is_active or not ai_config.api_key:
                logger.warning(f"AI not configured or inactive for tenant {tenant_id}")
                return {"error": "IA não configurada ou desativada para a escola"}

            # 2. Contexto do aluno e da escola
            context = cls.get_student_context(session, tenant_id, academic_year_id, aluno_id)
            if not context:
                return {"error": "Aluno não encontrado"}

            few_shot = cls.get_few_shot_examples(session, tenant_id, academic_year_id)

            school_guidelines = ai_config.system_prompt or "Trate o aluno com empatia, buscando soluções colaborativas entre escola, família e professores."

            # 3. Construção dos prompts
            system_prompt = (
                "Você é um Agente Pedagógico Profissional e Coordenador Escolar experiente.\n"
                "Sua missão é analisar o desempenho acadêmico (notas e faltas) e o comportamento do aluno "
                "para formular um Plano de Intervenção Pedagógica ÚNICO e INTEGRADO.\n\n"
                f"Diretrizes Pedagógicas da Escola:\n{school_guidelines}\n\n"
                "INSTRUÇÕES DE FORMATAÇÃO:\n"
                "Você deve responder ESTRITAMENTE com um objeto JSON estruturado contendo exatamente as seguintes chaves:\n"
                "- 'global_risk': Nível de risco global do aluno (ALTO, MEDIO ou BAIXO)\n"
                "- 'diagnostico': Diagnóstico resumido, profissional e empático que conecte as notas, faltas e comportamento.\n"
                "- 'metas': Uma lista (Array de strings) de metas educacionais específicas a curto prazo.\n"
                "- 'acoes': Uma lista de ações recomendadas (Array de objetos) onde cada objeto contém:\n"
                "    - 'title': Título curto e direto da ação.\n"
                "    - 'description': Instruções detalhadas para execução pela escola/família.\n"
                "    - 'priority': Prioridade (HIGH, MEDIUM, LOW)\n"
                "    - 'type': Categoria (ACADEMIC, BEHAVIORAL ou EMERGENCY)\n"
                "\nNão insira explicações, tags html ou blocos markdown adicionais no início ou no fim da resposta. Responda apenas com o JSON bruto."
            )

            # Preparação das notas/ocorrências para o prompt
            notas_str = "\n".join([f"- {n['disciplina']}: Nota {n['nota_total']} (Faltas: {n['faltas']})" for n in context['notas']])
            oc_str = "\n".join([f"- [{o['gravidade']}] {o['tipo']}: {o['descricao']}" for o in context['ocorrencias']]) if context['ocorrencias'] else "Nenhuma ocorrência registrada."

            few_shot_str = json.dumps(few_shot, ensure_ascii=False, indent=2) if few_shot else "Nenhum exemplo disponível ainda."

            user_prompt = (
                f"Aluno: {context['aluno_nome']}\n"
                f"Turma: {context['turma']}\n"
                f"Faltas Totais: {context['total_faltas']}\n\n"
                f"Boletim do Aluno:\n{notas_str}\n\n"
                f"Histórico Disciplinar:\n{oc_str}\n\n"
                f"Exemplos de Planos de Sucesso Aprovados na Escola:\n{few_shot_str}\n\n"
                "Gere o plano de intervenção em formato JSON conforme especificado nas instruções de formatação."
            )

            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]

            # 4. Chamada do LLM
            logger.info(f"Calling LLM ({ai_config.model_name}) for pedagogical agent plan: {context['aluno_nome']}")
            response_text = call_llm(ai_config, messages)

            if not response_text:
                return {"error": "Falha na resposta do assistente de IA"}

            # 5. Parse da Resposta
            clean_text = cls._clean_json_response(response_text)
            try:
                plan_data = json.loads(clean_text)
            except json.JSONDecodeError as je:
                logger.error(f"Failed to parse JSON response from LLM pedagogical agent: {je}. Raw response: {response_text}")
                # Tentativa de salvamento emergencial usando regex
                return {"error": "Erro de formatação na resposta da IA. Tente gerar novamente."}

            return {
                "aluno_nome": context['aluno_nome'],
                "aluno_id": aluno_id,
                "turma": context['turma'],
                "global_risk": plan_data.get("global_risk", "MEDIO"),
                "diagnostico": plan_data.get("diagnostico", ""),
                "metas": plan_data.get("metas", []),
                "acoes": plan_data.get("acoes", []),
                "stats": {
                    "total_faltas": context['total_faltas'],
                    "disciplinas_abaixo_media": len([n for n in context['notas'] if n['nota_total'] < 60])
                }
            }

        except Exception as e:
            logger.exception(f"Error in pedagogical agent plan generation: {e}")
            return {"error": f"Erro interno: {str(e)}"}


pedagogical_agent_service = PedagogicalAgentService()
