"""Application factory for the Boletins Frei backend."""
import time
import uuid
from flask import Flask, g, request
from flask_cors import CORS
from loguru import logger

from .core.config import settings
from .core.database import init_db
from .core.security import jwt
from .api import register_blueprints
from .cli import register_cli


from werkzeug.middleware.proxy_fix import ProxyFix

def create_app() -> Flask:
    if settings.sentry_dsn:
        import sentry_sdk
        from sentry_sdk.integrations.flask import FlaskIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
        from sentry_sdk.integrations.rq import RqIntegration
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            integrations=[FlaskIntegration(), SqlalchemyIntegration(), RqIntegration()],
            environment=settings.environment,
            traces_sample_rate=0.1,
            send_default_pii=False,
        )
        logger.info("Sentry SDK initialized (env={})", settings.environment)

    app = Flask(__name__)
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
    app.config.update(
        SECRET_KEY=settings.secret_key,
        JWT_SECRET_KEY=settings.jwt_secret_key,
        ENV=settings.environment,
        SQLALCHEMY_DATABASE_URI=settings.database_url,
        UPLOAD_FOLDER=settings.upload_folder,
        LOG_LEVEL=settings.log_level,
    )

    CORS(app, resources={r"/api/*": {"origins": settings.allowed_origins}})
    jwt.init_app(app)
    init_db(app)
    register_blueprints(app)
    register_cli(app)

    from .core.extensions import limiter
    # Initialize Rate Limiter — storage URI must be set BEFORE init_app.
    # In production we require Redis-backed storage; per-process in-memory storage
    # would allow up to (workers × limit) attempts per window, undermining brute-force
    # protection.
    # RATELIMIT_STORAGE_FALLBACK_STRATEGY="raise" faz o limiter levantar StorageError
    # quando o Redis cai em tempo de execução. O handler abaixo converte isso em 503,
    # garantindo que autenticação falhe de forma segura (fail-closed) em vez de
    # permitir brute-force ilimitado (fail-open).
    try:
        settings_redis = getattr(settings, 'redis_url', None)
        if settings_redis:
            app.config["RATELIMIT_STORAGE_URI"] = settings_redis
            app.config["RATELIMIT_STORAGE_FALLBACK_STRATEGY"] = "raise"
        limiter.init_app(app)
        logger.info("Flask-Limiter configured with Redis storage (fallback=raise)")
    except Exception as e:
        logger.error(f"Flask-Limiter failed to configure Redis storage: {e}")
        if settings.environment == "production":
            raise RuntimeError(
                "Rate limiter requires Redis in production. "
                "Check REDIS_URL and Redis availability."
            ) from e
        logger.warning("Rate limiter falling back to in-memory storage (dev only)")
    
    from .core.handlers import register_error_handlers
    register_error_handlers(app)

    @app.after_request
    def add_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "0"  # CSP é preferido; valor "1" pode criar vulns em browsers antigos
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        # CSP para respostas da API (sem HTML — bloqueia execução de scripts se renderizado)
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        response.headers["Cache-Control"] = "no-store, no-cache, private"
        if settings.environment == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
        # Attach request-id to response for log correlation
        if hasattr(g, "request_id"):
            response.headers["X-Request-ID"] = g.request_id
        return response

    @app.before_request
    def start_request_timer():
        g.request_start = time.perf_counter()
        g.request_id = uuid.uuid4().hex[:12]

    @app.after_request
    def log_request(response):
        if request.path in ("/health", "/"):
            return response
        duration_ms = (time.perf_counter() - g.request_start) * 1000
        logger.info(
            "{method} {path} → {status} [{duration:.1f}ms] rid={rid}",
            method=request.method,
            path=request.path,
            status=response.status_code,
            duration=duration_ms,
            rid=g.request_id,
        )
        return response
    
    from flask_migrate import Migrate
    from .core.database import Base
    Migrate(app, Base.metadata)

    @app.get("/")
    def root() -> dict[str, str]:
        return {
            "message": "Boletins Frei API",
            "health": "/health",
            "docs": "/docs",
        }

    @app.get("/health")
    @limiter.exempt
    def healthcheck():
        from flask import jsonify as _jsonify
        from sqlalchemy import text as _text
        from .core.database import SessionLocal
        from .core.cache import redis_client

        checks: dict[str, str] = {}
        overall = "ok"

        try:
            with SessionLocal() as s:
                s.execute(_text("SELECT 1"))
            checks["database"] = "ok"
        except Exception as exc:
            logger.error("Health check — database error: {}", exc)
            checks["database"] = "error"
            overall = "degraded"

        try:
            redis_client.ping()
            checks["redis"] = "ok"
        except Exception as exc:
            logger.error("Health check — redis error: {}", exc)
            checks["redis"] = "error"
            overall = "degraded"

        status_code = 200 if overall == "ok" else 503
        return _jsonify({"status": overall, "checks": checks}), status_code

    @app.get("/health/detailed")
    def healthcheck_detailed():
        """Extended health check with migration and queue status.

        Requires a valid JWT with the super_admin role so that internal
        system details are not exposed to unauthenticated callers.
        """
        from flask import jsonify as _jsonify, request as _request
        from flask_jwt_extended import decode_token
        from sqlalchemy import text as _text
        from .core.database import SessionLocal, engine
        from .core.cache import redis_client
        # Lightweight JWT guard (no decorator so we can return structured JSON)
        auth_header = _request.headers.get("Authorization", "")
        is_super_admin = False
        if auth_header.startswith("Bearer "):
            try:
                data = decode_token(auth_header[7:])
                is_super_admin = "super_admin" in (data.get("sub_claims", {}).get("roles") or data.get("roles") or [])
            except Exception:
                pass
        if not is_super_admin:
            return _jsonify({"error": "Acesso restrito a Super Administradores"}), 403

        checks: dict[str, object] = {}
        overall = "ok"

        # Database
        try:
            with SessionLocal() as s:
                s.execute(_text("SELECT 1"))
            checks["database"] = "ok"
        except Exception as exc:
            checks["database"] = f"error: {exc}"
            overall = "degraded"

        # Migrations
        try:
            with engine.connect() as conn:
                heads = conn.execute(_text(
                    "SELECT version_num FROM alembic_version"
                )).scalars().all()
            checks["migrations"] = {"applied": heads}
        except Exception as exc:
            checks["migrations"] = f"error: {exc}"
            overall = "degraded"

        # Redis
        try:
            info = redis_client.ping()
            checks["redis"] = "ok" if info else "no response"
        except Exception as exc:
            checks["redis"] = f"error: {exc}"
            overall = "degraded"

        # RQ worker queue depth (non-critical)
        try:
            from .core.queue import redis_conn
            from rq import Queue as _RQ
            q = _RQ(connection=redis_conn)
            checks["queue"] = {
                "pending": q.count,
                "failed": q.failed_job_registry.count,
            }
        except Exception as exc:
            checks["queue"] = f"unavailable: {exc}"

        checks["environment"] = settings.environment
        checks["db_pool"] = {
            "size": engine.pool.size(),
            "checked_in": engine.pool.checkedin(),
            "checked_out": engine.pool.checkedout(),
            "overflow": engine.pool.overflow(),
        }

        status_code = 200 if overall == "ok" else 503
        return _jsonify({"status": overall, "checks": checks}), status_code

    logger.success("Flask app initialized with environment: {}", settings.environment)
    return app
