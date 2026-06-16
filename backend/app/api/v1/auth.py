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
from loguru import logger


def _is_mobile_client() -> bool:
    return request.headers.get("X-Client-Platform", "").strip().lower() in {"mobile", "native"}


def _set_refresh_cookie(response, refresh_token: str) -> None:
    from ...core.config import settings

    response.set_cookie(
        "rt",
        refresh_token,
        httponly=True,
        secure=settings.environment == "production",
        samesite="Strict",
        max_age=7 * 24 * 3600,
        path="/api/v1/auth",
    )


def _extract_refresh_token(*, allow_authorization: bool = False) -> tuple[str | None, str]:
    token = request.cookies.get("rt")
    if token:
        return token, "cookie"

    if _is_mobile_client():
        payload = request.get_json(silent=True) or {}
        body_token = (payload.get("refresh_token") or "").strip()
        if body_token:
            return body_token, "body"

        if allow_authorization:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                return auth_header[7:].strip(), "authorization"

    return None, "missing"


def _revoke_refresh_token_if_present() -> None:
    import time as _time
    from flask_jwt_extended import decode_token

    rt_token, _source = _extract_refresh_token(allow_authorization=False)
    if not rt_token:
        return

    try:
        rt_data = decode_token(rt_token, allow_expired=True)
        rt_jti = rt_data.get("jti")
        if rt_jti:
            rt_exp = rt_data.get("exp", 0)
            rt_ttl = max(int(rt_exp - _time.time()), 1)
            add_token_to_blocklist(rt_jti, rt_ttl)
    except Exception as exc:
        logger.warning("Could not revoke refresh token on session termination: {}", exc)


