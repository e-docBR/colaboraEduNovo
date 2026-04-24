from flask import Blueprint, jsonify, request, g
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from sqlalchemy import desc, or_

from ...core.database import session_scope
from ...models import Comunicado, Aluno, ComunicadoLeitura

def register(parent: Blueprint) -> None:
    bp = Blueprint("comunicados", __name__)

    @bp.get("/comunicados")
    @jwt_required()
    def list_comunicados():
        user_id = int(get_jwt_identity())
        claims = get_jwt()
        roles = claims.get("roles", [])

        try:
            page = max(1, int(request.args.get("page", 1)))
            per_page = min(100, int(request.args.get("per_page", 20)))
        except (ValueError, TypeError):
            page, per_page = 1, 20
        offset = (page - 1) * per_page

        with session_scope() as session:
            is_staff = any(r in ["admin", "super_admin", "professor", "coordenador", "diretor", "orientador"] for r in roles)

            if is_staff:
                base_query = session.query(Comunicado).order_by(desc(Comunicado.data_envio))
            else:
                aluno_id = claims.get("aluno_id")
                turma_slug = None
                if aluno_id:
                    aluno = session.get(Aluno, aluno_id)
                    if aluno:
                        turma_slug = aluno.turma

                filters = [Comunicado.target_type == "TODOS"]
                if turma_slug:
                    filters.append((Comunicado.target_type == "TURMA") & (Comunicado.target_value == turma_slug))
                if aluno_id:
                    filters.append((Comunicado.target_type == "ALUNO") & (Comunicado.target_value == str(aluno_id)))

                base_query = session.query(Comunicado).filter(or_(*filters)).order_by(desc(Comunicado.data_envio))

            total = base_query.count()
            results = base_query.offset(offset).limit(per_page).all()

            # Get read IDs for this user in one query
            result_ids = [c.id for c in results]
            read_ids: set[int] = set()
            if result_ids:
                read_ids = {
                    r.comunicado_id
                    for r in session.query(ComunicadoLeitura)
                    .filter(ComunicadoLeitura.usuario_id == user_id, ComunicadoLeitura.comunicado_id.in_(result_ids))
                    .all()
                }

            output = []
            for comm in results:
                d = comm.to_dict()
                d["is_read"] = comm.id in read_ids
                output.append(d)

            return jsonify({
                "items": output,
                "meta": {"page": page, "per_page": per_page, "total": total}
            })

    @bp.post("/comunicados")
    @jwt_required()
    def create_comunicado():
        claims = get_jwt()
        roles = claims.get("roles", [])
        if not any(r in ["admin", "super_admin", "professor", "coordenador", "diretor", "orientador"] for r in roles):
            return jsonify({"error": "Acesso negado"}), 403

        data = request.json or {}
        titulo = data.get("titulo")
        conteudo = data.get("conteudo")
        if not titulo or not conteudo:
            return jsonify({"error": "Campos obrigatórios: titulo, conteudo"}), 400
            
        if len(titulo) > 200:
            return jsonify({"error": "Título muito longo (máx 200 caracteres)"}), 400
        if len(conteudo) > 50000:
            return jsonify({"error": "Conteúdo muito longo (máx 50000 caracteres)"}), 400

        target_type = data.get("target_type", "TODOS")
        target_value = data.get("target_value")

        _VALID_TYPES = {"TODOS", "TURMA", "ALUNO"}
        if target_type not in _VALID_TYPES:
            return jsonify({"error": f"target_type inválido. Valores aceitos: {sorted(_VALID_TYPES)}"}), 400

        # target_value obrigatório quando target_type exige segmentação
        if target_type in {"TURMA", "ALUNO"}:
            if not target_value or not str(target_value).strip():
                return jsonify({"error": f"target_value é obrigatório quando target_type é '{target_type}'"}), 400
            # Para ALUNO, target_value deve ser inteiro (ID do aluno)
            if target_type == "ALUNO":
                try:
                    target_value = str(int(target_value))
                except (ValueError, TypeError):
                    return jsonify({"error": "target_value deve ser um ID numérico de aluno quando target_type é 'ALUNO'"}), 400
        else:
            # TODOS: target_value não faz sentido
            target_value = None

        if not getattr(g, "academic_year_id", None):
            return jsonify({"error": "Nenhum ano letivo ativo configurado para esta escola"}), 400

        user_id = int(get_jwt_identity())

        with session_scope() as session:
            novo = Comunicado(
                titulo=data["titulo"],
                conteudo=data["conteudo"],
                autor_id=user_id,
                target_type=target_type,
                target_value=target_value,
                tenant_id=g.tenant_id,
                academic_year_id=g.academic_year_id
            )
            session.add(novo)
        
        return jsonify({"message": "Comunicado enviado!"}), 201

    @bp.patch("/comunicados/<int:comunicado_id>")
    @jwt_required()
    def update_comunicado(comunicado_id: int):
        claims = get_jwt()
        roles = claims.get("roles", [])
        user_id = int(get_jwt_identity())

        is_staff = any(r in ["admin", "super_admin", "professor", "coordenador", "diretor", "orientador"] for r in roles)
        if not is_staff:
            return jsonify({"error": "Acesso negado"}), 403

        data = request.json or {}

        with session_scope() as session:
            comunicado = (
                session.query(Comunicado)
                .filter(Comunicado.id == comunicado_id, Comunicado.tenant_id == g.tenant_id)
                .first()
            )
            if not comunicado:
                return jsonify({"error": "Comunicado não encontrado"}), 404

            # Professors can only edit their own announcements; admins/coords/directors can edit any
            is_manager = any(r in ["admin", "super_admin", "coordenador", "diretor", "orientador"] for r in roles)
            if not is_manager and comunicado.autor_id != user_id:
                return jsonify({"error": "Você só pode editar seus próprios comunicados"}), 403

            if "titulo" in data:
                if len(str(data["titulo"])) > 200:
                    return jsonify({"error": "Título muito longo (máx 200 caracteres)"}), 400
                comunicado.titulo = data["titulo"]
            if "conteudo" in data:
                if len(str(data["conteudo"])) > 50000:
                    return jsonify({"error": "Conteúdo muito longo (máx 50000 caracteres)"}), 400
                comunicado.conteudo = data["conteudo"]
            if "arquivado" in data:
                comunicado.arquivado = bool(data["arquivado"])

            session.add(comunicado)

        return jsonify({"message": "Atualizado com sucesso"}), 200

    @bp.delete("/comunicados/<int:comunicado_id>")
    @jwt_required()
    def delete_comunicado(comunicado_id: int):
        claims = get_jwt()
        roles = claims.get("roles", [])
        user_id = int(get_jwt_identity())
        
        with session_scope() as session:
            comunicado = (
                session.query(Comunicado)
                .filter(Comunicado.id == comunicado_id, Comunicado.tenant_id == g.tenant_id)
                .first()
            )
            if not comunicado:
                return jsonify({"error": "Comunicado não encontrado"}), 404

            # Permission check: Admin/Coord or Author
            has_permission = any(r in ["admin", "super_admin", "coordenador", "diretor", "orientador"] for r in roles) or comunicado.autor_id == user_id
            if not has_permission:
                return jsonify({"error": "Acesso negado"}), 403

            session.delete(comunicado)
        
        return jsonify({"message": "Removido com sucesso"}), 200

    @bp.post("/comunicados/<int:comunicado_id>/read")
    @jwt_required()
    def mark_read(comunicado_id: int):
        user_id = int(get_jwt_identity())
        with session_scope() as session:
            leitura = ComunicadoLeitura(comunicado_id=comunicado_id, usuario_id=user_id)
            session.merge(leitura)
        return jsonify({"message": "Lido"}), 200

    parent.register_blueprint(bp)
