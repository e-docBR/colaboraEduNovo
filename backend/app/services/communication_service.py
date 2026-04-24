import re
import requests
from flask_mail import Mail, Message
from loguru import logger
from ..core.config import settings

mail = Mail()


class CommunicationService:

    @staticmethod
    def _extract_first_phone(telefones: str) -> str:
        """Extrai o primeiro número com pelo menos 10 dígitos do campo telefones.

        O campo pode conter múltiplos números separados por ' / ', vírgula ou espaço,
        ex: '(73) 3531-4000 / (73) 99858-8993'.
        Retorna apenas dígitos do primeiro número válido encontrado.
        """
        candidates = re.findall(r'[\d\s\(\)\-]+', telefones)
        for candidate in candidates:
            digits = re.sub(r'\D', '', candidate)
            if len(digits) >= 10:
                return digits
        # fallback: todos os dígitos do campo inteiro
        return re.sub(r'\D', '', telefones)

    @staticmethod
    def _normalize_br_phone(digits: str) -> str:
        """Normaliza número brasileiro para o formato E.164 sem '+' (ex: 5573999999999).

        A Evolution API espera o número no formato: 55 + DDD (2 dígitos) + número (8 ou 9 dígitos).
        Se o número já começa com '55' e tem 12 ou 13 dígitos, retorna como está.
        Se tem 10 ou 11 dígitos (sem DDI), adiciona '55'.
        """
        if digits.startswith('55') and len(digits) in (12, 13):
            return digits
        if len(digits) in (10, 11):
            return '55' + digits
        return digits

    @staticmethod
    def send_email(to_email: str, subject: str, body: str) -> bool:
        """Envia e-mail via Flask-Mail (SMTP configurado em settings)."""
        if not to_email:
            logger.warning("No recipient email provided.")
            return False

        try:
            msg = Message(
                subject=subject,
                recipients=[to_email],
                body=body,
                sender=settings.smtp_from
            )
            mail.send(msg)
            logger.info(f"Email sent to {to_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False

    @staticmethod
    def send_whatsapp(phone: str, message: str) -> bool:
        """Envia mensagem WhatsApp via Evolution API."""
        if not phone or not settings.whatsapp_api_url or not settings.whatsapp_instance:
            logger.warning("Phone number, WhatsApp API URL or instance missing — skipping WhatsApp.")
            return False

        clean_phone = CommunicationService._extract_first_phone(phone)
        if len(clean_phone) < 10:
            logger.warning(f"Phone number too short after cleaning: '{clean_phone}' (original: '{phone}')")
            return False

        normalized = CommunicationService._normalize_br_phone(clean_phone)
        logger.debug(f"Phone normalized: '{phone}' → '{clean_phone}' → '{normalized}'")

        url = f"{settings.whatsapp_api_url}/message/sendText/{settings.whatsapp_instance}"
        headers = {
            "apikey": settings.whatsapp_api_token,
            "Content-Type": "application/json"
        }
        payload = {
            "number": normalized,
            "text": message
        }

        try:
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            response.raise_for_status()
            logger.info(f"WhatsApp message sent to {normalized}")
            return True
        except Exception as e:
            logger.error(f"Failed to send WhatsApp to {normalized}: {e}")
            return False
