"""Auth endpoints."""
import secrets
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required
from pydantic import ValidationError
from sqlalchemy import select

from ...core.database import session_scope
from ...core.security import generate_tokens, add_token_to_blocklist, hash_password
from ...services.usuario_service import UsuarioService
from ...schemas.usuario import LoginRequest, ChangePasswordRequest
from ...core.extensions import limiter

def register(parent: Blueprint) -> None:
    bp = Blueprint("auth", __name__)

    @bp.get("/auth/tenants")
    def list_public_tenants():
        from ...models.tenant import Tenant
        with session_scope() as session:
            tenants = session.execute(
                select(Tenant).where(Tenant.is_active.is_(True))
            ).scalars().all()
            return jsonify([{"id": t.id, "name": t.name, "slug": t.slug} for t in tenants])

    @bp.post("/auth/login")
    @limiter.limit("10 per minute")
    def login():
        try:
            payload = LoginRequest(**(request.get_json() or {}))
        except ValidationError as e:
            return jsonify({"error": "Dados inválidos", "details": e.errors(include_context=False)}), 422

        ip = request.headers.get("X-Forwarded-For", request.remote_addr or "").split(",")[0].strip()
        with session_scope() as session:
            from ...services.audit import log_action
            service = UsuarioService(session)
            try:
                response = service.authenticate(
                    payload.username,
                    payload.password,
                    tenant_slug=payload.tenant_slug
                )
                log_action(session, response.user.id, "LOGIN_SUCCESS", "Usuario", response.user.id, {"ip": ip})
                return jsonify(response.model_dump())
            except Exception:
                # Garante que o log de falha não mascara a exceção original
                try:
                    log_action(session, None, "LOGIN_FAILED", "Usuario", None, {"username": payload.username, "ip": ip})
                except Exception:
                    pass
                raise

    @bp.post("/auth/refresh")
    @jwt_required(refresh=True)
    def refresh():
        identity = get_jwt_identity()
        jwt_data = get_jwt()
        roles = jwt_data.get("roles", [])
        extra_claims = {
            "aluno_id": jwt_data.get("aluno_id"),
            "matricula": jwt_data.get("matricula"),
            "tenant_id": jwt_data.get("tenant_id"),
            "academic_year_id": jwt_data.get("academic_year_id"),
        }
        tokens = generate_tokens(identity=identity, roles=roles, extra_claims=extra_claims)
        return jsonify(tokens)

    @bp.post("/auth/logout")
    @jwt_required(verify_type=False)
    def logout():
        """Revoga o token atual (access ou refresh) adicionando-o ao blocklist."""
        from ...core.security import add_token_to_blocklist
        from ...services.audit import log_action
        import time as _time
        jwt_data = get_jwt()
        jti = jwt_data["jti"]
        exp = jwt_data.get("exp", 0)
        ttl = max(int(exp - _time.time()), 1)
        add_token_to_blocklist(jti, ttl)
        user_id = get_jwt_identity()
        ip = request.headers.get("X-Forwarded-For", request.remote_addr or "").split(",")[0].strip()
        with session_scope() as session:
            log_action(session, int(user_id) if user_id else None, "LOGOUT", "Usuario", user_id, {"ip": ip})
        return ("", 204)

    @bp.post("/auth/change-password")
    @jwt_required()
    @limiter.limit("5 per hour")
    def change_password():
        try:
            payload = ChangePasswordRequest(**(request.get_json() or {}))
        except ValidationError as e:
            return jsonify({"error": "Dados inválidos", "details": e.errors(include_context=False)}), 422

        user_id = int(get_jwt_identity())

        with session_scope() as session:
            service = UsuarioService(session)
            service.change_password(user_id, payload.current_password, payload.new_password)

        # Revoke the current token so the user must re-authenticate with the new password.
        # This invalidates any attacker who obtained the old token before the change.
        import time as _time
        jwt_data = get_jwt()
        jti = jwt_data["jti"]
        exp = jwt_data.get("exp", 0)
        ttl = max(int(exp - _time.time()), 1)
        add_token_to_blocklist(jti, ttl)

        return ("", 204)

    @bp.post("/auth/forgot-password")
    @limiter.limit("5 per hour")
    def forgot_password():
        """Envia email com link de redefinição de senha.
        Sempre retorna 200 para não revelar se o email existe.
        tenant_slug é obrigatório para garantir que o reset atinja o usuário
        correto quando o mesmo e-mail existe em múltiplos tenants.
        """
        from ...core.cache import redis_client
        from ...services.communication_service import CommunicationService
        from ...core.config import settings
        from ...models import Usuario
        from ...models.tenant import Tenant

        data = request.get_json() or {}
        email = (data.get("email") or "").strip().lower()
        tenant_slug = (data.get("tenant_slug") or "").strip().lower()

        _ok = jsonify({"message": "Se o e-mail estiver cadastrado, você receberá um link em breve."})

        if not email or not tenant_slug:
            return _ok, 200

        with session_scope() as session:
            # Scope the lookup to the specific tenant to avoid resetting the wrong
            # account when the same e-mail exists in more than one school.
            tenant = session.execute(
                select(Tenant).where(Tenant.slug == tenant_slug, Tenant.is_active.is_(True))
            ).scalar_one_or_none()

            if not tenant:
                return _ok, 200

            user = (
                session.query(Usuario)
                .filter(
                    Usuario.email == email,
                    Usuario.tenant_id == tenant.id,
                    Usuario.is_active.is_(True),
                )
                .execution_options(include_all_tenants=True)
                .first()
            )

            if user:
                token = secrets.token_urlsafe(32)
                # Armazena user_id:tenant_id para validar isolamento de tenant no reset
                redis_client.setex(f"pwd_reset:{token}", 3600, f"{user.id}:{tenant.id}")

                reset_url = f"{settings.frontend_url}/redefinir-senha?token={token}"
                body = (
                    f"Olá!\n\n"
                    f"Recebemos uma solicitação para redefinir a senha da sua conta no {settings.brand_name}.\n\n"
                    f"Clique no link abaixo para criar uma nova senha (válido por 1 hora):\n\n"
                    f"{reset_url}\n\n"
                    f"Se você não solicitou isso, ignore este e-mail. Sua senha não será alterada.\n\n"
                    f"— Equipe {settings.brand_name}"
                )
                CommunicationService.send_email(
                    to_email=email,
                    subject=f"[{settings.brand_name}] Redefinição de senha",
                    body=body
                )

        return _ok, 200

    @bp.post("/auth/reset-password")
    @limiter.limit("10 per hour")
    def reset_password():
        """Redefine a senha usando um token de recuperação."""
        from ...core.cache import redis_client
        from ...models import Usuario

        data = request.get_json() or {}
        token = (data.get("token") or "").strip()
        new_password = (data.get("new_password") or "").strip()

        if not token or not new_password:
            return jsonify({"error": "Token e nova senha são obrigatórios"}), 400

        # Validate password strength via shared validator
        from app.core.validators import validate_password_strength
        try:
            validate_password_strength(new_password)
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400

        redis_key = f"pwd_reset:{token}"
        stored = redis_client.getdel(redis_key)
        if not stored:
            return jsonify({"error": "Token inválido ou expirado"}), 400

        # Valor armazenado: "user_id:tenant_id" (Redis retorna bytes)
        stored_str = stored.decode("utf-8") if isinstance(stored, bytes) else stored
        parts = stored_str.split(":", 1)
        if len(parts) != 2:
            return jsonify({"error": "Token inválido ou expirado"}), 400
        try:
            user_id = int(parts[0])
            token_tenant_id = int(parts[1])
        except ValueError:
            return jsonify({"error": "Token inválido ou expirado"}), 400

        with session_scope() as session:
            user = session.get(Usuario, user_id)
            if not user or not user.is_active:
                return jsonify({"error": "Usuário não encontrado"}), 404
            # Valida que o token pertence ao tenant correto (defesa em profundidade)
            if user.tenant_id != token_tenant_id:
                return jsonify({"error": "Token inválido ou expirado"}), 400

            user.password_hash = hash_password(new_password)
            user.must_change_password = False
            session.add(user)

        return jsonify({"message": "Senha redefinida com sucesso. Faça login com a nova senha."}), 200

    parent.register_blueprint(bp)
