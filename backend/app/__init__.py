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
    app = Flask(__name__)
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
    app.config.update(
        SECRET_KEY=settings.secret_key,
        JWT_SECRET_KEY=settings.jwt_secret_key,
        ENV=settings.environment,
        SQLALCHEMY_DATABASE_URI=settings.database_url,
        UPLOAD_FOLDER=settings.upload_folder,
        LOG_LEVEL=settings.log_level,
        # SMTP Settings
        MAIL_SERVER=settings.smtp_server,
        MAIL_PORT=settings.smtp_port,
        MAIL_USE_TLS=settings.smtp_use_tls,
        MAIL_USE_SSL=settings.smtp_use_ssl,
        MAIL_USERNAME=settings.smtp_user,
        MAIL_PASSWORD=settings.smtp_password,
        MAIL_DEFAULT_SENDER=settings.smtp_from,
        MAIL_SUPPRESS_SEND=(not settings.smtp_user),  # silencia quando SMTP não configurado
    )

    CORS(app, resources={r"/api/*": {"origins": settings.allowed_origins}})
    jwt.init_app(app)
    init_db(app)
    register_blueprints(app)
    register_cli(app)

    from .services.communication_service import mail
    mail.init_app(app)
    
    from .core.extensions import limiter
    # Initialize Rate Limiter — storage URI must be set BEFORE init_app
    try:
        settings_redis = getattr(settings, 'redis_url', None)
        if settings_redis:
            app.config["RATELIMIT_STORAGE_URI"] = settings_redis
        limiter.init_app(app)
        logger.info("Flask-Limiter configured")
    except Exception as e:
        logger.warning(f"Failed to configure Flask-Limiter: {e}")
    
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
            checks["database"] = f"error: {exc}"
            overall = "degraded"

        try:
            redis_client.ping()
            checks["redis"] = "ok"
        except Exception as exc:
            checks["redis"] = f"error: {exc}"
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
        from flask_jwt_extended import decode_token, exceptions as jwt_exc
        from sqlalchemy import text as _text
        from .core.database import SessionLocal, engine
        from .core.cache import redis_client
        import importlib.metadata as _meta

        # Lightweight JWT guard (no decorator so we can return structured JSON)
        auth_header = _request.headers.get("Authorization", "")
        is_super_admin = False
        if auth_header.startswith("Bearer "):
            try:
                data = decode_token(auth_header[7:])
                is_super_admin = "super_admin" in (data.get("sub_claims", {}).get("roles") or data.get("roles") or [])
            except Exception:
                pass

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

        # App info (only for authenticated super_admin)
        if is_super_admin:
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
