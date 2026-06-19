import re

import pytest

from app.core.security import verify_password
from app.models import AcademicYear, Aluno, Tenant, Usuario
from app.services.access_notice_service import AccessNoticeService


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
