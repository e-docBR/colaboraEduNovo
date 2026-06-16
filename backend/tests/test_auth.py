import io

from app.core.database import session_scope
from app.core.security import generate_tokens
from app.models import AcademicYear, Aluno, Tenant, Usuario


def _headers_for(flask_app, role: str, *, tenant_id: int = 1, academic_year_id: int = 1):
    with flask_app.app_context():
        tokens = generate_tokens(
            identity="999",
            roles=[role],
            extra_claims={"tenant_id": tenant_id, "academic_year_id": academic_year_id},
        )
    return {"Authorization": f"Bearer {tokens['access_token']}"}

def test_login_success(client, admin_user):
    response = client.post("/api/v1/auth/login", json={
        "username": "admin_test",
        "password": "admin123",
        "tenant_slug": "default",
    })
    assert response.status_code == 200
    data = response.json
    assert "access_token" in data
    assert "refresh_token" not in data
    assert data["user"]["username"] == "admin_test"
    assert "rt=" in response.headers.get("Set-Cookie", "")


def test_mobile_login_returns_refresh_token_in_body(client, admin_user):
    response = client.post(
        "/api/v1/auth/login",
        headers={"X-Client-Platform": "mobile"},
        json={
            "username": "admin_test",
            "password": "admin123",
            "tenant_slug": "default",
        },
    )
    assert response.status_code == 200
    assert "refresh_token" in response.json


def test_mobile_refresh_rotates_refresh_token(client, admin_user):
    login = client.post(
        "/api/v1/auth/login",
        headers={"X-Client-Platform": "mobile"},
        json={
            "username": "admin_test",
            "password": "admin123",
            "tenant_slug": "default",
        },
    )
    old_refresh = login.json["refresh_token"]

    refreshed = client.post(
        "/api/v1/auth/refresh",
        headers={
            "X-Client-Platform": "mobile",
            "Authorization": f"Bearer {old_refresh}",
        },
    )
    assert refreshed.status_code == 200
    assert refreshed.json["refresh_token"] != old_refresh

    reused = client.post(
        "/api/v1/auth/refresh",
        headers={
            "X-Client-Platform": "mobile",
            "Authorization": f"Bearer {old_refresh}",
        },
    )
    assert reused.status_code == 401


def test_mobile_logout_revokes_refresh_token(client, admin_user):
    login = client.post(
        "/api/v1/auth/login",
        headers={"X-Client-Platform": "mobile"},
        json={
            "username": "admin_test",
            "password": "admin123",
            "tenant_slug": "default",
        },
    )
    access_token = login.json["access_token"]
    refresh_token = login.json["refresh_token"]

    logout = client.post(
        "/api/v1/auth/logout",
        headers={
            "Authorization": f"Bearer {access_token}",
            "X-Client-Platform": "mobile",
        },
        json={"refresh_token": refresh_token},
    )
    assert logout.status_code == 204

    reused = client.post(
        "/api/v1/auth/refresh",
        headers={
            "X-Client-Platform": "mobile",
            "Authorization": f"Bearer {refresh_token}",
        },
    )
    assert reused.status_code == 401

def test_login_failure(client):
    response = client.post("/api/v1/auth/login", json={
        "username": "wrong",
        "password": "wrong"
    })
    assert response.status_code == 401


def test_regular_user_login_requires_tenant(client, admin_user):
    response = client.post("/api/v1/auth/login", json={
        "username": "admin_test",
        "password": "admin123",
    })
    assert response.status_code == 401

def test_change_password(client, auth_headers):
    # New password must satisfy: 8+ chars, uppercase, digit, special char
    response = client.post("/api/v1/auth/change-password", headers=auth_headers, json={
        "current_password": "admin123",
        "new_password": "NewPass456!"
    })
    assert response.status_code == 204

    # After change, the old token is revoked — must log in again with the new password
    response = client.post("/api/v1/auth/login", json={
        "username": "admin_test",
        "password": "NewPass456!",
        "tenant_slug": "default",
    })
    assert response.status_code == 200


def test_mobile_change_password_revokes_refresh_token(client, admin_user):
    login = client.post(
        "/api/v1/auth/login",
        headers={"X-Client-Platform": "mobile"},
        json={
            "username": "admin_test",
            "password": "admin123",
            "tenant_slug": "default",
        },
    )
    access_token = login.json["access_token"]
    refresh_token = login.json["refresh_token"]

    response = client.post(
        "/api/v1/auth/change-password",
        headers={
            "Authorization": f"Bearer {access_token}",
            "X-Client-Platform": "mobile",
        },
        json={
            "current_password": "admin123",
            "new_password": "NewPass456!",
            "refresh_token": refresh_token,
        },
    )
    assert response.status_code == 204

    reused = client.post(
        "/api/v1/auth/refresh",
        headers={
            "X-Client-Platform": "mobile",
            "Authorization": f"Bearer {refresh_token}",
        },
    )
    assert reused.status_code == 401

def test_upload_photo(client, auth_headers):
    # Build a minimal valid JPEG: starts with FF D8 magic bytes
    jpeg_bytes = b"\xff\xd8\xff\xe0" + b"\x00" * 20
    data = {
        "file": (io.BytesIO(jpeg_bytes), "photo.jpg", "image/jpeg")
    }
    response = client.post(
        "/api/v1/usuarios/me/photo",
        headers=auth_headers,
        data=data,
        content_type="multipart/form-data"
    )
    assert response.status_code == 200
    assert "photo_url" in response.json
    # Filename is UUID-based, not the original name — just verify the URL path prefix
    assert response.json["photo_url"].startswith("/api/v1/static/photos/")

