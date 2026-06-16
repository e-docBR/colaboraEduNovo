from app.models import Aluno, Nota, Ocorrencia, Usuario, Tenant, AcademicYear
from app.core.database import session_scope
from app.core.security import generate_tokens

def _headers_for(flask_app, user_id: int, role: str, tenant_id: int, academic_year_id: int, matricula: str = None, aluno_id: int = None):
    with flask_app.app_context():
        extra_claims = {
            "tenant_id": tenant_id,
            "academic_year_id": academic_year_id
        }
        if matricula:
            extra_claims["matricula"] = matricula
        if aluno_id:
            extra_claims["aluno_id"] = aluno_id
        
        tokens = generate_tokens(
            identity=str(user_id), 
            roles=[role], 
            extra_claims=extra_claims
        )
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def test_lgpd_export_endpoint(flask_app):
    # Setup test tenant and academic year using session_scope
    with session_scope() as session:
        tenant = Tenant(name="LGPD School", slug="lgpd-school", is_active=True, plano_ativo=True)
        session.add(tenant)
        session.flush()

        year = AcademicYear(tenant_id=tenant.id, label="2026", is_current=True)
        session.add(year)
        session.flush()

        # Seed student, nota, ocorrencia
        aluno = Aluno(
            matricula="12345",
            nome="Estudante de Teste",
            turma="1º A",
            turno="Matutino",
            tenant_id=tenant.id,
            academic_year_id=year.id,
            cpf="12345678900",
            email="aluno@teste.com"
        )
        session.add(aluno)
        session.flush()

        # Seed users to satisfy foreign key constraints in audit_logs
        unauth_user = Usuario(
            username="unauth_student",
            password_hash="dummy_hash",
            role="aluno",
            tenant_id=tenant.id
        )
        session.add(unauth_user)

        student_user = Usuario(
            username="student_self",
            password_hash="dummy_hash",
            role="aluno",
            aluno_id=aluno.id,
            tenant_id=tenant.id
        )
        session.add(student_user)

        admin_user = Usuario(
            username="admin_lgpd",
            password_hash="dummy_hash",
            role="admin",
            tenant_id=tenant.id
        )
        session.add(admin_user)
        session.flush()

        nota = Nota(
            aluno_id=aluno.id,
            disciplina="Matemática",
            disciplina_normalizada="matematica",
            trimestre1=9.5,
            total=9.5,
            tenant_id=tenant.id,
            academic_year_id=year.id
        )
        session.add(nota)

        ocorrencia = Ocorrencia(
            aluno_id=aluno.id,
            tipo="ELOGIO",
            descricao="Participação impecável nas aulas",
            gravidade="LEVE",
            tenant_id=tenant.id,
            academic_year_id=year.id
        )
        session.add(ocorrencia)
        session.commit()
        
        # Capture IDs to use outside of the session
        aluno_id = aluno.id
        tenant_id = tenant.id
        year_id = year.id
        unauth_user_id = unauth_user.id
        student_user_id = student_user.id
        admin_user_id = admin_user.id

    client = flask_app.test_client()

    # Test as unauthorized user
    response = client.get(
        f"/api/v1/alunos/{aluno_id}/export-lgpd",
        headers=_headers_for(flask_app, unauth_user_id, "aluno", tenant_id, year_id, matricula="9999")
    )
    assert response.status_code == 403

    # Test as the student themselves
    response = client.get(
        f"/api/v1/alunos/{aluno_id}/export-lgpd",
        headers=_headers_for(flask_app, student_user_id, "aluno", tenant_id, year_id, matricula="12345")
    )
    assert response.status_code == 200
    data = response.json
    assert data["document_type"] == "LGPD_PORTABILITY_EXPORT"
    assert data["aluno"]["nome"] == "Estudante de Teste"
    assert data["aluno"]["cpf"] == "12345678900"
    assert len(data["notas"]) == 1
    assert data["notas"][0]["disciplina"] == "Matemática"
    assert len(data["ocorrencias"]) == 1
    assert data["ocorrencias"][0]["tipo"] == "ELOGIO"

    # Test as admin
    response = client.get(
        f"/api/v1/alunos/{aluno_id}/export-lgpd",
        headers=_headers_for(flask_app, admin_user_id, "admin", tenant_id, year_id)
    )
    assert response.status_code == 200


def test_lgpd_purge_endpoint(flask_app):
    # Setup test tenant and academic year using session_scope
    with session_scope() as session:
        tenant = Tenant(name="Purge School", slug="purge-school", is_active=True, plano_ativo=True)
        session.add(tenant)
        session.flush()

        year = AcademicYear(tenant_id=tenant.id, label="2026", is_current=True)
        session.add(year)
        session.flush()

        # Seed student, user, nota, ocorrencia
        aluno = Aluno(
            matricula="54321",
            nome="Estudante Purga",
            turma="1º A",
            turno="Matutino",
            tenant_id=tenant.id,
            academic_year_id=year.id
        )
        session.add(aluno)
        session.flush()

        usuario = Usuario(
            username="aluno_purge",
            password_hash="dummy_hash",
            role="aluno",
            aluno_id=aluno.id,
            tenant_id=tenant.id
        )
        session.add(usuario)

        # Seed staff and admin users for testing access control and foreign key constraints
        prof_user = Usuario(
            username="prof_purger",
            password_hash="dummy_hash",
            role="professor",
            tenant_id=tenant.id
        )
        session.add(prof_user)

        admin_user = Usuario(
            username="admin_purger",
            password_hash="dummy_hash",
            role="admin",
            tenant_id=tenant.id
        )
        session.add(admin_user)
        session.flush()

        nota = Nota(
            aluno_id=aluno.id,
            disciplina="História",
            disciplina_normalizada="historia",
            tenant_id=tenant.id,
            academic_year_id=year.id
        )
        session.add(nota)

        ocorrencia = Ocorrencia(
            aluno_id=aluno.id,
            tipo="ATRASO",
            descricao="Chegou atrasado na primeira aula",
            tenant_id=tenant.id,
            academic_year_id=year.id
        )
        session.add(ocorrencia)
        session.commit()
        
        # Capture IDs to use outside of the session
        aluno_id = aluno.id
        tenant_id = tenant.id
        year_id = year.id
        prof_user_id = prof_user.id
        admin_user_id = admin_user.id

    client = flask_app.test_client()

    # Reject non-admin
    response = client.delete(
        f"/api/v1/alunos/{aluno_id}/purge-lgpd",
        headers=_headers_for(flask_app, prof_user_id, "professor", tenant_id, year_id)
    )
    assert response.status_code == 403

    # Accept admin / super_admin
    response = client.delete(
        f"/api/v1/alunos/{aluno_id}/purge-lgpd",
        headers=_headers_for(flask_app, admin_user_id, "admin", tenant_id, year_id)
    )
    assert response.status_code == 204

    # Verify everything has been purged from the db (using fresh query)
    with session_scope() as session:
        db_aluno = session.get(Aluno, aluno_id)
        assert db_aluno is None

        db_usuario = session.query(Usuario).filter(Usuario.aluno_id == aluno_id).first()
        assert db_usuario is None

        db_nota = session.query(Nota).filter(Nota.aluno_id == aluno_id).first()
        assert db_nota is None

        db_ocorrencia = session.query(Ocorrencia).filter(Ocorrencia.aluno_id == aluno_id).first()
        assert db_ocorrencia is None
