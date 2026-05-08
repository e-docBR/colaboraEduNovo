"""Security-focused tests covering L2 requirements:
password reset expiry, cross-tenant isolation, weak-password rejection,
and random initial password for student accounts.
"""
import app.core.cache as cache_module
from app.core.database import session_scope
from app.models import AcademicYear, Tenant


def _get_default_year():
    with session_scope() as session:
        tenant = session.query(Tenant).filter(Tenant.slug == "default").first()
        year = session.query(AcademicYear).filter(
            AcademicYear.tenant_id == tenant.id,
            AcademicYear.is_current.is_(True),
        ).first()
        return year.id if year else None


class TestPasswordResetExpiry:
    def test_expired_token_returns_400(self, client):
        """Consuming a nonexistent/expired reset token must return 400, not 500."""
        response = client.post("/api/v1/auth/reset-password", json={
            "token": "does-not-exist-token-xyz",
            "new_password": "ValidPass1!",
        })
        assert response.status_code == 400

    def test_token_consumed_after_reset(self, client, admin_user):
        """Reset token must be single-use — second attempt with same token fails."""
        import secrets
        token = secrets.token_urlsafe(32)
        with session_scope() as session:
            from app.models import Tenant, Usuario
            user = session.query(Usuario).filter(Usuario.username == "admin_test").first()
            tenant = session.query(Tenant).filter(Tenant.slug == "default").first()
            user_id, tenant_id = user.id, tenant.id
        cache_module.redis_client.setex(
            f"pwd_reset:{token}", 3600, f"{user_id}:{tenant_id}"
        )

        # First use should succeed
        r1 = client.post("/api/v1/auth/reset-password", json={
            "token": token,
            "new_password": "NewSecure1!",
        })
        assert r1.status_code in (200, 204)

        # Second use of same token must fail
        r2 = client.post("/api/v1/auth/reset-password", json={
            "token": token,
            "new_password": "AnotherPass1!",
        })
        assert r2.status_code == 400


class TestCrossTenantIsolation:
    def test_login_with_wrong_tenant_slug_fails(self, client, admin_user):
        """User registered in tenant 'default' cannot authenticate via another slug."""
        response = client.post("/api/v1/auth/login", json={
            "username": "admin_test",
            "password": "admin123",
            "tenant_slug": "nonexistent-tenant-xyz",
        })
        assert response.status_code == 401

    def test_cross_tenant_token_cannot_reset_password(self, client, admin_user):
        """A reset token issued for tenant A is invalid if tenant B's ID is substituted."""
        import secrets
        token = secrets.token_urlsafe(32)
        with session_scope() as session:
            from app.models import Usuario
            user = session.query(Usuario).filter(Usuario.username == "admin_test").first()
            user_id = user.id
        fake_tenant_id = 9999  # does not match the real tenant_id
        cache_module.redis_client.setex(
            f"pwd_reset:{token}", 3600, f"{user_id}:{fake_tenant_id}"
        )
        response = client.post("/api/v1/auth/reset-password", json={
            "token": token,
            "new_password": "NewSecure1!",
        })
        assert response.status_code == 400


class TestWeakPasswordRejection:
    def test_change_password_rejects_too_short(self, client, auth_headers):
        response = client.post("/api/v1/auth/change-password", headers=auth_headers, json={
            "current_password": "admin123",
            "new_password": "Ab1!",
        })
        assert response.status_code == 422

    def test_change_password_rejects_no_uppercase(self, client, auth_headers):
        response = client.post("/api/v1/auth/change-password", headers=auth_headers, json={
            "current_password": "admin123",
            "new_password": "weakpass1!",
        })
        assert response.status_code == 422

    def test_change_password_rejects_no_special_char(self, client, auth_headers):
        response = client.post("/api/v1/auth/change-password", headers=auth_headers, json={
            "current_password": "admin123",
            "new_password": "Weakpass1",
        })
        assert response.status_code == 422

    def test_reset_password_rejects_weak(self, client):
        import secrets
        token = secrets.token_urlsafe(32)
        cache_module.redis_client.setex(f"pwd_reset:{token}", 3600, "999:1")
        response = client.post("/api/v1/auth/reset-password", json={
            "token": token,
            "new_password": "weak",
        })
        # Token must NOT be consumed for a weak password (C4)
        assert response.status_code in (400, 422)
        # Token should still exist (not consumed) after validation failure
        stored = cache_module.redis_client.get(f"pwd_reset:{token}")
        assert stored is not None, "Token was consumed before password validation — violates C4"


class TestStudentRandomPassword:
    def test_aluno_initial_password_is_not_matricula(self, client, auth_headers):
        """Student account initial password must be a random token, not the matricula."""
        year_id = _get_default_year()
        response = client.post("/api/v1/alunos", headers=auth_headers, json={
            "matricula": "SEC-TEST-001",
            "nome": "Aluno Senha Aleatória",
            "turma": "2B",
            "turno": "Matutino",
            "academic_year_id": year_id,
        })
        assert response.status_code == 201
        data = response.json
        assert "senha_inicial" in data
        # Must not be the matricula
        assert data["senha_inicial"] != "SEC-TEST-001"
        # Must be a proper random token (at least 16 chars)
        assert len(data["senha_inicial"]) >= 16


class TestOcorrenciasCRUD:
    def test_create_and_list_ocorrencia(self, client, auth_headers, flask_app):
        from app.core.security import generate_tokens
        from app.core.database import session_scope as _ss
        from app.models import Usuario, Tenant

        with _ss() as session:
            user = session.query(Usuario).filter(Usuario.username == "admin_test").first()
            uid, tid = user.id, user.tenant_id

        with flask_app.app_context():
            tokens = generate_tokens(
                identity=str(uid),
                roles=["admin"],
                extra_claims={"tenant_id": tid, "academic_year_id": 1},
            )
        headers = {"Authorization": f"Bearer {tokens['access_token']}"}

        year_id = _get_default_year()
        aluno_resp = client.post("/api/v1/alunos", headers=auth_headers, json={
            "matricula": "OC-TEST-001",
            "nome": "Aluno Ocorrência",
            "turma": "3C",
            "turno": "Vespertino",
            "academic_year_id": year_id,
        })
        assert aluno_resp.status_code == 201
        aluno_id = aluno_resp.json["id"]

        create_resp = client.post("/api/v1/ocorrencias", headers=headers, json={
            "aluno_id": aluno_id,
            "tipo": "comportamento",
            "descricao": "Teste de ocorrência",
            "academic_year_id": year_id,
        })
        assert create_resp.status_code == 201

        list_resp = client.get("/api/v1/ocorrencias", headers=headers)
        assert list_resp.status_code == 200
        ids = [o["aluno_id"] for o in list_resp.json.get("items", list_resp.json)]
        assert aluno_id in ids
