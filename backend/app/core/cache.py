import json
from functools import wraps
from flask import g, jsonify, request
from loguru import logger
import redis
from .config import settings

# Initialize redis client
_redis_url = settings.redis_url or "redis://localhost:6379/0"
redis_client = redis.from_url(_redis_url)

# ─── Cache version key helpers ────────────────────────────────────────────────
# Instead of SCAN+DELETE (O(N)), we use a version counter per tenant.
# Incrementing the counter instantly invalidates all cached entries for that
# tenant because old entries will have an outdated version in their key.

def _tenant_cache_version(tenant_id) -> str:
    """Return the current cache version string for a tenant (from Redis)."""
    version = redis_client.get(f"cache_ver:{tenant_id}")
    return version.decode() if version else "1"

def _bump_tenant_cache_version(tenant_id) -> None:
    """Atomically increment the tenant's cache version counter."""
    redis_client.incr(f"cache_ver:{tenant_id}")

def _role_category() -> str:
    """Derive a coarse role bucket for cache key segmentation.

    Different roles may receive different responses from the same endpoint
    (e.g. /dashboard/kpis blocks students). Including the role category in
    the cache key prevents a cached staff response from being served to a
    student (or vice-versa).
    """
    try:
        from flask_jwt_extended import get_jwt
        roles = get_jwt().get("roles") or []
    except Exception:
        return "anon"
    if "super_admin" in roles:
        return "super_admin"
    if "admin" in roles:
        return "admin"
    if any(r in roles for r in ("coordenador", "diretor", "orientador")):
        return "manager"
    if "professor" in roles:
        return "professor"
    if "aluno" in roles:
        return "aluno"
    return "anon"


def cache_response(timeout=300, key_prefix="cache"):
    """Decorator to cache API responses in Redis.

    Cache key includes tenant_id, academic_year_id, role category, and a
    tenant version counter (O(1) invalidation). Role category prevents
    responses intended for one permission level from being served to another.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if settings.environment == "test":
                return f(*args, **kwargs)

            tenant_id = getattr(g, 'tenant_id', 'no_tenant')
            year_id = getattr(g, 'academic_year_id', 'no_year')
            role = _role_category()

            # Resolve version — if Redis is down, skip caching entirely
            try:
                version = _tenant_cache_version(tenant_id)
            except Exception as e:
                logger.warning("Cache version lookup failed, bypassing cache: {}", e)
                return f(*args, **kwargs)

            cache_key = (
                f"{key_prefix}:{tenant_id}:v{version}:{year_id}"
                f":{role}:{request.path}:{request.query_string.decode()}"
            )

            try:
                cached_data = redis_client.get(cache_key)
                if cached_data:
                    return jsonify(json.loads(cached_data))
            except Exception as e:
                logger.warning("Cache read failed for key {}: {}", cache_key, e)

            response = f(*args, **kwargs)

            # Only cache plain 200 OK responses (not tuples with status codes)
            if isinstance(response, tuple):
                return response

            try:
                if isinstance(response, (dict, list)):
                    redis_client.setex(cache_key, timeout, json.dumps(response))
            except Exception as e:
                logger.warning("Cache write failed for key {}: {}", cache_key, e)

            return response
        return decorated_function
    return decorator

def invalidate_tenant_cache():
    """Invalidate all cached responses for the current tenant in O(1).

    Bumps the version counter so all existing cache keys (which embed the old
    version) become stale and are ignored on the next read. They expire
    naturally via their TTL.
    """
    tenant_id = getattr(g, 'tenant_id', None)
    if tenant_id:
        try:
            _bump_tenant_cache_version(tenant_id)
        except Exception as e:
            logger.warning("Cache invalidation failed for tenant {}: {}", tenant_id, e)
