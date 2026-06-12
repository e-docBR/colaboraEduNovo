import io
import os
import pytest
from app.core.database import session_scope
from app.core.security import generate_tokens
from app.models import Tenant, Usuario

def _headers_for(flask_app, user_id: int, role: str, *, tenant_id: int = 1):
    with flask_app.app_context():
        tokens = generate_tokens(
            identity=str(user_id),
            roles=[role],
            extra_claims={"tenant_id": tenant_id, "academic_year_id": 1},
        )
    return {"Authorization": f"Bearer {tokens['access_token']}"}

def test_escola_settings_get_and_put(client, flask_app):
    with session_scope() as session:
        # Setup Tenant
        tenant = Tenant(name="Escola Teste Config", slug="escola-cfg", is_active=True)
        session.add(tenant)
        session.flush()
        tenant_id = tenant.id

        # Setup Admin User
        admin = Usuario(
            username="admin.cfg",
            password_hash="hash",
            role="admin",
            tenant_id=tenant_id,
            must_change_password=False
        )
        session.add(admin)
        session.flush()
        admin_id = admin.id

        # Setup Aluno User
        aluno = Usuario(
            username="aluno.cfg",
            password_hash="hash",
            role="aluno",
            tenant_id=tenant_id,
            must_change_password=False
        )
        session.add(aluno)
        session.flush()
        aluno_id = aluno.id

    admin_headers = _headers_for(flask_app, admin_id, "admin", tenant_id=tenant_id)
    aluno_headers = _headers_for(flask_app, aluno_id, "aluno", tenant_id=tenant_id)

    # 1. GET Settings - admin (success)
    response = client.get("/api/v1/escola", headers=admin_headers)
    assert response.status_code == 200
    assert response.json["name"] == "Escola Teste Config"
    assert response.json["settings"]["media_aprovacao"] == 50.0

    # 2. GET Settings - aluno (forbidden)
    response = client.get("/api/v1/escola", headers=aluno_headers)
    assert response.status_code == 403

    # 3. PUT Settings - invalid data (media_aprovacao = 150)
    payload = {
        "name": "Escola Teste Config Alterada",
        "settings": {
            "cnpj": "12.345.678/0001-90",
            "endereco": "Rua Principal, 123",
            "telefone": "(11) 99999-9999",
            "email": "contato@escola.com",
            "media_aprovacao": 150.0,  # invalid
            "whatsapp_enabled": True,
            "email_enabled": False
        }
    }
    response = client.put("/api/v1/escola", json=payload, headers=admin_headers)
    assert response.status_code == 400

    # 4. PUT Settings - valid data (success)
    payload["settings"]["media_aprovacao"] = 60.0
    response = client.put("/api/v1/escola", json=payload, headers=admin_headers)
    assert response.status_code == 200
    assert response.json["name"] == "Escola Teste Config Alterada"
    assert response.json["settings"]["media_aprovacao"] == 60.0

    # Verify change in database
    with session_scope() as session:
        t = session.get(Tenant, tenant_id)
        assert t.name == "Escola Teste Config Alterada"
        assert t.settings["media_aprovacao"] == 60.0

def test_escola_logo_upload(client, flask_app):
    with session_scope() as session:
        tenant = Tenant(name="Escola Teste Logo", slug="escola-logo", is_active=True)
        session.add(tenant)
        session.flush()
        tenant_id = tenant.id

        admin = Usuario(
            username="admin.logo",
            password_hash="hash",
            role="admin",
            tenant_id=tenant_id,
            must_change_password=False
        )
        session.add(admin)
        session.flush()
        admin_id = admin.id

    admin_headers = _headers_for(flask_app, admin_id, "admin", tenant_id=tenant_id)

    # 1. Upload invalid file type
    data = {
        "file": (io.BytesIO(b"dummy pdf content"), "logo.pdf")
    }
    response = client.post("/api/v1/escola/logo", data=data, content_type="multipart/form-data", headers=admin_headers)
    assert response.status_code == 400

    # 2. Upload valid PNG image
    png_data = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    data = {
        "file": (io.BytesIO(png_data), "logo.png")
    }
    response = client.post("/api/v1/escola/logo", data=data, content_type="multipart/form-data", headers=admin_headers)
    assert response.status_code == 200
    logo_url = response.json["logo_url"]
    assert logo_url.startswith("/api/v1/static/logos/")

    # 3. Serve the logo
    filename = logo_url.rsplit("/", 1)[-1]
    response = client.get(f"/api/v1/static/logos/{filename}")
    assert response.status_code == 200
    assert response.data == png_data