def _get_client_ip() -> str:
    """Retorna o IP real do cliente.

    Prefere X-Real-IP (setado pelo Traefik com o IP da conexão de entrada) sobre
    X-Forwarded-For, que pode ser forjado pelo cliente antes de chegar ao proxy.
    """
    return (
        request.headers.get("X-Real-IP")
        or request.headers.get("X-Forwarded-For", "").split(",")[-1].strip()
        or request.remote_addr
        or ""
    )


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

    @bp.get("/auth/public-tenants")
    def list_public_tenants_legacy():
        return list_public_tenants()

    def _login_rate_key() -> str:
        """Chave de rate limit por username tentado + IP.

        Limitar por username previne brute-force em contas específicas mesmo quando
        o atacante usa IPs diferentes. Limitar por IP como fallback protege contra
        enumeração de contas sem username fixo.
        """
        from flask_limiter.util import get_remote_address
        body = request.get_json(silent=True) or {}
        username = (body.get("username") or "").strip().lower()
        ip = request.headers.get("X-Real-IP") or get_remote_address()
        if username:
            return f"login:user:{username}"
        return f"login:ip:{ip}"

    @bp.post("/auth/login")
    @limiter.limit("10 per minute", key_func=_login_rate_key)
    def login():
        from flask import make_response

        try:
            payload = LoginRequest(**(request.get_json() or {}))
        except ValidationError as e:
            return jsonify({"error": "Dados inválidos", "details": e.errors(include_context=False)}), 422

        ip = _get_client_ip()
        with session_scope() as session:
            from ...services.audit import log_action
            service = UsuarioService(session)
            try:
                auth_response = service.authenticate(
                    payload.username,
                    payload.password,
                    tenant_slug=payload.tenant_slug
                )
                log_action(session, auth_response.user.id, "LOGIN_SUCCESS", "Usuario", auth_response.user.id, {"ip": ip})

                auth_data = auth_response.model_dump()
                refresh_token = auth_data.get("refresh_token")

                # Web recebe refresh token apenas em cookie HttpOnly.
                # Mobile recebe no body por não depender de cookie do browser.
                if not _is_mobile_client():
                    auth_data.pop("refresh_token", None)

                resp = make_response(jsonify(auth_data))
                if refresh_token:
                    if _is_mobile_client():
                        pass
                    else:
                        _set_refresh_cookie(resp, refresh_token)
                return resp
            except Exception:
                # Garante que o log de falha não mascara a exceção original
                try:
                    log_action(session, None, "LOGIN_FAILED", "Usuario", None, {"username": payload.username, "ip": ip})
                except Exception as audit_exc:
                    logger.error("Audit log failed during login for user '{}': {}", payload.username, audit_exc)
                raise

    @bp.post("/auth/refresh")
    def refresh():
        """Emite um novo access token usando o refresh token armazenado no cookie HttpOnly.

        Não usa @jwt_required para evitar que o decorator leia do header Authorization —
        o refresh token deve vir exclusivamente do cookie, nunca de um header exposto ao JS.
        """
        from flask_jwt_extended import decode_token
        from flask_jwt_extended.exceptions import JWTExtendedException
        from ...core.security import is_token_revoked
        import time as _time
        token, token_source = _extract_refresh_token(allow_authorization=True)
        if not token:
            return jsonify({"error": "Sessão expirada. Faça login novamente."}), 401

        try:
            jwt_data = decode_token(token, allow_expired=False)
        except (JWTExtendedException, Exception):
            return jsonify({"error": "Sessão inválida. Faça login novamente."}), 401

        if jwt_data.get("type") != "refresh":
            return jsonify({"error": "Token inválido"}), 401

        jti = jwt_data.get("jti", "")
        if jti and is_token_revoked(jti):
            return jsonify({"error": "Sessão revogada. Faça login novamente."}), 401

        # Rotação real: o refresh token atual deixa de ser reutilizável
        if jti:
            exp = jwt_data.get("exp", 0)
            ttl = max(int(exp - _time.time()), 1)
            add_token_to_blocklist(jti, ttl)

        identity = str(jwt_data.get("sub", ""))
        roles = jwt_data.get("roles", [])
        extra_claims = {
            "aluno_id": jwt_data.get("aluno_id"),
            "matricula": jwt_data.get("matricula"),
            "tenant_id": jwt_data.get("tenant_id"),
            "academic_year_id": jwt_data.get("academic_year_id"),
        }
        tokens = generate_tokens(identity=identity, roles=roles, extra_claims=extra_claims)

        # Recupera dados do usuário para o frontend restaurar o estado após F5
        user_data = None
        try:
            from ...models import Usuario
            with session_scope() as session:
                user = session.get(Usuario, int(identity))
                if user:
                    user_data = {
                        "id": user.id,
                        "username": user.username,
                        "role": user.role,
                        "is_admin": user.is_admin,
                        "aluno_id": user.aluno_id,
                        "photo_url": user.photo_url,
                        "must_change_password": user.must_change_password,
                        "tenant_id": user.tenant_id,
                        "tenant_name": user.tenant_name,
                    }
        except Exception as exc:
            logger.warning("Could not fetch user data during token refresh (id={}): {}", identity, exc)

        response_body = {"access_token": tokens["access_token"], "user": user_data}
        if _is_mobile_client() or token_source in {"authorization", "body"}:
            response_body["refresh_token"] = tokens["refresh_token"]

        resp = jsonify(response_body)
        if token_source == "cookie" and not _is_mobile_client():
            _set_refresh_cookie(resp, tokens["refresh_token"])
        return resp

    @bp.post("/auth/logout")
    @jwt_required(verify_type=False)
    def logout():
        """Revoga o access token e o refresh token (cookie), e limpa o cookie."""
        from ...core.security import add_token_to_blocklist
        from ...services.audit import log_action
        from ...core.config import settings
        from flask import make_response
        import time as _time

        jwt_data = get_jwt()
        jti = jwt_data["jti"]
        exp = jwt_data.get("exp", 0)
        ttl = max(int(exp - _time.time()), 1)
        add_token_to_blocklist(jti, ttl)

        # Revoga o refresh token do cookie, se presente
        _revoke_refresh_token_if_present()

        user_id = get_jwt_identity()
        ip = _get_client_ip()
        with session_scope() as session:
            log_action(session, int(user_id) if user_id else None, "LOGOUT", "Usuario", user_id, {"ip": ip})

        resp = make_response("", 204)
        resp.set_cookie(
            "rt", "",
            httponly=True,
            secure=settings.environment == "production",
            samesite="Strict",
            max_age=0,
            path="/api/v1/auth",
        )
        return resp

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
        _revoke_refresh_token_if_present()

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
