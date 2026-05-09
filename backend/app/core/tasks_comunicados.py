"""Background task: send email notifications to responsáveis when a comunicado is published."""
from loguru import logger
from .database import session_scope
from ..services.communication_service import CommunicationService


def notify_comunicado_task(comunicado_id: int) -> dict:
    """Send email to all responsáveis affected by a comunicado.

    Targeting rules:
      - TODOS: all active responsáveis in the tenant/year
      - TURMA: responsáveis whose aluno is in that turma
      - ALUNO: the responsável of that specific aluno
    """
    from ..models import Comunicado, Usuario, Aluno, Tenant

    with session_scope() as session:
        comunicado = session.get(Comunicado, comunicado_id)
        if not comunicado:
            logger.warning("Comunicado {} not found — skipping notify task", comunicado_id)
            return {"sent": 0, "failed": 0}

        tenant = session.get(Tenant, comunicado.tenant_id) if comunicado.tenant_id else None
        school_name = tenant.name if tenant else "ColaboraEDU"

        subject = f"📣 {school_name} — {comunicado.titulo}"
        body = (
            f"Prezados Pais/Responsáveis,\n\n"
            f"{comunicado.conteudo}\n\n"
            f"Atenciosamente,\n{school_name}"
        )

        # Gather target responsáveis
        q = (
            session.query(Usuario)
            .filter(
                Usuario.role == "responsavel",
                Usuario.is_active == True,  # noqa: E712
                Usuario.is_archived == False,  # noqa: E712
            )
        )
        if comunicado.tenant_id:
            q = q.filter(Usuario.tenant_id == comunicado.tenant_id)

        if comunicado.target_type == "ALUNO" and comunicado.target_value:
            # Single aluno — find its responsável
            try:
                aluno_id = int(comunicado.target_value)
            except (ValueError, TypeError):
                return {"sent": 0, "failed": 0}
            aluno = session.get(Aluno, aluno_id)
            if not aluno:
                return {"sent": 0, "failed": 0}
            q = q.filter(Usuario.matricula == aluno.matricula)

        elif comunicado.target_type == "TURMA" and comunicado.target_value:
            # Responsáveis whose aluno is in that turma
            turma_alunos = (
                session.query(Aluno.matricula)
                .filter(
                    Aluno.turma == comunicado.target_value,
                    *([Aluno.tenant_id == comunicado.tenant_id] if comunicado.tenant_id else []),
                    *([Aluno.academic_year_id == comunicado.academic_year_id] if comunicado.academic_year_id else []),
                    Aluno.is_archived == False,  # noqa: E712
                )
                .all()
            )
            matriculas = [r.matricula for r in turma_alunos]
            if not matriculas:
                return {"sent": 0, "failed": 0}
            q = q.filter(Usuario.matricula.in_(matriculas))

        # For TODOS / PROFESSOR — target all responsáveis (PROFESSOR type is staff-only)

        responsaveis = q.all()
        sent = 0
        failed = 0

        for resp in responsaveis:
            # Email from their linked aluno or their own account email
            email = None
            if resp.aluno_id:
                aluno = session.get(Aluno, resp.aluno_id)
                if aluno:
                    email = aluno.email_responsavel or aluno.email
            email = email or resp.email

            if not email:
                logger.debug("Responsável {} sem email — pulando", resp.username)
                failed += 1
                continue

            ok = CommunicationService.send_email(to_email=email, subject=subject, body=body)
            if ok:
                sent += 1
            else:
                failed += 1

    logger.info(
        "Comunicado {} notification done. sent={} failed={}",
        comunicado_id, sent, failed
    )
    return {"sent": sent, "failed": failed}
