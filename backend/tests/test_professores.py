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
    assert turma_3a["max_pts"] == 30

    # Verify 3B details
    turma_3b = [t for t in data if t["turma"] == "3B"][0]
    assert turma_3b["total_alunos"] == 1
    assert turma_3b["turno"] == "Vespertino"
    assert turma_3b["media"] == 90.0
    assert turma_3b["faltas_medias"] == 0.0
    assert turma_3b["max_pts"] == 30

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
    for t in data:
        assert t["max_pts"] == 30

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
        assert {link.turma for link in links} == {"3A", "3B"}

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


def test_teacher_dashboard_scoped_to_linked_classes(client, flask_app):
    with session_scope() as session:
        tenant = Tenant(name="Escola Dashboard Teste", slug="escola-dash-test", is_active=True)
        session.add(tenant)
        session.flush()
        tenant_id = tenant.id

        year = AcademicYear(tenant_id=tenant_id, label="2026", is_current=True)
        session.add(year)
        session.flush()
        year_id = year.id

        professor = Usuario(
            username="prof.dash",
            password_hash="hash",
            role="professor",
            tenant_id=tenant_id,
            must_change_password=False
        )
        session.add(professor)
        session.flush()
        prof_id = professor.id

        # Setup Alunos in multiple classes
        aluno1 = Aluno(nome="Aluno A", matricula="MAT-A01", turma="3A", turno="Matutino", tenant_id=tenant_id, academic_year_id=year_id)
        aluno2 = Aluno(nome="Aluno B", matricula="MAT-A02", turma="3B", turno="Matutino", tenant_id=tenant_id, academic_year_id=year_id)
        aluno3 = Aluno(nome="Aluno C", matricula="MAT-A03", turma="4A", turno="Matutino", tenant_id=tenant_id, academic_year_id=year_id)
        session.add_all([aluno1, aluno2, aluno3])
        session.flush()

        # Add Grades (total)
        nota1 = Nota(aluno_id=aluno1.id, disciplina="Matematica", disciplina_normalizada="MATEMATICA", total=80, tenant_id=tenant_id, academic_year_id=year_id)
        nota2 = Nota(aluno_id=aluno2.id, disciplina="Matematica", disciplina_normalizada="MATEMATICA", total=45, tenant_id=tenant_id, academic_year_id=year_id) # risky (< 60)
        nota3 = Nota(aluno_id=aluno3.id, disciplina="Matematica", disciplina_normalizada="MATEMATICA", total=30, tenant_id=tenant_id, academic_year_id=year_id) # risky, but not in linked class
        session.add_all([nota1, nota2, nota3])
        session.flush()

        # Link Professor to 3A and 3B
        link1 = UsuarioTurma(usuario_id=prof_id, turma="3A", tenant_id=tenant_id, academic_year_id=year_id)
        link2 = UsuarioTurma(usuario_id=prof_id, turma="3B", tenant_id=tenant_id, academic_year_id=year_id)
        session.add_all([link1, link2])
        session.flush()

    headers = _headers_for(flask_app, prof_id, "professor", tenant_id=tenant_id, academic_year_id=year_id)

    # 1. Fetch entire dashboard for the professor
    response = client.get("/api/v1/dashboard/professor", headers=headers)
    assert response.status_code == 200
    data = response.json
    assert data["classes_count"] == 2
    assert data["total_students"] == 2
    assert data["global_average"] == 62.5
    assert len(data["alerts"]) == 1
    assert data["alerts"][0]["nome"] == "Aluno B"

    # 2. Filter by linked class (3A)
    response = client.get("/api/v1/dashboard/professor?turma=3A", headers=headers)
    assert response.status_code == 200
    data = response.json
    assert data["classes_count"] == 1
    assert data["total_students"] == 1
    assert data["global_average"] == 80.0
    assert len(data["alerts"]) == 0

    # 3. Filter by class not linked (4A)
    response = client.get("/api/v1/dashboard/professor?turma=4A", headers=headers)
    assert response.status_code == 200
    data = response.json
    assert data["classes_count"] == 0
    assert data["total_students"] == 0
    assert data["global_average"] == 0.0
    assert len(data["alerts"]) == 0


