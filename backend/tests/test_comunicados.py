from app.core.database import session_scope
from app.core.security import generate_tokens
from app.models import Tenant, AcademicYear, Usuario, UsuarioTurma, Comunicado

def _headers_for(flask_app, user_id: int, role: str, *, tenant_id: int = 1, academic_year_id: int = 1):
    with flask_app.app_context():
        tokens = generate_tokens(
            identity=str(user_id),
            roles=[role],
            extra_claims={"tenant_id": tenant_id, "academic_year_id": academic_year_id},
        )
    return {"Authorization": f"Bearer {tokens['access_token']}"}

def test_professor_create_comunicado_linked_class_success(client, flask_app):
    with session_scope() as session:
        tenant = Tenant(name="Escola Teste 1", slug="escola-test-1", is_active=True)
        session.add(tenant)
        session.flush()
        tenant_id = tenant.id

        year = AcademicYear(tenant_id=tenant_id, label="2026", is_current=True)
        session.add(year)
        session.flush()
        year_id = year.id

        professor = Usuario(
            username="prof.teste1",
            password_hash="hash",
            role="professor",
            tenant_id=tenant_id,
            must_change_password=False
        )
        session.add(professor)
        session.flush()
        prof_id = professor.id

        # Link professor to class 3A
        link = UsuarioTurma(usuario_id=prof_id, turma="3A", tenant_id=tenant_id, academic_year_id=year_id)
        session.add(link)
        session.flush()

    headers = _headers_for(flask_app, prof_id, "professor", tenant_id=tenant_id, academic_year_id=year_id)
    payload = {
        "titulo": "Aviso da Turma 3A",
        "conteudo": "Reunião especial.",
        "target_type": "TURMA",
        "target_value": "3A",
        "notificar_responsaveis": False
    }
    response = client.post("/api/v1/comunicados", json=payload, headers=headers)
    assert response.status_code == 201
    assert response.json["id"] is not None

def test_professor_create_comunicado_unlinked_class_forbidden(client, flask_app):
    with session_scope() as session:
        tenant = Tenant(name="Escola Teste 2", slug="escola-test-2", is_active=True)
        session.add(tenant)
        session.flush()
        tenant_id = tenant.id

        year = AcademicYear(tenant_id=tenant_id, label="2026", is_current=True)
        session.add(year)
        session.flush()
        year_id = year.id

        professor = Usuario(
            username="prof.teste2",
            password_hash="hash",
            role="professor",
            tenant_id=tenant_id,
            must_change_password=False
        )
        session.add(professor)
        session.flush()
        prof_id = professor.id

        # No links created for this professor

    headers = _headers_for(flask_app, prof_id, "professor", tenant_id=tenant_id, academic_year_id=year_id)
    payload = {
        "titulo": "Aviso da Turma 3B",
        "conteudo": "Reunião de pais.",
        "target_type": "TURMA",
        "target_value": "3B",
        "notificar_responsaveis": False
    }
    response = client.post("/api/v1/comunicados", json=payload, headers=headers)
    assert response.status_code == 403
    assert "Você não tem permissão para enviar comunicados para esta turma" in response.json["error"]

def test_professor_create_comunicado_invalid_target_forbidden(client, flask_app):
    with session_scope() as session:
        tenant = Tenant(name="Escola Teste 3", slug="escola-test-3", is_active=True)
        session.add(tenant)
        session.flush()
        tenant_id = tenant.id

        year = AcademicYear(tenant_id=tenant_id, label="2026", is_current=True)
        session.add(year)
        session.flush()
        year_id = year.id

        professor = Usuario(
            username="prof.teste3",
            password_hash="hash",
            role="professor",
            tenant_id=tenant_id,
            must_change_password=False
        )
        session.add(professor)
        session.flush()
        prof_id = professor.id

    headers = _headers_for(flask_app, prof_id, "professor", tenant_id=tenant_id, academic_year_id=year_id)

    # Attempt to send to TODOS
    payload = {
        "titulo": "Geral",
        "conteudo": "Olá escola.",
        "target_type": "TODOS",
        "notificar_responsaveis": False
    }
    response = client.post("/api/v1/comunicados", json=payload, headers=headers)
    assert response.status_code == 403
    assert "Professores só podem enviar comunicados para turmas" in response.json["error"]

    # Attempt with email notifications = True
    payload = {
        "titulo": "E-mail",
        "conteudo": "Envio com e-mail.",
        "target_type": "TURMA",
        "target_value": "3A",
        "notificar_responsaveis": True
    }
    response = client.post("/api/v1/comunicados", json=payload, headers=headers)
    assert response.status_code == 403
    assert "Professores não têm permissão para enviar e-mails aos responsáveis" in response.json["error"]

def test_professor_edit_delete_and_receipts_permissions(client, flask_app):
    with session_scope() as session:
        tenant = Tenant(name="Escola Teste 4", slug="escola-test-4", is_active=True)
        session.add(tenant)
        session.flush()
        tenant_id = tenant.id

        year = AcademicYear(tenant_id=tenant_id, label="2026", is_current=True)
        session.add(year)
        session.flush()
        year_id = year.id

        professor = Usuario(
            username="prof.teste4",
            password_hash="hash",
            role="professor",
            tenant_id=tenant_id,
            must_change_password=False
        )
        other_prof = Usuario(
            username="prof.outro4",
            password_hash="hash",
            role="professor",
            tenant_id=tenant_id,
            must_change_password=False
        )
        session.add_all([professor, other_prof])
        session.flush()
        prof_id = professor.id
        other_prof_id = other_prof.id

        # Create comunicado owned by prof.teste
        comm1 = Comunicado(
            titulo="Original",
            conteudo="Test",
            autor_id=prof_id,
            target_type="TURMA",
            target_value="3A",
            tenant_id=tenant_id,
            academic_year_id=year_id
        )
        # Create comunicado owned by other_prof
        comm2 = Comunicado(
            titulo="Outro",
            conteudo="Test",
            autor_id=other_prof_id,
            target_type="TURMA",
            target_value="3A",
            tenant_id=tenant_id,
            academic_year_id=year_id
        )
        session.add_all([comm1, comm2])
        session.flush()
        comm1_id = comm1.id
        comm2_id = comm2.id

    # Headers for professor (prof.teste)
    headers = _headers_for(flask_app, prof_id, "professor", tenant_id=tenant_id, academic_year_id=year_id)

    # 1. Edit own comunicado -> Success
    response = client.patch(f"/api/v1/comunicados/{comm1_id}", json={"titulo": "Novo Titulo"}, headers=headers)
    assert response.status_code == 200

    # 2. Edit other's comunicado -> Forbidden
    response = client.patch(f"/api/v1/comunicados/{comm2_id}", json={"titulo": "Bypass"}, headers=headers)
    assert response.status_code == 403

    # 3. View own comunicado receipts -> Success
    response = client.get(f"/api/v1/comunicados/{comm1_id}/leituras", headers=headers)
    assert response.status_code == 200

    # 4. View other's comunicado receipts -> Forbidden
    response = client.get(f"/api/v1/comunicados/{comm2_id}/leituras", headers=headers)
    assert response.status_code == 403
    assert "Você não tem permissão para visualizar as leituras deste comunicado" in response.json["error"]

    # 5. Delete other's comunicado -> Forbidden
    response = client.delete(f"/api/v1/comunicados/{comm2_id}", headers=headers)
    assert response.status_code == 403

    # 6. Delete own comunicado -> Success
    response = client.delete(f"/api/v1/comunicados/{comm1_id}", headers=headers)
    assert response.status_code == 200
