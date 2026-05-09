from flask import request
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address


def _rate_limit_key() -> str:
    """Rate limit key: JWT identity for authenticated users, real IP for anonymous.

    For authenticated users, keys on user ID to avoid blocking shared NAT/proxy IPs.
    For anonymous (e.g. login page), uses X-Real-IP set by nginx, falling back to
    remote_addr. This prevents all users behind a CDN from sharing one rate-limit bucket.
    """
    from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
    from flask_jwt_extended.exceptions import JWTExtendedException
    from jwt import PyJWTError

    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
        if identity:
            return f"user:{identity}"
    except (JWTExtendedException, PyJWTError):
        pass
    # A6: prefer X-Real-IP (set by nginx from actual client IP) over proxy remote_addr
    return request.headers.get("X-Real-IP") or get_remote_address()


limiter = Limiter(
    key_func=_rate_limit_key,
    # Limite por usuário autenticado: 120 req/min (o dobro do limite anônimo)
    # Endpoints sensíveis devem decorar com @limiter.limit() específico
    default_limits=["120 per minute"],
)
