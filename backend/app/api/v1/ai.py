"""AI API endpoints."""
from flask import Blueprint, jsonify, request, g
from flask_jwt_extended import jwt_required
from loguru import logger
from sqlalchemy import select, desc

from ...core.database import session_scope
from ...core.decorators import require_roles
from ...models.pedagogical_feedback import PedagogicalFeedback
from ...services.intervention_service import intervention_service
from ...services.ai_predictor import predict_risk
from ...services.pedagogical_agent_service import pedagogical_agent_service


def register(bp: Blueprint):
    @bp.route("/ai/risk/<int:aluno_id>", methods=["GET"])
    @jwt_required()
    @require_roles("admin", "super_admin", "coordenador", "professor", "diretor", "orientador")
    def get_student_risk(aluno_id):
        """Returns ML risk prediction for a specific student."""
        try:
            with session_scope() as session:
                result = predict_risk(aluno_id, session)
            if result.get("status") == "INEXISTENTE":
                return jsonify({"error": "Aluno não encontrado"}), 404
            return jsonify(result)
        except Exception as e:
            logger.error(f"Error in risk endpoint for aluno {aluno_id}: {e}")
            return jsonify({"error": "Erro interno ao processar risco"}), 500

    @bp.route("/ai/interventions/<int:aluno_id>", methods=["GET"])
    @jwt_required()
    @require_roles("admin", "super_admin", "coordenador", "professor", "diretor", "orientador")
    def get_student_interventions(aluno_id):
        """Returns active pedagogical plan or falls back to heuristics."""
        try:
            tenant_id = g.tenant_id
            year_id = g.academic_year_id

            with session_scope() as session:
                # 1. Tenta buscar plano aprovado recente
                plan = session.execute(
                    select(PedagogicalFeedback)
                    .where(
                        PedagogicalFeedback.aluno_id == aluno_id,
                        PedagogicalFeedback.tenant_id == tenant_id,
                        PedagogicalFeedback.academic_year_id == year_id,
                        PedagogicalFeedback.status == "APROVADO"
                    )
                    .order_by(PedagogicalFeedback.updated_at.desc())
                    .limit(1)
                ).scalar_one_or_none()

                if plan:
                    res = plan.to_dict()
                    # Transforma formato para manter compatibilidade com frontend
                    res["interventions"] = plan.acoes_finais or plan.acoes
                    res["global_risk"] = plan.global_risk
                    return jsonify(res)

                # 2. Tenta buscar plano pendente recente
                draft = session.execute(
                    select(PedagogicalFeedback)
                    .where(
                        PedagogicalFeedback.aluno_id == aluno_id,
                        PedagogicalFeedback.tenant_id == tenant_id,
                        PedagogicalFeedback.academic_year_id == year_id,
                        PedagogicalFeedback.status == "PENDENTE"
                    )
                    .order_by(PedagogicalFeedback.created_at.desc())
                    .limit(1)
                ).scalar_one_or_none()

                if draft:
                    res = draft.to_dict()
                    res["interventions"] = draft.acoes
                    res["global_risk"] = draft.global_risk
                    return jsonify(res)

                # 3. Fallback para heurística
                analysis = intervention_service.analyze_student(session, aluno_id)
                if not analysis:
                    return jsonify({"error": "Aluno não encontrado"}), 404
                return jsonify(analysis)

        except Exception as e:
            logger.exception(f"Error in interventions endpoint for aluno {aluno_id}: {e}")
            return jsonify({"error": "Erro interno ao processar intervenções"}), 500

    @bp.route("/ai/bulk-interventions", methods=["POST"])
    @jwt_required()
    @require_roles("admin", "super_admin", "coordenador", "professor", "diretor", "orientador")
    def get_bulk_interventions():
        """Returns interventions for a list of student IDs."""
        data = request.get_json() or {}
        student_ids = data.get("student_ids", [])

        if not isinstance(student_ids, list) or len(student_ids) > 100:
            return jsonify({"error": "student_ids deve ser uma lista com no máximo 100 IDs"}), 400

        results = []
        try:
            tenant_id = g.tenant_id
            year_id = g.academic_year_id

            with session_scope() as session:
                for sid in student_ids:
                    # Tenta carregar plano aprovado/pendente
                    plan = session.execute(
                        select(PedagogicalFeedback)
                        .where(
                            PedagogicalFeedback.aluno_id == sid,
                            PedagogicalFeedback.tenant_id == tenant_id,
                            PedagogicalFeedback.academic_year_id == year_id,
                            PedagogicalFeedback.status.in_(["APROVADO", "PENDENTE"])
                        )
                        .order_by(desc(PedagogicalFeedback.updated_at))
                        .limit(1)
                    ).scalar_one_or_none()

                    if plan:
                        res = plan.to_dict()
                        res["interventions"] = plan.acoes_finais or plan.acoes
                        results.append(res)
                    else:
                        analysis = intervention_service.analyze_student(session, sid)
                        if analysis:
                            results.append(analysis)

            return jsonify({"count": len(results), "results": results})
        except Exception as e:
            logger.error(f"Error in bulk interventions endpoint: {e}")
            return jsonify({"error": "Erro interno ao processar intervenções em lote"}), 500

    @bp.route("/ai/interventions/generate", methods=["POST"])
    @jwt_required()
    @require_roles("admin", "super_admin", "coordenador", "professor")
    def generate_pedagogical_plan():
        """Generates pedagogical action plan via AI agent and stores draft in DB."""
        data = request.get_json() or {}
        aluno_id = data.get("aluno_id")

        if not aluno_id:
            return jsonify({"error": "aluno_id é obrigatório"}), 400

        try:
            tenant_id = g.tenant_id
            year_id = g.academic_year_id

            with session_scope() as session:
                # 1. Gera plano via serviço de IA
                plan = pedagogical_agent_service.generate_plan(session, tenant_id, year_id, aluno_id)
                if "error" in plan:
                    return jsonify({"error": plan["error"]}), 400

                # 2. Cria registro PENDENTE no banco
                db_plan = PedagogicalFeedback(
                    tenant_id=tenant_id,
                    academic_year_id=year_id,
                    aluno_id=aluno_id,
                    global_risk=plan.get("global_risk", "MEDIO"),
                    diagnostico=plan.get("diagnostico", ""),
                    metas=plan.get("metas", []),
                    acoes=plan.get("acoes", []),
                    status="PENDENTE"
                )
                session.add(db_plan)
                session.flush() # Obtém o id gerado

                res = db_plan.to_dict()
                return jsonify(res)

        except Exception as e:
            logger.exception(f"Error generating plan: {e}")
            return jsonify({"error": "Erro interno ao gerar plano pedagógico"}), 500

    @bp.route("/ai/interventions/save-feedback", methods=["POST"])
    @jwt_required()
    @require_roles("admin", "super_admin", "coordenador", "professor")
    def save_pedagogical_feedback():
        """Saves pedagogical feedback from user (Approve, Reject, Edit)."""
        data = request.get_json() or {}
        plan_id = data.get("id")
        status = data.get("status") # APROVADO, REJEITADO
        feedback_usuario = data.get("feedback_usuario", "")
        acoes_finais = data.get("acoes_finais") # Lista editada pelo professor

        if not plan_id or not status:
            return jsonify({"error": "id e status são obrigatórios"}), 400

        if status not in ["APROVADO", "REJEITADO"]:
            return jsonify({"error": "status deve ser 'APROVADO' ou 'REJEITADO'"}), 400

        try:
            tenant_id = g.tenant_id

            with session_scope() as session:
                plan = session.execute(
                    select(PedagogicalFeedback).where(
                        PedagogicalFeedback.id == plan_id,
                        PedagogicalFeedback.tenant_id == tenant_id
                    )
                ).scalar_one_or_none()

                if not plan:
                    return jsonify({"error": "Plano não encontrado"}), 404

                plan.status = status
                plan.feedback_usuario = feedback_usuario
                if acoes_finais is not None:
                    plan.acoes_finais = acoes_finais
                    plan.edited = True
                else:
                    plan.acoes_finais = plan.acoes
                    plan.edited = False

                return jsonify(plan.to_dict())

        except Exception as e:
            logger.exception(f"Error saving feedback: {e}")
            return jsonify({"error": "Erro interno ao salvar feedback pedagógico"}), 500

    @bp.route("/ai/interventions/history/<int:aluno_id>", methods=["GET"])
    @jwt_required()
    @require_roles("admin", "super_admin", "coordenador", "professor", "diretor", "orientador")
    def get_pedagogical_history(aluno_id):
        """Returns historical approved pedagogical plans for a student."""
        try:
            tenant_id = g.tenant_id
            year_id = g.academic_year_id

            with session_scope() as session:
                feedbacks = session.execute(
                    select(PedagogicalFeedback)
                    .where(
                        PedagogicalFeedback.aluno_id == aluno_id,
                        PedagogicalFeedback.tenant_id == tenant_id,
                        PedagogicalFeedback.academic_year_id == year_id,
                        PedagogicalFeedback.status == "APROVADO"
                    )
                    .order_by(PedagogicalFeedback.updated_at.desc())
                ).scalars().all()

                return jsonify([fb.to_dict() for fb in feedbacks])

        except Exception as e:
            logger.error(f"Error in pedagogical history endpoint: {e}")
            return jsonify({"error": "Erro interno ao buscar histórico de intervenções"}), 500
