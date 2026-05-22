from app.core.security import generate_tokens


def _headers_for(flask_app, role: str):
    with flask_app.app_context():
        tokens = generate_tokens(identity="999", roles=[role])
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def test_health_endpoint(flask_app):
    client = flask_app.test_client()
    response = client.get("/health")
    assert response.status_code in (200, 503)
    assert response.json["status"] in ("ok", "degraded")
    assert "checks" in response.json


def test_detailed_health_requires_super_admin(flask_app):
    client = flask_app.test_client()
    response = client.get("/health/detailed")
    assert response.status_code == 401


def test_detailed_health_rejects_non_super_admin(flask_app):
    client = flask_app.test_client()
    response = client.get("/health/detailed", headers=_headers_for(flask_app, "professor"))
    assert response.status_code == 403
    assert response.json["error"] == "Acesso restrito a Super Administradores"


def test_detailed_health_allows_super_admin(flask_app):
    client = flask_app.test_client()
    response = client.get("/health/detailed", headers=_headers_for(flask_app, "super_admin"))
    assert response.status_code in (200, 503)
    assert "checks" in response.json
    assert "environment" in response.json["checks"]
