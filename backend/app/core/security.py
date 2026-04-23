"""Security helpers: password hashing, JWT setup, and token blocklist."""
from datetime import timedelta

from flask_jwt_extended import JWTManager, create_access_token, create_refresh_token
from passlib.context import CryptContext

# Local in-process cache for revoked JTIs — bounded to 4096 entries to avoid unbounded growth.
# Entries are never evicted within a process lifetime but JTIs are short-lived (30 min).
_local_blocklist_cache: dict[str, bool] = {}
_LOCAL_CACHE_MAX = 4096


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
jwt = JWTManager()


def hash_password(raw_password: str) -> str:
    return pwd_context.hash(raw_password)


def verify_password(raw_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(raw_password, hashed_password)


def generate_tokens(identity: str, roles: list[str], extra_claims: dict[str, object] | None = None) -> dict[str, str]:
    claims = {"roles": roles}
    if extra_claims:
        for key, value in extra_claims.items():
            if value is not None:
                claims[key] = value
    access = create_access_token(
        identity=identity,
        additional_claims=claims,
        expires_delta=timedelta(minutes=30),
    )
    refresh = create_refresh_token(
        identity=identity,
        additional_claims=claims,
        expires_delta=timedelta(days=7),  # A4: explicit expiry prevents indefinite tokens
    )
    return {"access_token": access, "refresh_token": refresh}


def add_token_to_blocklist(jti: str, expires_in_seconds: int) -> None:
    """Store JTI in Redis blocklist with TTL matching token expiry."""
    from .cache import redis_client
    redis_client.setex(f"blocklist:{jti}", expires_in_seconds, "true")
    # Mirror in local cache; evict oldest entry if at capacity
    if len(_local_blocklist_cache) >= _LOCAL_CACHE_MAX:
        oldest = next(iter(_local_blocklist_cache))
        del _local_blocklist_cache[oldest]
    _local_blocklist_cache[jti] = True


def is_token_revoked(jti: str) -> bool:
    """Check if a JTI is in the Redis blocklist.

    Fails OPEN on Redis outage: trust the token's own expiry claim instead of
    blocking all users during an infrastructure incident.
    A local in-process cache avoids hammering Redis on every request.
    """
    from loguru import logger
    from .cache import redis_client

    # Fast path: check local in-process LRU cache first (avoids Redis RTT on hot paths)
    if jti in _local_blocklist_cache:
        return True

    try:
        revoked = redis_client.exists(f"blocklist:{jti}") == 1
        if revoked:
            _local_blocklist_cache[jti] = True
        return revoked
    except Exception as exc:
        logger.warning(
            f"Redis unavailable for blocklist check (jti={jti}): {exc}. "
            "Failing OPEN — relying on JWT expiry claim."
        )
        return False  # Let the token's own 'exp' claim be the guard


@jwt.token_in_blocklist_loader
def check_if_token_revoked(jwt_header, jwt_payload) -> bool:
    return is_token_revoked(jwt_payload["jti"])
