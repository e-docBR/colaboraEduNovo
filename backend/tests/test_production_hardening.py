"""Regression tests for production hardening fixes."""
import io
from decimal import Decimal

from app.core.database import session_scope
from app.core.security import generate_tokens, hash_password
from app.models import AcademicYear, Aluno, AuditLog, Comunicado, Nota, Tenant, Usuario
from app.schemas.aluno import AlunoCreate, AlunoUpdate


def _tenant_and_year() -> tuple[int, int]:
    with session_scope() as session:
        tenant = session.query(Tenant).filter(Tenant.slug == "default").first()
        if not tenant:
            tenant = Tenant(name="Escola Teste", slug="default", is_active=True)
            session.add(tenant)
            session.flush()

        year = session.query(AcademicYear).filter(
            AcademicYear.tenant_id == tenant.id,
            AcademicYear.is_current.is_(True),
        ).first()
        if not year:
            year = AcademicYear(tenant_id=tenant.id, label="2026", is_current=True)
            session.add(year)
            session.flush()

        return tenant.id, year.id


def test_aluno_create_normalizes_and_validates_contact_fields():
    payload = AlunoCreate(
        matricula="  HARD-001 ",
        nome=" Aluna Valida ",
        turma=" 6A ",
        turno=" Matutino ",
        cpf="123.456.789-01",
        email="aluna@example.com",
        telefone_responsavel="(11) 99999-9999",
    )

    assert payload.matricula == "HARD-001"
    assert payload.cpf == "12345678901"


def test_aluno_update_rejects_blank_required_fields():
    try:
        AlunoUpdate(nome="   ")
    except Exception as exc:
        assert "Campo não pode ficar vazio" in str(exc)
    else:  # pragma: no cover - defensive assertion
        raise AssertionError("blank nome should fail validation")


def test_aluno_create_rejects_invalid_email():
    try:
        AlunoCreate(
            matricula="HARD-002",
            nome="Aluno Email",
            turma="6A",
            turno="Matutino",
            email="email-invalido",
        )
    except Exception as exc:
        assert "E-mail inválido" in str(exc)
    else:  # pragma: no cover - defensive assertion
        raise AssertionError("invalid email should fail validation")


def test_update_nota_rejects_out_of_range_values(client, auth_headers):
    tenant_id, year_id = _tenant_and_year()

    with session_scope() as session:
        aluno = Aluno(
            matricula="NOTA-HARD-001",
            nome="Aluno Nota Hardening",
            turma="7A",
            turno="Matutino",
            tenant_id=tenant_id,
            academic_year_id=year_id,
        )
        session.add(aluno)
        session.flush()
        nota = Nota(
            aluno_id=aluno.id,
            disciplina="Matemática",
            disciplina_normalizada="matematica",
            trimestre1=Decimal("10.0"),
            tenant_id=tenant_id,
            academic_year_id=year_id,
        )
        session.add(nota)
        session.flush()
        nota_id = nota.id

    response = client.patch(
        f"/api/v1/notas/{nota_id}",
        headers=auth_headers,
        json={"trimestre1": 31},
    )

    assert response.status_code == 400
    assert "entre 0 e 30" in response.json["error"]


def test_update_nota_rejects_invalid_situacao(client, auth_headers):
    tenant_id, year_id = _tenant_and_year()

    with session_scope() as session:
        aluno = Aluno(
            matricula="NOTA-HARD-002",
            nome="Aluno Situacao Hardening",
            turma="7A",
            turno="Matutino",
            tenant_id=tenant_id,
            academic_year_id=year_id,
        )
        session.add(aluno)
        session.flush()
        nota = Nota(
            aluno_id=aluno.id,
            disciplina="Português",
            disciplina_normalizada="portugues",
            tenant_id=tenant_id,
            academic_year_id=year_id,
        )
        session.add(nota)
        session.flush()
        nota_id = nota.id

    response = client.patch(
        f"/api/v1/notas/{nota_id}",
        headers=auth_headers,
        json={"situacao": "INVALIDA"},
    )

    assert response.status_code == 400
    assert "situacao" in response.json["error"]


def test_comunicado_read_requires_recipient(client, flask_app):
    tenant_id, year_id = _tenant_and_year()

    with session_scope() as session:
        aluno_target = Aluno(
            matricula="COM-HARD-001",
            nome="Aluna Destinataria",
            turma="8A",
            turno="Matutino",
            tenant_id=tenant_id,
            academic_year_id=year_id,
        )
        aluno_other = Aluno(
            matricula="COM-HARD-002",
            nome="Aluno Outra Turma",
            turma="8B",
            turno="Matutino",
            tenant_id=tenant_id,
            academic_year_id=year_id,
        )
        session.add_all([aluno_target, aluno_other])
        session.flush()
        user = Usuario(
            username="aluno-hardening",
            password_hash=hash_password("SenhaForte1!"),
            role="aluno",
            tenant_id=tenant_id,
            aluno_id=aluno_other.id,
        )
        session.add(user)

        comunicado = Comunicado(
            titulo="Comunicado restrito",
            conteudo="Somente para uma aluna",
            target_type="ALUNO",
            target_value=str(aluno_target.id),
            tenant_id=tenant_id,
            academic_year_id=year_id,
        )
        session.add(comunicado)
        session.flush()
        comunicado_id = comunicado.id
        user_id = user.id
        other_aluno_id = aluno_other.id

    with flask_app.app_context():
        tokens = generate_tokens(
            identity=str(user_id),
            roles=["aluno"],
            extra_claims={
                "tenant_id": tenant_id,
                "academic_year_id": year_id,
                "aluno_id": other_aluno_id,
            },
        )

    response = client.post(
        f"/api/v1/comunicados/{comunicado_id}/read",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )

    assert response.status_code == 404


