"""AI API endpoints."""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from loguru import logger

from ...core.database import session_scope
from ...core.decorators import require_roles
from ...services.intervention_service import intervention_service
from ...services.ai_predictor import predict_risk


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
    @require_roles("admin", "super_admin", "coordenador", "professor")
    def get_student_interventions(aluno_id):
        """Returns pedagogical interventions for a specific student."""
        try:
            with session_scope() as session:
                analysis = intervention_service.analyze_student(session, aluno_id)
            if not analysis:
                return jsonify({"error": "Aluno não encontrado"}), 404
            return jsonify(analysis)
        except Exception as e:
            logger.error(f"Error in interventions endpoint for aluno {aluno_id}: {e}")
            return jsonify({"error": "Erro interno ao processar intervenções"}), 500

    @bp.route("/ai/bulk-interventions", methods=["POST"])
    @jwt_required()
    @require_roles("admin", "super_admin", "coordenador", "professor", "diretor", "orientador")
    def get_bulk_interventions():
        """Returns interventions for a list of student IDs (dashboard 'High Risk')."""
        data = request.get_json() or {}
        student_ids = data.get("student_ids", [])

        if not isinstance(student_ids, list) or len(student_ids) > 100:
            return jsonify({"error": "student_ids deve ser uma lista com no máximo 100 IDs"}), 400

        results = []
        try:
            logger.info(f"Generating bulk interventions for {len(student_ids)} students")
            with session_scope() as session:
                for sid in student_ids:
                    analysis = intervention_service.analyze_student(session, sid)
                    if analysis:
                        results.append(analysis)

            return jsonify({"count": len(results), "results": results})
        except Exception as e:
            logger.error(f"Error in bulk interventions endpoint: {e}")
            return jsonify({"error": "Erro interno ao processar intervenções em lote"}), 500
