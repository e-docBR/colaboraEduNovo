import pytest
from app.core.database import session_scope
from app.core.security import generate_tokens
from app.models import Tenant, AcademicYear, Aluno, Usuario, UsuarioTurma, Nota

def _headers_for(flask_app, user_id: int, role: str, *, tenant_id: int = 1, academic_year_id: int = 1):
    with flask_app.app_context():
        tokens = generate_tokens(
            identity=str(user_id),
            roles=[role],
            extra_claims={"tenant_id": tenant_id, "academic_year_id": academic_year_id},
        )
    return {"Authorization": f"Bearer {tokens['access_token']}"}

def test_professores_me_turmas_success(client, flask_app):
    with session_scope() as session:
        # 1. Setup Tenant and Academic Year
        tenant = Tenant(name="Escola Professor Teste", slug="escola-prof", is_active=True)
        session.add(tenant)
        session.flush()
        tenant_id = tenant.id

        year = AcademicYear(tenant_id=tenant_id, label="2026", is_current=True)
        session.add(year)
        session.flush()
        year_id = year.id

        # 2. Setup Professor User
        professor = Usuario(
            username="prof.teste",
            password_hash="hash",
            role="professor",
            tenant_id=tenant_id,
            must_change_password=False
        )
        session.add(professor)
        session.flush()
        prof_id = professor.id

        # 3. Setup Alunos in multiple classes
        aluno1 = Aluno(nome="Aluno A", matricula="MAT-001", turma="3A", turno="Matutino", tenant_id=tenant_id, academic_year_id=year_id)
        aluno2 = Aluno(nome="Aluno B", matricula="MAT-002", turma="3A", turno="Matutino", tenant_id=tenant_id, academic_year_id=year_id)
        aluno3 = Aluno(nome="Aluno C", matricula="MAT-003", turma="3B", turno="Vespertino", tenant_id=tenant_id, academic_year_id=year_id)
        aluno_outra_turma = Aluno(nome="Aluno D", matricula="MAT-004", turma="4A", turno="Matutino", tenant_id=tenant_id, academic_year_id=year_id)
        session.add_all([aluno1, aluno2, aluno3, aluno_outra_turma])
        session.flush()

        # 4. Add Grades (Notas) to calculate averages
        nota1 = Nota(aluno_id=aluno1.id, disciplina="Matematica", disciplina_normalizada="MATEMATICA", total=80, faltas=2, tenant_id=tenant_id, academic_year_id=year_id)
        nota2 = Nota(aluno_id=aluno2.id, disciplina="Matematica", disciplina_normalizada="MATEMATICA", total=60, faltas=4, tenant_id=tenant_id, academic_year_id=year_id)
        nota3 = Nota(aluno_id=aluno3.id, disciplina="Matematica", disciplina_normalizada="MATEMATICA", total=90, faltas=0, tenant_id=tenant_id, academic_year_id=year_id)
        session.add_all([nota1, nota2, nota3])
        session.flush()

        # 5. Link Professor to 3A and 3B (but not 4A)
        link1 = UsuarioTurma(usuario_id=prof_id, turma="3A", tenant_id=tenant_id, academic_year_id=year_id)
        link2 = UsuarioTurma(usuario_id=prof_id, turma="3B", tenant_id=tenant_id, academic_year_id=year_id)
        session.add_all([link1, link2])
        session.flush()

    # Get headers for professor
    headers = _headers_for(flask_app, prof_id, "professor", tenant_id=tenant_id, academic_year_id=year_id)

    response = client.get("/api/v1/professores/me/turmas", headers=headers)
    assert response.status_code == 200
    data = response.json
    assert len(data) == 2

    # Verify 3A details
    turma_3a = [t for t in data if t["turma"] == "3A"][0]
    assert turma_3a["total_alunos"] == 2
    assert turma_3a["turno"] == "Matutino"
    assert turma_3a["media"] == 70.0 # (80+60)/2
    assert turma_3a["faltas_medias"] == 3.0 # (2+4)/2

    # Verify 3B details
    turma_3b = [t for t in data if t["turma"] == "3B"][0]
    assert turma_3b["total_alunos"] == 1
    assert turma_3b["turno"] == "Vespertino"
    assert turma_3b["media"] == 90.0
    assert turma_3b["faltas_medias"] == 0.0

def test_professores_me_turmas_admin_sees_all(client, flask_app):
    with session_scope() as session:
        tenant = Tenant(name="Escola Admin Teste", slug="escola-admin-prof", is_active=True)
        session.add(tenant)
        session.flush()
        tenant_id = tenant.id

        year = AcademicYear(tenant_id=tenant_id, label="2026", is_current=True)
        session.add(year)
        session.flush()
        year_id = year.id

        admin = Usuario(
            username="admin.teste",
            password_hash="hash",
            role="admin",
            tenant_id=tenant_id,
            must_change_password=False
        )
        session.add(admin)
        session.flush()
        admin_id = admin.id

        aluno1 = Aluno(nome="Aluno A", matricula="MAT-101", turma="3A", turno="Matutino", tenant_id=tenant_id, academic_year_id=year_id)
        aluno2 = Aluno(nome="Aluno B", matricula="MAT-102", turma="3B", turno="Matutino", tenant_id=tenant_id, academic_year_id=year_id)
        session.add_all([aluno1, aluno2])
        session.flush()

    headers = _headers_for(flask_app, admin_id, "admin", tenant_id=tenant_id, academic_year_id=year_id)
    response = client.get("/api/v1/professores/me/turmas", headers=headers)
    assert response.status_code == 200
    data = response.json
    # Admins see all classes even if they are not explicitly linked via UsuarioTurma
    assert len(data) == 2
    assert {t["turma"] for t in data} == {"3A", "3B"}

