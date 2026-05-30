import re
from app.models import Tenant
from app.core.database import session_scope

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
    response = client.get("/metrics")
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

    # Assert process usage metrics
    assert "colaboraedu_process_cpu_seconds" in data
    assert "colaboraedu_process_memory_bytes" in data

    # Verify ID normalization: /api/v1/alunos/999 must be normalized to /api/v1/alunos/<id>
    # Search for colaboraedu_http_requests_total{method="GET",endpoint="/api/v1/alunos/<id>",status="..."}
    assert re.search(r'colaboraedu_http_requests_total\{method="GET",endpoint="/api/v1/alunos/<id>",status="\d+"\} \d+', data) is not None
