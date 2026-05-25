import re

from flask import Blueprint, jsonify, request, g
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from sqlalchemy import desc, or_
from sqlalchemy.orm import selectinload

from ...core.database import session_scope
from ...core.helpers import parse_pagination
from ...core.roles import STAFF_ROLES, MANAGER_ROLES, COMUNICADO_WRITE_ROLES
from ...models import Comunicado, Aluno, ComunicadoLeitura

_STRIP_TAGS_RE = re.compile(r"<[^>]+>")


def _sanitize_text(value: str) -> str:
    """Strip HTML tags from text to prevent stored XSS."""
    return _STRIP_TAGS_RE.sub("", value)


def _can_user_read_comunicado(session, comunicado: Comunicado, roles: list[str], claims: dict) -> bool:
    """Return True only when the comunicado is visible to the current user."""
    if STAFF_ROLES.intersection(roles):
        return True

    aluno_id = claims.get("aluno_id")
    if comunicado.target_type == "TODOS":
        return True

    if not aluno_id:
        return False
    try:
        aluno_id_int = int(aluno_id)
    except (TypeError, ValueError):
        return False

    if comunicado.target_type == "ALUNO":
        return comunicado.target_value == str(aluno_id_int)

    if comunicado.target_type == "TURMA":
        aluno = (
            session.query(Aluno)
            .filter(Aluno.id == aluno_id_int, Aluno.tenant_id == g.tenant_id)
            .first()
        )
        return bool(aluno and aluno.turma == comunicado.target_value)

    return False

