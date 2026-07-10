import re

import pytest

from app.core.security import verify_password
from app.models import AcademicYear, Aluno, Tenant, Usuario
from app.services.access_notice_service import AccessNoticeService


def test_temporary_password_is_simple_to_type(session):
    password = AccessNoticeService(session)._temporary_password()

    assert len(password) == 8
    assert re.fullmatch(r"[a-z2-9]+", password)
    assert not set(password) & set("ilo01")


def test_access_notice_generation_resets_guardian_passwords(session):
    docx = pytest.importorskip("docx")

    tenant = Tenant(name="Colégio Frei Ronaldo", slug="frei-notices", is_active=True)
    session.add(tenant)
    session.flush()
    year = AcademicYear(tenant_id=tenant.id, label="2026", is_current=True)
    session.add(year)
    session.flush()

    alunos = [
        Aluno(
            matricula="57411",
            nome="ABNER COSTA ROCHA CRUZ",
            turma="6/7 I",
            turno="Noturno",
            tenant_id=tenant.id,
            academic_year_id=year.id,
        ),
        Aluno(
            matricula="57412",
            nome="ALUNA TESTE",
            turma="6/7 I",
            turno="Noturno",
            tenant_id=tenant.id,
            academic_year_id=year.id,
        ),
        Aluno(
            matricula="57413",
            nome="ALUNO TERCEIRO",
            turma="6/7 I",
            turno="Noturno",
            tenant_id=tenant.id,
            academic_year_id=year.id,
        ),
    ]
    session.add_all(alunos)
    session.flush()

    existing = Usuario(
        username="resp_57411",
        password_hash="old-hash",
        role="responsavel",
        aluno_id=alunos[0].id,
        matricula=alunos[0].matricula,
        tenant_id=tenant.id,
        must_change_password=False,
        is_active=False,
    )
    session.add(existing)
    session.flush()

    result = AccessNoticeService(session).generate_class_docx(
        tenant_id=tenant.id,
        academic_year_id=year.id,
        turma="6/7 I",
        school_name=tenant.name,
    )
    session.flush()

    assert result.row_count == 3
    assert result.filename == "comunicados_acesso_6_7_I.docx"

    document = docx.Document(result.buffer)
    full_text = "\n".join(paragraph.text for paragraph in document.paragraphs)
    assert "Comunicado de Acesso ao ColaboraEdu" in full_text
    assert "ABNER COSTA ROCHA CRUZ" in full_text
    assert "ALUNA TESTE" in full_text
    assert "ALUNO TERCEIRO" in full_text
    assert "Usuário: resp_57411" in full_text
    assert "Usuário: resp_57412" in full_text
    assert "Usuário: resp_57413" in full_text

    passwords = dict(re.findall(r"Usuário: (resp_\d+)\s+Senha temporária: ([A-Za-z0-9]+)", full_text))
    assert set(passwords) == {"resp_57411", "resp_57412", "resp_57413"}

    users = {
        user.username: user
        for user in session.query(Usuario)
        .filter(Usuario.tenant_id == tenant.id, Usuario.role == "responsavel")
        .all()
    }
    assert users["resp_57411"].must_change_password is True
    assert users["resp_57411"].is_active is True
    assert verify_password(passwords["resp_57411"], users["resp_57411"].password_hash)
    assert users["resp_57412"].must_change_password is True
    assert verify_password(passwords["resp_57412"], users["resp_57412"].password_hash)
    assert users["resp_57413"].must_change_password is True
    assert verify_password(passwords["resp_57413"], users["resp_57413"].password_hash)

    page_breaks = [
        element
        for paragraph in document.paragraphs
        for element in paragraph._p
        if (
            (element.tag.endswith("}r") and "lastRenderedPageBreak" in element.xml)
            or "w:type=\"page\"" in element.xml
        )
    ]
    assert page_breaks