def test_export_alunos_escapes_spreadsheet_formulas(client, auth_headers):
    tenant_id, year_id = _tenant_and_year()

    with session_scope() as session:
        aluno = Aluno(
            matricula="=CMD|' /C calc'!A0-PROD",
            nome="@ALUNO-RISCO-PROD",
            turma="9A",
            turno="Matutino",
            tenant_id=tenant_id,
            academic_year_id=year_id,
        )
        session.add(aluno)

    response = client.get("/api/v1/exports/alunos?format=csv", headers=auth_headers)

    assert response.status_code == 200
    body = response.data.decode("utf-8-sig")
    assert "'=CMD|' /C calc'!A0-PROD" in body
    assert "'@ALUNO-RISCO-PROD" in body


def test_upload_pdf_randomizes_stored_filename(client, auth_headers, monkeypatch):
    monkeypatch.setattr("app.api.v1.uploads.enqueue_pdf", lambda *args, **kwargs: "job-test-123")
    pdf_bytes = b"%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF"

    response = client.post(
        "/api/v1/uploads/pdf",
        headers=auth_headers,
        data={
            "turno": "Matutino",
            "turma": "1A",
            "file": (io.BytesIO(pdf_bytes), "boletim.pdf", "application/pdf"),
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 202
    assert response.json["filename"].endswith("_boletim.pdf")
    assert response.json["filename"] != "boletim.pdf"


def test_bulletin_download_sanitizes_filename(client, auth_headers):
    tenant_id, year_id = _tenant_and_year()

    with session_scope() as session:
        aluno = Aluno(
            matricula="BOL-SEC-001-PROD",
            nome="Aluno ../../Boletim ? Final",
            turma="8A",
            turno="Matutino",
            tenant_id=tenant_id,
            academic_year_id=year_id,
        )
        session.add(aluno)
        session.flush()
        aluno_id = aluno.id

    response = client.get(f"/api/v1/alunos/{aluno_id}/boletim/pdf", headers=auth_headers)

    assert response.status_code == 200
    disposition = response.headers["Content-Disposition"]
    assert ".." not in disposition
    assert "/" not in disposition
    assert response.headers["Cache-Control"] == "no-store, no-cache, private"
    assert response.headers["Pragma"] == "no-cache"
    assert response.headers["X-Content-Type-Options"] == "nosniff"


def test_export_alunos_logs_audit_and_sets_download_headers(client, auth_headers):
    tenant_id, year_id = _tenant_and_year()

    with session_scope() as session:
        session.add(
            Aluno(
                matricula="EXPORT-AUDIT-001",
                nome="Aluno Exportacao",
                turma="1A",
                turno="Matutino",
                tenant_id=tenant_id,
                academic_year_id=year_id,
            )
        )

    response = client.get("/api/v1/exports/alunos?format=csv&turma=1A", headers=auth_headers)

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store, no-cache, private"
    assert response.headers["Pragma"] == "no-cache"
    assert response.headers["X-Content-Type-Options"] == "nosniff"

    with session_scope() as session:
        audit_log = (
            session.query(AuditLog)
            .filter(AuditLog.action == "EXPORT_ALUNOS")
            .order_by(AuditLog.id.desc())
            .first()
        )

        assert audit_log is not None
        assert audit_log.target_type == "Aluno"
        assert audit_log.details["format"] == "csv"
        assert audit_log.details["row_count"] >= 1
        assert audit_log.details["filters"]["turma"] == "1A"


def test_relatorio_export_logs_audit_and_sets_download_headers(client, auth_headers):
    tenant_id, year_id = _tenant_and_year()

    with session_scope() as session:
        aluno = Aluno(
            matricula="REL-AUDIT-001",
            nome="Aluno Relatorio",
            turma="2A",
            turno="Matutino",
            tenant_id=tenant_id,
            academic_year_id=year_id,
        )
        session.add(aluno)
        session.flush()
        session.add(
            Nota(
                aluno_id=aluno.id,
                disciplina="Matemática",
                disciplina_normalizada="matematica",
                total=Decimal("8.5"),
                tenant_id=tenant_id,
                academic_year_id=year_id,
            )
        )

    response = client.get("/api/v1/relatorios/melhores-alunos?format=csv", headers=auth_headers)

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store, no-cache, private"
    assert response.headers["Pragma"] == "no-cache"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert "attachment; filename=" in response.headers["Content-Disposition"]

    with session_scope() as session:
        audit_log = (
            session.query(AuditLog)
            .filter(
                AuditLog.action == "EXPORT_RELATORIO",
                AuditLog.target_type == "Relatorio",
                AuditLog.target_id == "melhores-alunos",
            )
            .order_by(AuditLog.id.desc())
            .first()
        )

        assert audit_log is not None
        assert audit_log.details["format"] == "csv"
        assert audit_log.details["row_count"] >= 1