def test_uploaded_photo_requires_authentication(client, auth_headers):
    jpeg_bytes = b"\xff\xd8\xff\xe0" + b"\x00" * 20
    upload = client.post(
        "/api/v1/usuarios/me/photo",
        headers=auth_headers,
        data={"file": (io.BytesIO(jpeg_bytes), "photo.jpg", "image/jpeg")},
        content_type="multipart/form-data",
    )
    photo_url = upload.json["photo_url"]

    unauthenticated = client.get(photo_url)
    assert unauthenticated.status_code == 401

    authenticated = client.get(photo_url, headers=auth_headers)
    assert authenticated.status_code == 200


def test_get_me_resolves_current_year_aluno_by_matricula(client, flask_app, admin_user):
    with session_scope() as session:
        tenant = session.query(Tenant).filter(Tenant.slug == "default").first()
        tenant_id = tenant.id

        previous_year = session.query(AcademicYear).filter(
            AcademicYear.tenant_id == tenant_id,
            AcademicYear.label == "2025",
        ).first()
        if not previous_year:
            previous_year = AcademicYear(tenant_id=tenant_id, label="2025", is_current=False)
            session.add(previous_year)
            session.flush()

        current_year = session.query(AcademicYear).filter(
            AcademicYear.tenant_id == tenant_id,
            AcademicYear.label == "2026",
        ).first()
        current_year_id = current_year.id

        matricula = "AUTH-ME-2026-001"
        old_aluno = Aluno(
            matricula=matricula,
            nome="Aluno Ano Antigo",
            turma="1A",
            turno="Matutino",
            tenant_id=tenant_id,
            academic_year_id=previous_year.id,
        )
        current_aluno = Aluno(
            matricula=matricula,
            nome="Aluno Ano Atual",
            turma="2A",
            turno="Matutino",
            tenant_id=tenant_id,
            academic_year_id=current_year_id,
        )
        session.add_all([old_aluno, current_aluno])
        session.flush()

        usuario = Usuario(
            username="alunoaluno-2026-001",
            password_hash="hash",
            role="aluno",
            aluno_id=old_aluno.id,
            matricula=matricula,
            tenant_id=tenant_id,
        )
        session.add(usuario)
        session.flush()
        user_id = usuario.id
        current_aluno_id = current_aluno.id

    with flask_app.app_context():
        tokens = generate_tokens(
            identity=str(user_id),
            roles=["aluno"],
            extra_claims={"tenant_id": tenant_id, "academic_year_id": current_year_id},
        )

    response = client.get(
        "/api/v1/usuarios/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert response.status_code == 200
    assert response.json["aluno"]["id"] == current_aluno_id


def test_admin_cannot_create_super_admin(client, auth_headers):
    response = client.post("/api/v1/usuarios", headers=auth_headers, json={
        "username": "evil_super",
        "password": "StrongPass1",
        "role": "super_admin",
    })
    assert response.status_code == 403


def test_admin_cannot_create_admin(client, auth_headers):
    response = client.post("/api/v1/usuarios", headers=auth_headers, json={
        "username": "evil_admin",
        "password": "StrongPass1",
        "role": "admin",
    })
    assert response.status_code == 403


def test_responsavel_cannot_access_dashboard(client, flask_app, admin_user):
    response = client.get("/api/v1/dashboard/professor", headers=_headers_for(flask_app, "responsavel"))
    assert response.status_code == 403


def test_staff_cannot_read_aluno_from_other_tenant(client, flask_app, admin_user):
    with session_scope() as session:
        tenant = Tenant(name="Outra Escola", slug="outra-auth-tenant", is_active=True)
        session.add(tenant)
        session.flush()
        year = AcademicYear(tenant_id=tenant.id, label="2026", is_current=True)
        session.add(year)
        session.flush()
        aluno = Aluno(
            matricula="TENANT2-001",
            nome="Aluno Outro Tenant",
            turma="1A",
            turno="Matutino",
            tenant_id=tenant.id,
            academic_year_id=year.id,
        )
        session.add(aluno)
        session.flush()
        other_aluno_id = aluno.id

    response = client.get(
        f"/api/v1/alunos/{other_aluno_id}",
        headers=_headers_for(flask_app, "professor", tenant_id=1, academic_year_id=1),
    )
    assert response.status_code == 404


def test_super_admin_cannot_create_tenant_with_weak_admin_password(client, flask_app):
    response = client.post(
        "/api/v1/admin/tenants",
        headers=_headers_for(flask_app, "super_admin"),
        json={
            "name": "Escola Senha Fraca",
            "slug": "escola-senha-fraca",
            "admin_email": "admin-fraco@example.com",
            "admin_password": "fraca",
        },
    )
    assert response.status_code == 400
    assert "senha" in response.json["error"].lower()


def test_super_admin_cannot_create_tenant_with_invalid_slug(client, flask_app):
    response = client.post(
        "/api/v1/admin/tenants",
        headers=_headers_for(flask_app, "super_admin"),
        json={
            "name": "Escola Slug Inválido",
            "slug": "../outra",
            "admin_email": "admin-slug@example.com",
            "admin_password": "StrongPass1",
        },
    )
    assert response.status_code == 400
    assert "slug" in response.json["error"].lower()