def test_access_notice_generation_resets_student_passwords_and_includes_qrcode(session):
    docx = pytest.importorskip("docx")

    tenant = Tenant(name="Colégio Frei Ronaldo", slug="frei-student-notices", is_active=True)
    session.add(tenant)
    session.flush()
    year = AcademicYear(tenant_id=tenant.id, label="2026", is_current=True)
    session.add(year)
    session.flush()

    alunos = [
        Aluno(
            matricula="57499",
            nome="ALISSON RICARDO ARAUJO",
            turma="6/7 I",
            turno="Noturno",
            tenant_id=tenant.id,
            academic_year_id=year.id,
        ),
        Aluno(
            matricula="57500",
            nome="BERNARDO SILVA",
            turma="6/7 I",
            turno="Noturno",
            tenant_id=tenant.id,
            academic_year_id=year.id,
        )
    ]
    session.add_all(alunos)
    session.flush()

    result = AccessNoticeService(session).generate_class_docx(
        tenant_id=tenant.id,
        academic_year_id=year.id,
        turma="6/7 I",
        school_name=tenant.name,
        tipo="aluno",
    )
    session.flush()

    assert result.row_count == 2
    assert result.filename == "comunicados_aluno_6_7_I.docx"

    document = docx.Document(result.buffer)
    
    # Verify paragraphs text
    full_text = "\n".join(paragraph.text for paragraph in document.paragraphs)
    assert "Comunicado de Acesso do Aluno ao ColaboraEdu" in full_text
    assert "Querido(a) aluno(a)," in full_text
    assert "ALISSON RICARDO ARAUJO" in full_text
    assert "Matrícula: 57499" in full_text
    assert "BERNARDO SILVA" in full_text
    assert "Matrícula: 57500" in full_text
    
    # Verify QR Code/table layout when the optional qrcode dependency is available.
    if document.tables:
        assert len(document.tables) == 2
        table = document.tables[0]
        assert len(table.rows) == 1
        assert len(table.columns) == 2
    
    # Verify student username is created properly
    student_user = session.query(Usuario).filter(Usuario.aluno_id == alunos[0].id, Usuario.role == "aluno").first()
    assert student_user is not None
    assert student_user.username == "alisson57499"
    assert student_user.must_change_password is True




def test_access_notice_generation_preserves_existing_temporary_password(session):
    docx = pytest.importorskip("docx")

    tenant = Tenant(name="Colégio Frei Ronaldo", slug="frei-preserve-notices", is_active=True)
    session.add(tenant)
    session.flush()
    year = AcademicYear(tenant_id=tenant.id, label="2026", is_current=True)
    session.add(year)
    session.flush()

    aluno = Aluno(
        matricula="60692",
        nome="DIMITRY TESTE",
        turma="7º D",
        turno="Vespertino",
        tenant_id=tenant.id,
        academic_year_id=year.id,
    )
    session.add(aluno)
    session.flush()

    original_password = "eF1DEYNOlw"
    existing = Usuario(
        username="dimitry60692",
        password_hash="",
        role="aluno",
        aluno_id=aluno.id,
        matricula=aluno.matricula,
        tenant_id=tenant.id,
        must_change_password=True,
        is_active=True,
        is_archived=False,
    )
    from app.core.security import hash_password
    existing.password_hash = hash_password(original_password)
    session.add(existing)
    session.flush()

    result = AccessNoticeService(session).generate_class_docx(
        tenant_id=tenant.id,
        academic_year_id=year.id,
        turma="7º D",
        school_name=tenant.name,
        tipo="aluno",
    )
    session.flush()

    assert result.row_count == 1
    assert verify_password(original_password, existing.password_hash)

    document = docx.Document(result.buffer)
    document_text = "\n".join(paragraph.text for paragraph in document.paragraphs)
    table_text = "\n".join(
        paragraph.text
        for table in document.tables
        for row in table.rows
        for cell in row.cells
        for paragraph in cell.paragraphs
    )
    full_text = f"{document_text}\n{table_text}"
    assert "Usuário: dimitry60692" in full_text
    assert "Senha temporária: já emitida anteriormente" in full_text


def test_access_notice_generation_replaces_default_matricula_password(session):
    docx = pytest.importorskip("docx")

    tenant = Tenant(name="Colégio Frei Ronaldo", slug="frei-default-password-notices", is_active=True)
    session.add(tenant)
    session.flush()
    year = AcademicYear(tenant_id=tenant.id, label="2026", is_current=True)
    session.add(year)
    session.flush()

    aluno = Aluno(
        matricula="60692",
        nome="DIMITRY TESTE",
        turma="7º D",
        turno="Vespertino",
        tenant_id=tenant.id,
        academic_year_id=year.id,
    )
    session.add(aluno)
    session.flush()

    from app.core.security import hash_password
    existing = Usuario(
        username="dimitry60692",
        password_hash=hash_password(aluno.matricula),
        role="aluno",
        aluno_id=aluno.id,
        matricula=aluno.matricula,
        tenant_id=tenant.id,
        must_change_password=True,
        is_active=True,
        is_archived=False,
    )
    session.add(existing)
    session.flush()

    result = AccessNoticeService(session).generate_class_docx(
        tenant_id=tenant.id,
        academic_year_id=year.id,
        turma="7º D",
        school_name=tenant.name,
        tipo="aluno",
    )
    session.flush()

    document = docx.Document(result.buffer)
    document_text = "\n".join(paragraph.text for paragraph in document.paragraphs)
    table_text = "\n".join(
        paragraph.text
        for table in document.tables
        for row in table.rows
        for cell in row.cells
        for paragraph in cell.paragraphs
    )
    full_text = f"{document_text}\n{table_text}"
    passwords = dict(re.findall(r"Usuário: (dimitry60692)\s+Senha temporária: ([A-Za-z0-9]+)", full_text))

    assert passwords["dimitry60692"] != aluno.matricula
    assert verify_password(passwords["dimitry60692"], existing.password_hash)