def test_teacher_dashboard_no_linked_classes(client, flask_app):
    with session_scope() as session:
        tenant = Tenant(name="Escola Dashboard Teste 2", slug="escola-dash-test-2", is_active=True)
        session.add(tenant)
        session.flush()
        tenant_id = tenant.id

        year = AcademicYear(tenant_id=tenant_id, label="2026", is_current=True)
        session.add(year)
        session.flush()
        year_id = year.id

        professor = Usuario(
            username="prof.dash2",
            password_hash="hash",
            role="professor",
            tenant_id=tenant_id,
            must_change_password=False
        )
        session.add(professor)
        session.flush()
        prof_id = professor.id

        aluno1 = Aluno(nome="Aluno A", matricula="MAT-B01", turma="3A", turno="Matutino", tenant_id=tenant_id, academic_year_id=year_id)
        session.add(aluno1)
        session.flush()

    headers = _headers_for(flask_app, prof_id, "professor", tenant_id=tenant_id, academic_year_id=year_id)

    response = client.get("/api/v1/dashboard/professor", headers=headers)
    assert response.status_code == 200
    data = response.json
    assert data["classes_count"] == 0
    assert data["total_students"] == 0
    assert data["global_average"] == 0.0
    assert len(data["alerts"]) == 0
    assert data["distribution"] == {
        "0-20": 0,
        "20-40": 0,
        "40-60": 0,
        "60-80": 0,
        "80-100": 0
    }


def test_list_turmas_endpoint_includes_max_pts(client, flask_app):
    with session_scope() as session:
        tenant = Tenant(name="Escola List Turmas Test", slug="escola-list-turmas", is_active=True)
        session.add(tenant)
        session.flush()
        tenant_id = tenant.id

        year = AcademicYear(tenant_id=tenant_id, label="2026", is_current=True)
        session.add(year)
        session.flush()
        year_id = year.id

        admin = Usuario(
            username="admin.list_turmas",
            password_hash="hash",
            role="admin",
            tenant_id=tenant_id,
            must_change_password=False
        )
        session.add(admin)
        session.flush()
        admin_id = admin.id

        aluno = Aluno(nome="Aluno X", matricula="MAT-X01", turma="8A", turno="Matutino", tenant_id=tenant_id, academic_year_id=year_id)
        session.add(aluno)
        session.flush()

    headers = _headers_for(flask_app, admin_id, "admin", tenant_id=tenant_id, academic_year_id=year_id)
    response = client.get("/api/v1/turmas", headers=headers)
    assert response.status_code == 200
    data = response.json
    assert data["total"] == 1
    assert data["items"][0]["turma"] == "8A"
    assert data["items"][0]["max_pts"] == 30


def test_alunos_endpoints_include_max_pts(client, flask_app):
    with session_scope() as session:
        tenant = Tenant(name="Escola Alunos Max Pts", slug="escola-alunos-max-pts", is_active=True)
        session.add(tenant)
        session.flush()
        tenant_id = tenant.id

        year = AcademicYear(tenant_id=tenant_id, label="2026", is_current=True)
        session.add(year)
        session.flush()
        year_id = year.id

        admin = Usuario(
            username="admin.alunos_max_pts",
            password_hash="hash",
            role="admin",
            tenant_id=tenant_id,
            must_change_password=False
        )
        session.add(admin)
        session.flush()
        admin_id = admin.id

        aluno = Aluno(nome="Aluno Y", matricula="MAT-Y01", turma="8A", turno="Matutino", tenant_id=tenant_id, academic_year_id=year_id)
        session.add(aluno)
        session.flush()
        aluno_id = aluno.id

        nota = Nota(
            aluno_id=aluno_id,
            disciplina="Matemática",
            disciplina_normalizada="matematica",
            trimestre1=10.0,
            total=10.0,
            tenant_id=tenant_id,
            academic_year_id=year_id
        )
        session.add(nota)
        session.flush()

    headers = _headers_for(flask_app, admin_id, "admin", tenant_id=tenant_id, academic_year_id=year_id)

    # Test list endpoint
    response = client.get("/api/v1/alunos", headers=headers)
    assert response.status_code == 200
    data = response.json
    print("DEBUG ALUNOS LIST DATA:", data)
    assert data["meta"]["total"] == 1
    assert data["items"][0]["max_pts"] == 30

    # Test detail endpoint
    response = client.get(f"/api/v1/alunos/{aluno_id}", headers=headers)
    assert response.status_code == 200
    data = response.json
    assert data["max_pts"] == 30