def test_professores_me_turmas_forbidden_for_other_roles(client, flask_app):
    with session_scope() as session:
        tenant = Tenant(name="Escola Aluno Teste", slug="escola-aluno-prof", is_active=True)
        session.add(tenant)
        session.flush()
        tenant_id = tenant.id

        year = AcademicYear(tenant_id=tenant_id, label="2026", is_current=True)
        session.add(year)
        session.flush()
        year_id = year.id

        aluno_user = Usuario(
            username="aluno.teste",
            password_hash="hash",
            role="aluno",
            tenant_id=tenant_id,
            must_change_password=False
        )
        session.add(aluno_user)
        session.flush()
        user_id = aluno_user.id

    headers = _headers_for(flask_app, user_id, "aluno", tenant_id=tenant_id, academic_year_id=year_id)
    response = client.get("/api/v1/professores/me/turmas", headers=headers)
    assert response.status_code == 403

def test_apply_professors_username_and_idempotency(flask_app):
    from app.services.ingestion import apply_professors
    
    with session_scope() as session:
        tenant = Tenant(name="Escola Ingestion Teste", slug="escola-ing-test", is_active=True)
        session.add(tenant)
        session.flush()
        tenant_id = tenant.id

        year = AcademicYear(tenant_id=tenant_id, label="2026", is_current=True)
        session.add(year)
        session.flush()
        year_id = year.id

    # 1. Apply professor for the first class (3A)
    apply_professors(["ALCIANE QUEIROZ CASTRO"], "3A", tenant_id, year_id)

    with session_scope() as session:
        # Check that user was created with first + last name format
        user = session.query(Usuario).filter(Usuario.username == "alcianecastro", Usuario.tenant_id == tenant_id).first()
        assert user is not None
        assert user.role == "professor"
        assert user.must_change_password is True

        # Check that linkage was created
        link = session.query(UsuarioTurma).filter(
            UsuarioTurma.usuario_id == user.id,
            UsuarioTurma.turma == "3A",
            UsuarioTurma.tenant_id == tenant_id,
            UsuarioTurma.academic_year_id == year_id
        ).first()
        assert link is not None

    # 2. Apply again for a second class (3B) - should NOT duplicate the user, only add the class linkage
    apply_professors(["ALCIANE QUEIROZ CASTRO"], "3B", tenant_id, year_id)

    with session_scope() as session:
        # Check that only one user exists
        users = session.query(Usuario).filter(Usuario.username == "alcianecastro", Usuario.tenant_id == tenant_id).all()
        assert len(users) == 1
        user = users[0]

        # Check both linkages exist
        links = session.query(UsuarioTurma).filter(
            UsuarioTurma.usuario_id == user.id,
            UsuarioTurma.tenant_id == tenant_id,
            UsuarioTurma.academic_year_id == year_id
        ).all()
        assert len(links) == 2
        assert {l.turma for l in links} == {"3A", "3B"}

def test_rename_turma_updates_professors(client, flask_app):
    with session_scope() as session:
        tenant = Tenant(name="Escola Ingestion Teste 2", slug="escola-ing-test-2", is_active=True)
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

        aluno = Aluno(
            nome="Aluno A",
            matricula="MAT-X",
            turma="3A",
            turno="Matutino",
            tenant_id=tenant_id,
            academic_year_id=year_id
        )
        session.add(aluno)
        session.flush()

        admin = Usuario(
            username="admin.teste2",
            password_hash="hash",
            role="admin",
            tenant_id=tenant_id,
            must_change_password=False
        )
        session.add(admin)
        session.flush()
        admin_id = admin.id

    # 1. Update class 3A to link professor
    admin_headers = _headers_for(flask_app, admin_id, "admin", tenant_id=tenant_id, academic_year_id=year_id)
    response = client.patch(
        "/api/v1/turmas/3a",
        headers=admin_headers,
        json={"nome": "3A", "turno": "Matutino", "professor_ids": [prof_id]}
    )
    assert response.status_code == 200

    with session_scope() as session:
        # Link should exist
        link = session.query(UsuarioTurma).filter(
            UsuarioTurma.usuario_id == prof_id,
            UsuarioTurma.turma == "3A",
            UsuarioTurma.tenant_id == tenant_id,
            UsuarioTurma.academic_year_id == year_id
        ).first()
        assert link is not None

    # 2. Update class 3A to remove all professors
    response = client.patch(
        "/api/v1/turmas/3a",
        headers=admin_headers,
        json={"nome": "3A", "turno": "Matutino", "professor_ids": []}
    )
    assert response.status_code == 200

    with session_scope() as session:
        # Link should be removed
        link = session.query(UsuarioTurma).filter(
            UsuarioTurma.usuario_id == prof_id,
            UsuarioTurma.turma == "3A",
            UsuarioTurma.tenant_id == tenant_id,
            UsuarioTurma.academic_year_id == year_id
        ).first()
        assert link is None
