"""Alunos endpoints."""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from pydantic import ValidationError

from ...core.database import session_scope
from ...core.decorators import require_roles, admin_required
from ...services.aluno_service import AlunoService
from ...schemas.aluno import AlunoCreate, AlunoUpdate


def register(parent: Blueprint) -> None:
    bp = Blueprint("alunos", __name__)

    @bp.get("/alunos")
    @jwt_required()
    @require_roles("admin", "super_admin", "coordenador", "diretor", "orientador", "professor")
    def list_alunos():
            
        try:
            page = max(1, int(request.args.get("page", 1)))
            per_page = min(200, int(request.args.get("per_page", 20)))
        except (ValueError, TypeError):
            page, per_page = 1, 20
        turno = request.args.get("turno")
        turma = request.args.get("turma")
        query_text = request.args.get("q")

        user_id = int(get_jwt_identity())
        with session_scope() as session:
            service = AlunoService(session, user_id=user_id)
            result = service.list_alunos(
                page=page,
                per_page=per_page,
                turno=turno,
                turma=turma,
                query_text=query_text
            )
            
            # Pydantic v2 use model_dump
            return jsonify(result.model_dump())

    @bp.get("/alunos/<int:aluno_id>")
    @jwt_required()
    def retrieve_aluno(aluno_id: int):
        claims = get_jwt()
        aluno_claim_id = claims.get("aluno_id")
        
        if "aluno" in (claims.get("roles") or []):
            if not aluno_claim_id or int(aluno_claim_id) != int(aluno_id):
                return jsonify({"error": "Acesso restrito"}), 403
                
        user_id = int(get_jwt_identity())
        with session_scope() as session:
            service = AlunoService(session, user_id=user_id)
            aluno_detail = service.get_aluno_details(aluno_id)
            
            if not aluno_detail:
                return jsonify({"error": "Aluno não encontrado"}), 404

            return jsonify(aluno_detail.model_dump())

    @bp.post("/alunos")
    @jwt_required()
    @require_roles("admin", "super_admin", "coordenador", "diretor", "orientador")
    def create_aluno():
        data = request.get_json() or {}
        try:
            # Validate input using Pydantic
            payload = AlunoCreate(**data)
        except ValidationError as e:
             return jsonify(e.errors()), 400
             
        user_id = int(get_jwt_identity())
        with session_scope() as session:
            service = AlunoService(session, user_id=user_id)
            aluno = service.create_aluno(payload.model_dump())
            from ...core.cache import invalidate_tenant_cache
            invalidate_tenant_cache()
            return jsonify(aluno.model_dump()), 201

    @bp.patch("/alunos/<int:aluno_id>")
    @jwt_required()
    @require_roles("admin", "super_admin", "coordenador", "diretor", "orientador")
    def update_aluno(aluno_id: int):
        data = request.get_json() or {}
        try:
            # Partial validation
            payload = AlunoUpdate(**data)
        except ValidationError as e:
            return jsonify(e.errors()), 400
            
        user_id = int(get_jwt_identity())
        with session_scope() as session:
            service = AlunoService(session, user_id=user_id)
            aluno = service.update_aluno(aluno_id, data)
            if not aluno:
                return jsonify({"error": "Aluno não encontrado"}), 404
            from ...core.cache import invalidate_tenant_cache
            invalidate_tenant_cache()
            return jsonify(aluno.model_dump())

    @bp.delete("/alunos/<int:aluno_id>")
    @jwt_required()
    @require_roles("admin", "super_admin", "coordenador", "diretor")
    def delete_aluno(aluno_id: int):
            
        user_id = int(get_jwt_identity())
        with session_scope() as session:
            service = AlunoService(session, user_id=user_id)
            if service.delete_aluno(aluno_id):
                from ...core.cache import invalidate_tenant_cache
                invalidate_tenant_cache()
                return "", 204
            return jsonify({"error": "Aluno não encontrado"}), 404

    @bp.get("/alunos/<int:aluno_id>/boletim/pdf")
    @jwt_required()
    def download_bulletin_pdf(aluno_id: int):
        from flask import send_file, g
        from ...services.document_service import DocumentService
        
        with session_scope() as session:
            service = AlunoService(session)
            aluno_data = service.get_bulletin_data(aluno_id)
            
            if not aluno_data:
                return jsonify({"error": "Aluno não encontrado"}), 404
            
            from ...models import Tenant, AcademicYear
            
            tenant = session.get(Tenant, g.tenant_id)
            school_name = tenant.name if tenant else "ColaboraEDU"
            
            import datetime
            year_label = str(datetime.date.today().year)
            if g.get("academic_year_id"):
                year = session.get(AcademicYear, g.academic_year_id)
                if year:
                    year_label = year.label

            html = DocumentService.render_bulletin_html(aluno_data, school_name, year_label)
            pdf_bytes = DocumentService.generate_pdf_from_html(html)
            
            filename = f"Boletim_{aluno_data['nome'].replace(' ', '_')}.pdf"
            return send_file(
                pdf_bytes,
                mimetype="application/pdf",
                as_attachment=True,
                download_name=filename
            )

    parent.register_blueprint(bp)
