import re

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt, get_jwt_identity
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.core.database import session_scope
from app.models.tenant import Tenant
from app.models.academic_year import AcademicYear
from app.models.usuario import Usuario
from app.models.aluno import Aluno
from app.services.audit import log_action

_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$")

def register(parent: Blueprint) -> None:
    bp = Blueprint("super_admin", __name__, url_prefix="/admin")

    def super_admin_required(f):
        from functools import wraps
        @wraps(f)
        def decorated_function(*args, **kwargs):
            claims = get_jwt()
            roles = claims.get("roles", [])
            if "super_admin" not in roles:
                return jsonify({"error": "Acesso restrito a Super Administradores"}), 403
            return f(*args, **kwargs)
        return decorated_function

    @bp.route("/tenants", methods=["GET"])
    @jwt_required()
    @super_admin_required
    def list_tenants():
        with session_scope() as session:
            tenants = (
                session.execute(
                    select(Tenant).options(selectinload(Tenant.academic_years))
                    .execution_options(include_all_tenants=True)
                ).scalars().all()
            )
            return jsonify([
                {
                    "id": t.id,
                    "name": t.name,
                    "slug": t.slug,
                    "is_active": t.is_active,
                    "years": [
                        {"id": y.id, "label": y.label, "is_current": y.is_current}
                        for y in t.academic_years
                    ]
                } for t in tenants
            ])

    @bp.route("/tenants", methods=["POST"])
    @jwt_required()
    @super_admin_required
    def create_tenant():
        data = request.get_json() or {}
        name = (data.get("name") or "").strip()
        slug = (data.get("slug") or "").strip().lower()
        if not name or not slug:
            return jsonify({"error": "Nome e slug são obrigatórios"}), 400
        if not _SLUG_RE.fullmatch(slug):
            return jsonify({"error": "Slug deve conter apenas letras minúsculas, números e hífen"}), 400

        # Normalize empty string domain to None to avoid unique constraint conflicts
        domain = (data.get("domain") or "").strip().lower() or None
        admin_email = (data.get("admin_email") or "").strip().lower()
        admin_password = data.get("admin_password") or ""
        if admin_password:
            from app.core.validators import validate_password_strength
            try:
                validate_password_strength(admin_password)
            except ValueError as exc:
                return jsonify({"error": str(exc)}), 400

        # 2. Check for duplicate admin email (cross-tenant, so bypass tenant filter)
        if admin_email:
            with session_scope() as check_session:
                existing_user = check_session.query(Usuario).filter(
                    Usuario.email == admin_email
                ).execution_options(include_all_tenants=True).first()
            if existing_user:
                return jsonify({"error": f"Já existe um usuário com o e-mail '{admin_email}'"}), 409

        # 3. Create everything in a single transaction.
        # The UNIQUE constraint on tenant.slug catches concurrent duplicates without
        # a pre-check race condition.
        try:
            from sqlalchemy.exc import IntegrityError
            with session_scope() as session:
                tenant = Tenant(name=name, slug=slug, domain=domain)
                session.add(tenant)
                session.flush()  # Get ID before inserting children

                session.add(AcademicYear(
                    tenant_id=tenant.id,
                    label=str(data.get("initial_year") or "2025"),
                    is_current=True,
                ))

                if admin_email and admin_password:
                    from app.core.security import hash_password
                    # A3: username unique per tenant — no race condition possible since
                    # this is the first user in a brand-new tenant. DB constraint guards it.
                    username = admin_email.split("@")[0]
                    session.add(Usuario(
                        username=username,
                        email=admin_email,
                        password_hash=hash_password(admin_password),
                        role="admin",
                        tenant_id=tenant.id,
                        is_active=True,
                        must_change_password=True,
                    ))

                tenant_id = tenant.id

        except IntegrityError:
            return jsonify({"error": f"Já existe uma escola com o slug '{slug}'"}), 409
        except Exception as exc:
            from loguru import logger
            logger.error(f"Erro ao criar tenant '{slug}': {exc}")
            return jsonify({"error": "Erro interno ao criar escola. Verifique os dados e tente novamente."}), 500

        return jsonify({"message": "Escola e administrador criados com sucesso", "id": tenant_id}), 201

    @bp.route("/tenants/<int:tenant_id>/years", methods=["POST"])
    @jwt_required()
    @super_admin_required
    def add_academic_year(tenant_id):
        data = request.get_json()
        label = data.get("label")
        if not label:
            return jsonify({"error": "Rótulo do ano é obrigatório"}), 400
            
        with session_scope() as session:
            # Optionally set previous ones to is_current=False
            if data.get("set_current", False):
                session.query(AcademicYear).filter(
                    AcademicYear.tenant_id == tenant_id
                ).update({"is_current": False})
                
            new_year = AcademicYear(
                tenant_id=tenant_id,
                label=label,
                is_current=data.get("set_current", False)
            )
            session.add(new_year)
            return jsonify({"message": "Ano acadêmico adicionado"}), 201

    @bp.route("/tenants/<int:tenant_id>", methods=["PATCH"])
    @jwt_required()
    @super_admin_required
    def update_tenant(tenant_id):
        data = request.get_json()
        with session_scope() as session:
            tenant = session.get(Tenant, tenant_id)
            if not tenant:
                return jsonify({"error": "Escola não encontrada"}), 404
            
            if "name" in data: tenant.name = data["name"]
            if "is_active" in data: tenant.is_active = data["is_active"]
            if "domain" in data: tenant.domain = data["domain"]
            
            return jsonify({"message": "Escola atualizada com sucesso"}), 200

    @bp.route("/tenants/<int:tenant_id>", methods=["DELETE"])
    @jwt_required()
    @super_admin_required
    def delete_tenant(tenant_id):
        data = request.get_json() or {}
        if not data.get("confirm_delete"):
            return jsonify({"error": "Confirme a exclusão enviando confirm_delete: true"}), 400

        with session_scope() as session:
            tenant = session.get(Tenant, tenant_id)
            if not tenant:
                return jsonify({"error": "Escola não encontrada"}), 404

            # Check all dependent data before attempting delete to avoid FK violations
            aluno_count = session.execute(
                select(func.count(Aluno.id)).where(Aluno.tenant_id == tenant_id)
            ).scalar() or 0

            usuario_count = session.execute(
                select(func.count(Usuario.id)).where(Usuario.tenant_id == tenant_id)
            ).scalar() or 0

            if aluno_count > 0 or usuario_count > 0:
                parts = []
                if aluno_count:
                    parts.append(f"{aluno_count} aluno(s)")
                if usuario_count:
                    parts.append(f"{usuario_count} usuário(s)")
                return jsonify({
                    "error": f"Escola possui {', '.join(parts)} cadastrado(s). Remova todos os dados antes de excluir."
                }), 409

            actor_id = int(get_jwt_identity())
            log_action(session, actor_id, "DELETE_TENANT", "Tenant", tenant_id, {"name": tenant.name})
            session.delete(tenant)
            return jsonify({"message": f"Escola '{tenant.name}' excluída com sucesso"}), 200

    parent.register_blueprint(bp)
