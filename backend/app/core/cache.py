import json
from functools import wraps
from flask import g, jsonify
import redis
from .config import settings

# Initialize redis client
redis_client = redis.from_url(settings.redis_url)

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

def cache_response(timeout=300, key_prefix="cache"):
    """
    Decorator to cache API responses in Redis.
    The cache key is sensitive to tenant_id, academic_year_id, and a tenant
    version counter so that invalidation is O(1) instead of O(N) SCAN.
    """
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            if settings.environment == "test":
                return f(*args, **kwargs)

            tenant_id = getattr(g, 'tenant_id', 'no_tenant')
            year_id = getattr(g, 'academic_year_id', 'no_year')

            # Resolve version — if Redis is down, skip caching entirely
            try:
                version = _tenant_cache_version(tenant_id)
            except Exception:
                return f(*args, **kwargs)

            from flask import request
            cache_key = (
                f"{key_prefix}:{tenant_id}:v{version}:{year_id}"
                f":{request.path}:{request.query_string.decode()}"
            )

            try:
                cached_data = redis_client.get(cache_key)
                if cached_data:
                    return jsonify(json.loads(cached_data))
            except Exception:
                pass

            response = f(*args, **kwargs)

            # Only cache plain 200 OK responses (not tuples with status codes)
            if isinstance(response, tuple):
                return response

            try:
                if isinstance(response, (dict, list)):
                    redis_client.setex(cache_key, timeout, json.dumps(response))
            except Exception:
                pass

            return response
        return decorated_function
    return decorator

def invalidate_tenant_cache():
    """Invalidate all cached responses for the current tenant in O(1).

    Instead of scanning and deleting keys, we bump the version counter so all
    existing cache keys (which embed the old version) become stale and are
    ignored on the next read. They expire naturally via their TTL.
    """
    tenant_id = getattr(g, 'tenant_id', None)
    if tenant_id:
        try:
            _bump_tenant_cache_version(tenant_id)
        except Exception:
            pass  # Redis unavailable — cache will serve stale until keys expire
