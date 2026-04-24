from flask import Blueprint, jsonify, request, g
from flask_jwt_extended import jwt_required, get_jwt
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import session_scope
from app.models.tenant import Tenant
from app.models.academic_year import AcademicYear
from app.models.usuario import Usuario

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
        slug = (data.get("slug") or "").strip()
        if not name or not slug:
            return jsonify({"error": "Nome e slug são obrigatórios"}), 400

        # Normalize empty string domain to None to avoid unique constraint conflicts
        domain = data.get("domain") or None

        # 2. Check for duplicate admin email (cross-tenant, so bypass tenant filter)
        if data.get("admin_email"):
            with session_scope() as check_session:
                existing_user = check_session.query(Usuario).filter(
                    Usuario.email == data["admin_email"]
                ).execution_options(include_all_tenants=True).first()
            if existing_user:
                return jsonify({"error": f"Já existe um usuário com o e-mail '{data['admin_email']}'"}), 409

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

                if data.get("admin_email") and data.get("admin_password"):
                    from app.core.security import hash_password
                    # A3: username unique per tenant — no race condition possible since
                    # this is the first user in a brand-new tenant. DB constraint guards it.
                    username = data["admin_email"].split("@")[0]
                    session.add(Usuario(
                        username=username,
                        email=data["admin_email"],
                        password_hash=hash_password(data["admin_password"]),
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
        with session_scope() as session:
            tenant = session.get(Tenant, tenant_id)
            if not tenant:
                return jsonify({"error": "Escola não encontrada"}), 404
            
            # Note: This might fail if there are related records
            session.delete(tenant)
            return "", 204

    parent.register_blueprint(bp)