def register(parent: Blueprint) -> None:
    bp = Blueprint("comunicados", __name__)

    @bp.get("/comunicados")
    @jwt_required()
    def list_comunicados():
        user_id = int(get_jwt_identity())
        claims = get_jwt()
        roles = claims.get("roles", [])

        page, per_page = parse_pagination()
        offset = (page - 1) * per_page

        with session_scope() as session:
            is_staff = bool(STAFF_ROLES.intersection(roles))
            incluir_arquivados = is_staff and request.args.get("arquivados") == "true"

            if is_staff:
                base_query = session.query(Comunicado).order_by(desc(Comunicado.data_envio))
                if not incluir_arquivados:
                    base_query = base_query.filter(Comunicado.arquivado == False)  # noqa: E712
            else:
                aluno_id = claims.get("aluno_id")
                turma_slug = None
                if aluno_id:
                    # C1: scoped query prevents cross-tenant Aluno lookup
                    aluno = (
                        session.query(Aluno)
                        .filter(Aluno.id == int(aluno_id), Aluno.tenant_id == g.tenant_id)
                        .first()
                    )
                    if aluno:
                        turma_slug = aluno.turma

                filters = [Comunicado.target_type == "TODOS"]
                if turma_slug:
                    filters.append((Comunicado.target_type == "TURMA") & (Comunicado.target_value == turma_slug))
                if aluno_id:
                    filters.append((Comunicado.target_type == "ALUNO") & (Comunicado.target_value == str(aluno_id)))

                base_query = (
                    session.query(Comunicado)
                    .filter(or_(*filters))
                    .filter(Comunicado.arquivado == False)  # noqa: E712
                    .order_by(desc(Comunicado.data_envio))
                )

            total = base_query.count()
            results = base_query.options(selectinload(Comunicado.autor)).offset(offset).limit(per_page).all()

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
        if not COMUNICADO_WRITE_ROLES.intersection(roles):
            return jsonify({"error": "Acesso negado"}), 403

        data = request.json or {}
        titulo = data.get("titulo")
        conteudo = data.get("conteudo")
        if not titulo or not conteudo:
            return jsonify({"error": "Campos obrigatórios: titulo, conteudo"}), 400

        # Sanitize inputs to prevent stored XSS
        titulo = _sanitize_text(str(titulo).strip())
        conteudo = _sanitize_text(str(conteudo).strip())

        if len(titulo) > 200:
            return jsonify({"error": "Título muito longo (máx 200 caracteres)"}), 400
        if len(conteudo) > 50000:
            return jsonify({"error": "Conteúdo muito longo (máx 50000 caracteres)"}), 400

        target_type = data.get("target_type", "TODOS")
        target_value = data.get("target_value")

        _VALID_TYPES = {"TODOS", "TURMA", "ALUNO", "PROFESSOR"}
        if target_type not in _VALID_TYPES:
            return jsonify({"error": f"target_type inválido. Valores aceitos: {sorted(_VALID_TYPES)}"}), 400

        # target_value obrigatório quando target_type exige segmentação
        if target_type in {"TURMA", "ALUNO"}:
            if not target_value or not str(target_value).strip():
                return jsonify({"error": f"target_value é obrigatório quando target_type é '{target_type}'"}), 400
            # Para ALUNO, target_value deve ser inteiro (ID do aluno) e o aluno deve existir
            if target_type == "ALUNO":
                try:
                    aluno_id_val = int(target_value)
                    target_value = str(aluno_id_val)
                except (ValueError, TypeError):
                    return jsonify({"error": "target_value deve ser um ID numérico de aluno quando target_type é 'ALUNO'"}), 400
            elif target_type == "TURMA":
                target_value = str(target_value).strip()
                if len(target_value) > 100:
                    return jsonify({"error": "target_value muito longo para TURMA"}), 400
        else:
            # TODOS: target_value não faz sentido
            target_value = None

        if not getattr(g, "academic_year_id", None):
            return jsonify({"error": "Nenhum ano letivo ativo configurado para esta escola"}), 400

        notificar_responsaveis = bool(data.get("notificar_responsaveis", False))
        user_id = int(get_jwt_identity())

        comunicado_id = None
        with session_scope() as session:
            # Validar existência do aluno para comunicados direcionados
            if target_type == "ALUNO":
                from ...models import Aluno
                aluno_obj = session.query(Aluno).filter(
                    Aluno.id == int(target_value), Aluno.tenant_id == g.tenant_id
                ).first()
                if not aluno_obj:
                    return jsonify({"error": f"Aluno com ID {target_value} não encontrado nesta escola"}), 400

            novo = Comunicado(
                titulo=titulo,
                conteudo=conteudo,
                autor_id=user_id,
                target_type=target_type,
                target_value=target_value,
                tenant_id=g.tenant_id,
                academic_year_id=g.academic_year_id
            )
            session.add(novo)
            session.flush()
            comunicado_id = novo.id

        if notificar_responsaveis and comunicado_id:
            from ...core.queue import queue
            from ...core.tasks_comunicados import notify_comunicado_task
            queue.enqueue(
                notify_comunicado_task,
                comunicado_id,
                job_timeout=300,
                meta={"tenant_id": g.tenant_id, "comunicado_id": comunicado_id},
            )

        return jsonify({"message": "Comunicado enviado!", "id": comunicado_id}), 201

    @bp.patch("/comunicados/<int:comunicado_id>")
    @jwt_required()
    def update_comunicado(comunicado_id: int):
        claims = get_jwt()
        roles = claims.get("roles", [])
        user_id = int(get_jwt_identity())

        if not COMUNICADO_WRITE_ROLES.intersection(roles):
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
            is_manager = bool(MANAGER_ROLES.intersection(roles))
            if not is_manager and comunicado.autor_id != user_id:
                return jsonify({"error": "Você só pode editar seus próprios comunicados"}), 403

            if "titulo" in data:
                sanitized_titulo = _sanitize_text(str(data["titulo"]).strip())
                if len(sanitized_titulo) > 200:
                    return jsonify({"error": "Título muito longo (máx 200 caracteres)"}), 400
                comunicado.titulo = sanitized_titulo
            if "conteudo" in data:
                sanitized_conteudo = _sanitize_text(str(data["conteudo"]).strip())
                if len(sanitized_conteudo) > 50000:
                    return jsonify({"error": "Conteúdo muito longo (máx 50000 caracteres)"}), 400
                comunicado.conteudo = sanitized_conteudo
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

            # Permission check: must be in write roles AND (manager OR own comunicado)
            if not COMUNICADO_WRITE_ROLES.intersection(roles):
                return jsonify({"error": "Acesso negado"}), 403
            has_permission = bool(MANAGER_ROLES.intersection(roles)) or comunicado.autor_id == user_id
            if not has_permission:
                return jsonify({"error": "Acesso negado"}), 403

            session.delete(comunicado)
        
        return jsonify({"message": "Removido com sucesso"}), 200

    @bp.post("/comunicados/<int:comunicado_id>/read")
    @jwt_required()
    def mark_read(comunicado_id: int):
        user_id = int(get_jwt_identity())
        claims = get_jwt()
        roles = claims.get("roles", [])
        with session_scope() as session:
            # Verify comunicado belongs to the user's tenant before recording read status.
            # The ORM auto-filter only applies to SELECT queries, not MERGE/INSERT, so
            # an explicit tenant check here is required to prevent cross-tenant writes.
            comunicado = (
                session.query(Comunicado)
                .filter(Comunicado.id == comunicado_id, Comunicado.tenant_id == g.tenant_id)
                .first()
            )
            if not comunicado:
                return jsonify({"error": "Comunicado não encontrado"}), 404
            if not _can_user_read_comunicado(session, comunicado, roles, claims):
                return jsonify({"error": "Comunicado não encontrado"}), 404
            leitura = ComunicadoLeitura(comunicado_id=comunicado_id, usuario_id=user_id)
            session.merge(leitura)
        return jsonify({"message": "Lido"}), 200

    @bp.get("/comunicados/<int:comunicado_id>/leituras")
    @jwt_required()
    def list_leituras(comunicado_id: int):
        """Retorna quem leu o comunicado e quando — apenas para admins e autores."""
        from ...models import Usuario
        claims = get_jwt()
        roles = claims.get("roles", [])

        if not COMUNICADO_WRITE_ROLES.intersection(roles):
            return jsonify({"error": "Acesso negado"}), 403

        with session_scope() as session:
            comunicado = (
                session.query(Comunicado)
                .filter(Comunicado.id == comunicado_id, Comunicado.tenant_id == g.tenant_id)
                .first()
            )
            if not comunicado:
                return jsonify({"error": "Comunicado não encontrado"}), 404

            leituras = (
                session.query(ComunicadoLeitura, Usuario.username)
                .join(Usuario, ComunicadoLeitura.usuario_id == Usuario.id)
                .filter(ComunicadoLeitura.comunicado_id == comunicado_id)
                .order_by(ComunicadoLeitura.data_leitura.desc())
                .all()
            )
            result = [
                {
                    "usuario_id": leitura.ComunicadoLeitura.usuario_id,
                    "username": leitura.username,
                    "data_leitura": leitura.ComunicadoLeitura.data_leitura.isoformat(),
                }
                for leitura in leituras
            ]
            return jsonify({
                "comunicado_id": comunicado_id,
                "titulo": comunicado.titulo,
                "total_leituras": len(result),
                "leituras": result
            }), 200

    parent.register_blueprint(bp)
