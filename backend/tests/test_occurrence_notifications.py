from datetime import datetime, timezone

from app.core.database import session_scope
from app.core.tasks import notify_occurrence_task
from app.models import AcademicYear, Aluno, Ocorrencia, Tenant
from app.services.communication_service import CommunicationService


def _ensure_context(session):
    tenant = session.query(Tenant).filter(Tenant.slug == "default").first()
    if not tenant:
        tenant = Tenant(name="Escola Teste", slug="default", is_active=True)
        session.add(tenant)
        session.flush()

    year = (
        session.query(AcademicYear)
        .filter(AcademicYear.tenant_id == tenant.id, AcademicYear.label == "2026")
        .first()
    )
    if not year:
        year = AcademicYear(tenant_id=tenant.id, label="2026", is_current=True)
        session.add(year)
        session.flush()

    return tenant, year


def _create_occurrence(
    *,
    matricula: str,
    email: str | None = None,
    telefones: str | None = None,
    email_responsavel: str | None = None,
    telefone_responsavel: str | None = None,
) -> int:
    with session_scope() as session:
        tenant, year = _ensure_context(session)
        aluno = Aluno(
            matricula=matricula,
            nome=f"Aluno Teste {matricula}",
            turma="7º A",
            turno="Matutino",
            email=email,
            telefones=telefones,
            email_responsavel=email_responsavel,
            telefone_responsavel=telefone_responsavel,
            tenant_id=tenant.id,
            academic_year_id=year.id,
        )
        session.add(aluno)
        session.flush()

        ocorrencia = Ocorrencia(
            aluno_id=aluno.id,
            tipo="ADVERTENCIA",
            descricao="Teste de notificação",
            gravidade="LEVE",
            data_registro=datetime.now(timezone.utc),
            notificacao_status="Pendente",
            tenant_id=tenant.id,
            academic_year_id=year.id,
        )
        session.add(ocorrencia)
        session.flush()
        return ocorrencia.id


def _get_status(ocorrencia_id: int) -> str | None:
    with session_scope() as session:
        ocorrencia = session.get(Ocorrencia, ocorrencia_id)
        return ocorrencia.notificacao_status if ocorrencia else None


def test_occurrence_notification_does_not_use_student_contact_fallback(flask_app, monkeypatch):
    calls: list[tuple[str, str]] = []

    monkeypatch.setattr(
        CommunicationService,
        "send_email",
        staticmethod(lambda to_email, subject, body: calls.append(("email", to_email)) or True),
    )
    monkeypatch.setattr(
        CommunicationService,
        "send_whatsapp",
        staticmethod(lambda phone, message: calls.append(("whatsapp", phone)) or True),
    )

    ocorrencia_id = _create_occurrence(
        matricula="fallback001",
        email="aluno@example.com",
        telefones="73999990000",
    )

    notify_occurrence_task(ocorrencia_id)

    assert calls == []
    assert _get_status(ocorrencia_id) == "Sem contato cadastrado"


def test_occurrence_notification_uses_responsavel_contact(flask_app, monkeypatch):
    calls: list[tuple[str, str]] = []

    monkeypatch.setattr(
        CommunicationService,
        "send_email",
        staticmethod(lambda to_email, subject, body: calls.append(("email", to_email)) or True),
    )
    monkeypatch.setattr(
        CommunicationService,
        "send_whatsapp",
        staticmethod(lambda phone, message: calls.append(("whatsapp", phone)) or True),
    )

    ocorrencia_id = _create_occurrence(
        matricula="responsavel001",
        email="aluno@example.com",
        telefones="73999990000",
        email_responsavel="responsavel@example.com",
        telefone_responsavel="73988887777",
    )

    notify_occurrence_task(ocorrencia_id)

    assert ("email", "responsavel@example.com") in calls
    assert ("whatsapp", "73988887777") in calls
    assert ("email", "aluno@example.com") not in calls
    assert ("whatsapp", "73999990000") not in calls
    assert _get_status(ocorrencia_id) == "Enviado"
