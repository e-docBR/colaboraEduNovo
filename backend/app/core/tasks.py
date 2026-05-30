import re

from loguru import logger
from ..core.database import session_scope
from ..models import Ocorrencia, Tenant
from ..services.communication_service import CommunicationService

_EMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
_PHONE_RE = re.compile(r'^\+?\d[\d\s\-()]{7,}$')

TIPO_LABELS = {
    "ADVERTENCIA": "Advertência",
    "ELOGIO": "Elogio",
    "ATRASO": "Atraso",
    "SUSPENSAO": "Suspensão",
    "OUTRO": "Outro"
}

GRAVIDADE_LABELS = {
    "LEVE": "Leve",
    "MEDIA": "Média",
    "GRAVE": "Grave",
    "GRAVISSIMA": "Gravíssima"
}

def _mask_name(name: str) -> str:
    if not name:
        return name
    parts = name.split()
    if not parts:
        return name
    masked_parts = []
    for i, part in enumerate(parts):
        if i == 0:
            masked_parts.append(part)
        else:
            masked_parts.append(part[0] + "*" * (len(part) - 1) if part else "")
    return " ".join(masked_parts)

def notify_occurrence_task(ocorrencia_id: int):
    """Background task to send occurrence notifications via Email and WhatsApp.

    Retry behaviour (configured at enqueue time):
    - If ALL attempted channels fail, raises RuntimeError so RQ reschedules the job.
    - The status is committed to the DB before raising so operators can see "Parcial"
      in the UI and know a retry is pending.
    - The idempotency guard (status == "Enviado") prevents redundant sends on retry.
    """
    logger.info(f"Starting notification task for occurrence {ocorrencia_id}")

    with session_scope() as session:
        occurrence = session.get(Ocorrencia, ocorrencia_id)
        if not occurrence:
            logger.error(f"Occurrence {ocorrencia_id} not found.")
            return

        if occurrence.notificacao_status == "Enviado":
            logger.info(f"Occurrence {ocorrencia_id} already notified — skipping duplicate task.")
            return

        aluno = occurrence.aluno
        if not aluno:
            logger.error(f"Student not linked to occurrence {ocorrencia_id}")
            return

        # Dynamic school name from tenant
        tenant = session.get(Tenant, occurrence.tenant_id) if occurrence.tenant_id else None
        school_name = tenant.name if tenant else "ColaboraEDU"

        tipo_label = TIPO_LABELS.get(occurrence.tipo, occurrence.tipo.capitalize())
        gravidade_label = GRAVIDADE_LABELS.get(occurrence.gravidade or "LEVE", "Leve")
        data_str = occurrence.data_registro.strftime("%d/%m/%Y")

        subject = f"🔔 Comunicado Escolar — {tipo_label}: {_mask_name(aluno.nome)}"

        message_body = (
            f"Prezados Pais/Responsáveis,\n\n"
            f"Informamos o registro de uma ocorrência para o(a) aluno(a) {aluno.nome}.\n\n"
            f"🏫 Turma: {aluno.turma or '—'}\n"
            f"📅 Data: {data_str}\n"
            f"📝 Tipo: {tipo_label}\n"
            f"⚠️ Gravidade: {gravidade_label}\n"
            f"📄 Descrição: {occurrence.descricao}\n"
        )

        if occurrence.observacao_pais:
            message_body += f"\n💡 Ação necessária: {occurrence.observacao_pais}\n"

        message_body += (
            f"\nValorizamos a parceria entre família e escola. Por isso, estamos à inteira disposição para recebê-los e esclarecer quaisquer pontos, visando sempre o sucesso escolar do aluno.\n\n"
            f"Atenciosamente,\n"
            f"Orientação Educacional — {school_name}"
        )

        status_email = False
        status_whatsapp = False

        # Responsável tem prioridade sobre o próprio aluno
        email_destino = getattr(aluno, "email_responsavel", None) or aluno.email
        telefone_destino = getattr(aluno, "telefone_responsavel", None) or aluno.telefones

        # Send Email (validate format before attempting)
        if email_destino and _EMAIL_RE.match(email_destino):
            status_email = CommunicationService.send_email(
                to_email=email_destino,
                subject=subject,
                body=message_body
            )
        else:
            if email_destino:
                logger.warning(f"Aluno {aluno.id} ({_mask_name(aluno.nome)}) email inválido: {CommunicationService._mask_email(email_destino)!r}")
            else:
                logger.warning(f"Aluno {aluno.id} ({_mask_name(aluno.nome)}) sem email cadastrado — email não enviado")

        # Send WhatsApp (validate phone format before attempting)
        if telefone_destino and _PHONE_RE.match(telefone_destino.strip()):
            status_whatsapp = CommunicationService.send_whatsapp(
                phone=telefone_destino,
                message=message_body
            )
        else:
            if telefone_destino:
                logger.warning(f"Aluno {aluno.id} ({_mask_name(aluno.nome)}) telefone inválido: {CommunicationService._mask_phone(telefone_destino)!r}")
            else:
                logger.warning(f"Aluno {aluno.id} ({_mask_name(aluno.nome)}) sem telefone cadastrado — WhatsApp não enviado")

        # Update status distinguindo "não tentado" de "falha"
        email_attempted = bool(email_destino)
        whatsapp_attempted = bool(telefone_destino)
        parts = []
        if email_attempted:
            parts.append("Email: OK" if status_email else "Email: Falha")
        if whatsapp_attempted:
            parts.append("WhatsApp: OK" if status_whatsapp else "WhatsApp: Falha")

        all_failed = False
        if not parts:
            occurrence.notificacao_status = "Sem contato cadastrado"
        elif all("OK" in p for p in parts):
            occurrence.notificacao_status = "Enviado"
        else:
            occurrence.notificacao_status = "Parcial (" + ", ".join(parts) + ")"
            # All attempted channels failed → signal RQ to retry after backoff
            if all("Falha" in p for p in parts):
                all_failed = True

        session.add(occurrence)
        logger.info(f"Notification task for occurrence {ocorrencia_id} finished. Status: {occurrence.notificacao_status}")

    # Raise AFTER the session_scope commits so the status is persisted before RQ
    # reschedules. On retry the task re-reads the status and tries again (the
    # idempotency guard only short-circuits when status == "Enviado").
    if all_failed:
        raise RuntimeError(
            f"All notification channels failed for occurrence {ocorrencia_id} — will retry"
        )
