"""Endpoints para gerenciamento administrativo de usuários."""
from __future__ import annotations

from flask import Blueprint, jsonify, request, send_from_directory
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from sqlalchemy import func, or_
from sqlalchemy.orm import joinedload
from pathlib import Path

from ...core.config import settings
from ...core.database import session_scope
from ...core.security import hash_password
from ...models import Aluno, Usuario


def serialize_usuario(usuario: Usuario) -> dict[str, object]:
    aluno_data = None
    if usuario.aluno:
        aluno_data = {
            "id": usuario.aluno.id,
            "nome": usuario.aluno.nome,
            "matricula": usuario.aluno.matricula,
            "turma": usuario.aluno.turma,
            "turno": usuario.aluno.turno,
        }
    return {
        "id": usuario.id,
        "username": usuario.username,
        "role": usuario.role,
        "is_admin": usuario.is_admin,
        "aluno_id": usuario.aluno_id,
        "photo_url": usuario.photo_url,
        "must_change_password": usuario.must_change_password,
        "tenant_id": usuario.tenant_id,
        "tenant_name": usuario.tenant_name,
        "aluno": aluno_data,
    }


def _is_admin() -> bool:
    roles = get_jwt().get("roles") or []
    return "admin" in roles or "super_admin" in roles


def register(parent: Blueprint) -> None:
    bp = Blueprint("usuarios", __name__)

    @bp.get("/usuarios")
    @jwt_required()
    def list_usuarios():
        if not _is_admin():
            return jsonify({"error": "Acesso restrito"}), 403

        page = max(1, int(request.args.get("page", 1)))
        per_page = min(100, int(request.args.get("per_page", 20)))
        query_text = request.args.get("q")
        role_filter = request.args.get("role")

        with session_scope() as session:
            query = (
                session.query(Usuario)
                .options(joinedload(Usuario.aluno))
                .outerjoin(Aluno)
            )
            if query_text:
                # Escape LIKE metacharacters before wrapping in wildcards to
                # prevent users crafting patterns that bypass intent (e.g. "%" or "_").
                escaped = query_text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
                like = f"%{escaped}%"
                query = query.filter(
                    or_(
                        Usuario.username.ilike(like, escape="\\"),
                        Aluno.nome.ilike(like, escape="\\"),
                        Aluno.matricula.ilike(like, escape="\\"),
                    )
                )
            if role_filter:
                query = query.filter(Usuario.role == role_filter)

            total = query.count()
            usuarios = (
                query.order_by(func.lower(Usuario.username))
                .offset((page - 1) * per_page)
                .limit(per_page)
                .all()
            )
            
            # Serialize within session context to avoid DetachedInstanceError
            serialized_usuarios = [serialize_usuario(usuario) for usuario in usuarios]

        return jsonify(
            {
                "items": serialized_usuarios,
                "meta": {
                    "page": page,
                    "per_page": per_page,
                    "total": total,
                },
            }
        )

    @bp.post("/usuarios")
    @jwt_required()
    def create_usuario():
        if not _is_admin():
            return jsonify({"error": "Acesso restrito"}), 403

        payload = request.get_json() or {}
        username = (payload.get("username") or "").strip()
        password = payload.get("password")
        role = payload.get("role") or "professor"
        aluno_id = payload.get("aluno_id")

        if not username or not password:
            return jsonify({"error": "Usuário e senha são obrigatórios"}), 400
        if len(username) > 50:
            return jsonify({"error": "Usuário deve ter no máximo 50 caracteres"}), 400

        from app.core.validators import validate_password_strength
        try:
            validate_password_strength(password)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        from flask import g
        with session_scope() as session:
            # A1: username check scoped to tenant
            existing = (
                session.query(Usuario)
                .filter(Usuario.username == username, Usuario.tenant_id == g.tenant_id)
                .first()
            )
            if existing:
                return jsonify({"error": "Usuário já existe"}), 409

            if aluno_id is not None:
                aluno = session.get(Aluno, aluno_id)
                if not aluno:
                    return jsonify({"error": "Aluno informado não existe"}), 400

            usuario = Usuario(
                username=username,
                password_hash=hash_password(password),
                role=role,
                is_admin=bool(payload.get("is_admin")),
                aluno_id=aluno_id,
                must_change_password=payload.get("must_change_password", True),
                tenant_id=getattr(g, 'tenant_id', None)
            )
            session.add(usuario)
            session.flush()
            return jsonify(serialize_usuario(usuario)), 201

    @bp.patch("/usuarios/<int:usuario_id>")
    @jwt_required()
    def update_usuario(usuario_id: int):
        if not _is_admin():
            return jsonify({"error": "Acesso restrito"}), 403

        payload = request.get_json() or {}
        if not payload:
            return jsonify({"error": "Nenhum dado informado"}), 400

        current_user_id = int(get_jwt_identity())
        current_claims = get_jwt()
        current_roles = current_claims.get("roles", [])
        is_super_admin = "super_admin" in current_roles

        # C4: prevent self-promotion
        if current_user_id == usuario_id and ("role" in payload or "is_admin" in payload):
            return jsonify({"error": "Não é possível alterar seu próprio papel ou permissões"}), 403

        from flask import g
        with session_scope() as session:
            # C1: tenant-scoped lookup
            usuario = (
                session.query(Usuario)
                .filter(Usuario.id == usuario_id, Usuario.tenant_id == g.tenant_id)
                .first()
            )
            if not usuario:
                return jsonify({"error": "Usuário não encontrado"}), 404

            new_username = payload.get("username")
            if new_username is not None:
                new_username = new_username.strip()
                if not new_username:
                    return jsonify({"error": "Usuário inválido"}), 400
                if len(new_username) > 50:
                    return jsonify({"error": "Usuário deve ter no máximo 50 caracteres"}), 400
                # A1: username check scoped to tenant
                existing = (
                    session.query(Usuario)
                    .filter(
                        Usuario.username == new_username,
                        Usuario.tenant_id == g.tenant_id,
                        Usuario.id != usuario.id,
                    )
                    .first()
                )
                if existing:
                    return jsonify({"error": "Usuário já existe"}), 409
                usuario.username = new_username

            if "role" in payload:
                new_role = payload.get("role") or usuario.role
                # C4: only super_admin can grant admin/super_admin roles
                if new_role in ("super_admin", "admin") and not is_super_admin:
                    return jsonify({"error": "Permissão insuficiente para atribuir este papel"}), 403
                usuario.role = new_role

            if "is_admin" in payload:
                # C4: only super_admin can grant admin flag
                if bool(payload.get("is_admin")) and not is_super_admin:
                    return jsonify({"error": "Apenas super_admin pode conceder privilégios de administrador"}), 403
                usuario.is_admin = bool(payload.get("is_admin"))

            if "must_change_password" in payload:
                usuario.must_change_password = bool(payload.get("must_change_password"))

            if "aluno_id" in payload:
                aluno_id_value = payload.get("aluno_id")
                if aluno_id_value is None:
                    usuario.aluno_id = None
                else:
                    aluno = session.get(Aluno, aluno_id_value)
                    if not aluno:
                        return jsonify({"error": "Aluno informado não existe"}), 400
                    usuario.aluno_id = aluno.id

            if payload.get("password"):
                from app.core.validators import validate_password_strength
                try:
                    validate_password_strength(payload["password"])
                except ValueError as exc:
                    return jsonify({"error": str(exc)}), 400
                usuario.password_hash = hash_password(payload["password"])
                usuario.must_change_password = payload.get("must_change_password", True)

            session.add(usuario)
            session.flush()
            session.refresh(usuario)
            result = serialize_usuario(usuario)

        return jsonify(result)

    @bp.delete("/usuarios/<int:usuario_id>")
    @jwt_required()
    def delete_usuario(usuario_id: int):
        if not _is_admin():
            return jsonify({"error": "Acesso restrito"}), 403

        current_user_id = int(get_jwt_identity())
        if current_user_id == usuario_id:
            return jsonify({"error": "Não é possível remover o próprio usuário"}), 400

        from flask import g
        with session_scope() as session:
            # C1: tenant-scoped lookup
            usuario = (
                session.query(Usuario)
                .filter(Usuario.id == usuario_id, Usuario.tenant_id == g.tenant_id)
                .first()
            )
            if not usuario:
                return jsonify({"error": "Usuário não encontrado"}), 404
            session.delete(usuario)

        return ("", 204)

    @bp.post("/usuarios/me/photo")
    @jwt_required()
    def upload_photo():
        if "file" not in request.files:
            return jsonify({"error": "Arquivo não enviado"}), 400
            
        file = request.files["file"]
        if not file.filename:
            return jsonify({"error": "Nome de arquivo inválido"}), 400

        # Enforce file size limit (5 MB) before reading full content
        MAX_PHOTO_BYTES = 5 * 1024 * 1024
        file.seek(0, 2)  # seek to end
        file_size = file.tell()
        file.seek(0)
        if file_size > MAX_PHOTO_BYTES:
            return jsonify({"error": "Arquivo muito grande. Máximo permitido: 5 MB"}), 413

        ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
        ALLOWED_MIMES = {'image/jpeg', 'image/png', 'image/webp'}

        ext = Path(file.filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS or file.mimetype not in ALLOWED_MIMES:
            return jsonify({"error": "Tipo de arquivo não permitido"}), 400

        # Verificar magic bytes
        header = file.read(16)
        file.seek(0)
        if not header.startswith((b'\xff\xd8', b'\x89PNG', b'RIFF')):
            return jsonify({"error": "Arquivo de imagem inválido"}), 400

        user_id = get_jwt_identity()
        import uuid
        # Use random UUID for filename to prevent enumeration and path guessing
        safe_ext = ext if ext in ALLOWED_EXTENSIONS else '.jpg'
        filename = f"user_{user_id}_{uuid.uuid4().hex}{safe_ext}"

        # Ensure directory exists
        photos_dir = Path(settings.upload_folder) / "photos"
        photos_dir.mkdir(parents=True, exist_ok=True)
        
        filepath = photos_dir / filename
        file.save(filepath)
        
        # Update user in DB
        photo_url = f"/api/v1/static/photos/{filename}"
        with session_scope() as session:
            user = session.get(Usuario, int(user_id))
            if user:
                user.photo_url = photo_url
                session.add(user)
                
        return jsonify({"photo_url": photo_url})

    @bp.route("/static/photos/<path:filename>")
    def serve_photo(filename):
        import os
        from flask import current_app
        photos_dir = os.path.abspath(os.path.join(current_app.config["UPLOAD_FOLDER"], "photos"))
        current_app.logger.info(f"Serving photo: {filename} from {photos_dir}")
        return send_from_directory(photos_dir, filename)

    @bp.get("/usuarios/me")
    @jwt_required()
    def get_me():
        from flask import g
        user_id = int(get_jwt_identity())
        
        with session_scope() as session:
            usuario = (
                session.query(Usuario)
                .options(joinedload(Usuario.aluno), joinedload(Usuario.tenant))
                .filter(Usuario.id == user_id)
                .execution_options(include_all_tenants=True)
                .first()
            )
            if not usuario:
                return jsonify({"error": "Usuário não encontrado"}), 404
            
            # If user is an aluno, resolve their Aluno record for the active academic year
            # The ORM listener automatically filters Aluno queries by academic_year_id from g.academic_year_id
            if usuario.role == "aluno":
                # Search by matricula (which is persistent) in the current year
                active_aluno = session.query(Aluno).filter(
                    Aluno.matricula == usuario.username
                ).first()
                if active_aluno:
                    usuario.aluno = active_aluno
                    usuario.aluno_id = active_aluno.id
            
            return jsonify(serialize_usuario(usuario))

    parent.register_blueprint(bp)
