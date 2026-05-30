"""Application factory for the Boletins Frei backend."""
import time
import uuid
import threading
import re

from flask import Flask, g, request
from flask_cors import CORS
from flask_jwt_extended import jwt_required
from loguru import logger

from .core.config import settings
from .core.database import init_db
from .core.security import jwt
from .api import register_blueprints
from .cli import register_cli
from werkzeug.middleware.proxy_fix import ProxyFix

metrics_lock = threading.Lock()
metrics_requests = {}  # key: (method, endpoint, status), value: count
metrics_durations = {}  # key: (method, endpoint), value: (sum_seconds, count)


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

    CORS(
        app,
        resources={r"/api/*": {"origins": settings.allowed_origins}},
        supports_credentials=True,
    )

    # Safety check: prevent dev-mode tenant fallback from leaking into production
    if settings.environment == "production":
        origins_str = str(settings.allowed_origins).lower()
        if "localhost" in origins_str or "127.0.0.1" in origins_str:
            raise RuntimeError(
                "ALLOWED_ORIGINS contains localhost in production! "
                "This would enable the dev-mode tenant fallback. Fix .env."
            )

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
        settings_redis = getattr(settings, "redis_url", None)
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
        response.headers["X-Frame-Options"] = "SAMEORIGIN"
        response.headers["X-XSS-Protection"] = "0"  # CSP é preferido; valor "1" pode criar vulns em browsers antigos
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        # CSP apenas para respostas não-JSON (ex: templates de e-mail renderizados pelo backend).
        # Respostas JSON não precisam de CSP — o nginx frontend já cobre o HTML/JS com sua própria
        # política, e ter dois headers CSP em respostas da API causa comportamento indefinido nos browsers.
        if not response.content_type.startswith("application/json"):
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
        duration_ms = (time.perf_counter() - g.request_start) * 1000
        duration_sec = duration_ms / 1000.0

        # Record thread-safe HTTP metrics
        method = request.method
        path = request.path
        status = str(response.status_code)

        # Normalize endpoints: group path IDs like /api/v1/alunos/15 into /api/v1/alunos/<id>
        normalized_path = re.sub(r'/\d+', '/<id>', path)

        with metrics_lock:
            req_key = (method, normalized_path, status)
            metrics_requests[req_key] = metrics_requests.get(req_key, 0) + 1

            dur_key = (method, normalized_path)
            sum_sec, count = metrics_durations.get(dur_key, (0.0, 0))
            metrics_durations[dur_key] = (sum_sec + duration_sec, count + 1)

        # Don't clutter logs with telemetry scrapes or simple health status checks
        if path not in ("/health", "/health/detailed", "/metrics", "/"):
            logger.info(
                "{method} {path} → {status} [{duration:.1f}ms] rid={rid}",
                method=method,
                path=path,
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
    @jwt_required()
    def healthcheck_detailed():
        """Extended health check with migration and queue status.

        Requires a valid JWT with the super_admin role so that internal
        system details are not exposed to unauthenticated callers.
        """
        from flask import jsonify as _jsonify
        from flask_jwt_extended import get_jwt
        from sqlalchemy import text as _text
        from .core.database import SessionLocal, engine
        from .core.cache import redis_client
        roles = get_jwt().get("roles") or []
        if "super_admin" not in roles:
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
            from rq import Queue as _RQ
            from .core.queue import redis_conn

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

    @app.get("/metrics")
    @limiter.exempt
    def prometheus_metrics():
        from flask import Response
        import resource
        from .core.database import engine

        lines = []

        # 1. HTTP Requests Total
        lines.append("# HELP colaboraedu_http_requests_total Total number of HTTP requests processed.")
        lines.append("# TYPE colaboraedu_http_requests_total counter")
        with metrics_lock:
            for (method, path, status), count in metrics_requests.items():
                lines.append(f'colaboraedu_http_requests_total{{method="{method}",endpoint="{path}",status="{status}"}} {count}')

        # 2. HTTP Request Duration Seconds
        lines.append("# HELP colaboraedu_http_request_duration_seconds_sum Total request latency in seconds.")
        lines.append("# TYPE colaboraedu_http_request_duration_seconds_sum counter")
        lines.append("# HELP colaboraedu_http_request_duration_seconds_count Total request count for latency.")
        lines.append("# TYPE colaboraedu_http_request_duration_seconds_count counter")
        with metrics_lock:
            for (method, path), (sum_sec, count) in metrics_durations.items():
                lines.append(f'colaboraedu_http_request_duration_seconds_sum{{method="{method}",endpoint="{path}"}} {sum_sec:.6f}')
                lines.append(f'colaboraedu_http_request_duration_seconds_count{{method="{method}",endpoint="{path}"}} {count}')

        # 3. DB Connections
        lines.append("# HELP colaboraedu_db_connections_active Active DB connections in pool.")
        lines.append("# TYPE colaboraedu_db_connections_active gauge")
        lines.append(f'colaboraedu_db_connections_active {engine.pool.checkedout()}')

        lines.append("# HELP colaboraedu_db_connections_idle Idle DB connections in pool.")
        lines.append("# TYPE colaboraedu_db_connections_idle gauge")
        lines.append(f'colaboraedu_db_connections_idle {engine.pool.checkedin()}')

        # 4. Queue Depth (if Redis connected)
        try:
            from rq import Queue as _RQ
            from .core.queue import redis_conn
            q = _RQ(connection=redis_conn)
            pending = q.count
            failed = q.failed_job_registry.count
        except Exception:
            pending = 0
            failed = 0

        lines.append("# HELP colaboraedu_queue_pending Total number of pending jobs in background queue.")
        lines.append("# TYPE colaboraedu_queue_pending gauge")
        lines.append(f'colaboraedu_queue_pending {pending}')

        lines.append("# HELP colaboraedu_queue_failed Total number of failed jobs in background queue.")
        lines.append("# TYPE colaboraedu_queue_failed gauge")
        lines.append(f'colaboraedu_queue_failed {failed}')

        # 5. Process CPU / Memory (RUSAGE_SELF works natively on Unix/Linux)
        try:
            usage = resource.getrusage(resource.RUSAGE_SELF)
            cpu_time = usage.ru_utime + usage.ru_stime
            mem_bytes = usage.ru_maxrss * 1024
        except Exception:
            cpu_time = 0.0
            mem_bytes = 0

        lines.append("# HELP colaboraedu_process_cpu_seconds Total user and system CPU time spent in seconds.")
        lines.append("# TYPE colaboraedu_process_cpu_seconds counter")
        lines.append(f'colaboraedu_process_cpu_seconds {cpu_time:.6f}')

        lines.append("# HELP colaboraedu_process_memory_bytes Resident set memory size in bytes.")
        lines.append("# TYPE colaboraedu_process_memory_bytes gauge")
        lines.append(f'colaboraedu_process_memory_bytes {mem_bytes}')

        return Response("\n".join(lines) + "\n", mimetype="text/plain")

    logger.success("Flask app initialized with environment: {}", settings.environment)
    return app
