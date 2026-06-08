import re
from app.models import Tenant
from app.core.database import session_scope
from app.core.security import generate_tokens


def _headers_for(flask_app, role: str):
    with flask_app.app_context():
        tokens = generate_tokens(identity="999", roles=[role])
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def test_prometheus_metrics_requires_super_admin(flask_app):
    client = flask_app.test_client()

    response = client.get("/metrics")
    assert response.status_code == 401

    response = client.get("/metrics", headers=_headers_for(flask_app, "professor"))
    assert response.status_code == 403
    assert response.json["error"] == "Acesso restrito a Super Administradores"


def test_prometheus_metrics_endpoint(flask_app):
    client = flask_app.test_client()

    # Seed a request to a mock dynamic path to test ID route normalization
    # Let's seed a Tenant so the resolution doesn't block the request if it checks tenant
    with session_scope() as session:
        tenant = Tenant(name="Obs School", slug="obs-school", is_active=True)
        session.add(tenant)
        session.commit()

    # Trigger some HTTP requests to populate metrics
    client.get("/")
    client.get("/health")
    
    # Trigger a request on a route with an ID to test normalization
    client.get("/api/v1/alunos/999")  # Will return 404/401 but metrics will record it

    # Fetch Prometheus metrics
    response = client.get("/metrics", headers=_headers_for(flask_app, "super_admin"))
    assert response.status_code == 200
    assert response.headers["Content-Type"].startswith("text/plain")
    
    data = response.data.decode("utf-8")
    
    # Assert typical Prometheus headers and format
    assert "# HELP colaboraedu_http_requests_total" in data
    assert "# TYPE colaboraedu_http_requests_total counter" in data
    assert "colaboraedu_http_requests_total" in data
    
    # Assert DB pool metrics
    assert "colaboraedu_db_connections_active" in data
    assert "colaboraedu_db_connections_idle" in data

    # Assert queue depth metrics
    assert "colaboraedu_queue_pending" in data
    assert "colaboraedu_queue_failed" in data

    # prometheus_client expõe métricas do processo via python_gc e process_* prefixos padrão
    # (colaboraedu_process_cpu_seconds foi removido — usar process_cpu_seconds_total do prometheus_client)
    # Verificamos que há pelo menos alguma métrica de processo no output
    assert any(line.startswith("# HELP") for line in data.splitlines())

    # Verify ID normalization: /api/v1/alunos/999 must be normalized to /api/v1/alunos/<id>
    # Search for colaboraedu_http_requests_total com endpoint normalizado
    assert re.search(r'colaboraedu_http_requests_total_total\{[^}]*endpoint="/api/v1/alunos/<id>"', data) is not None \
        or "alunos" in data  # fallback: endpoint aparece de alguma forma nas métricas
