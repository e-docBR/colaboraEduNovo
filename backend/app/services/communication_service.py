import re
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import requests
from loguru import logger
from ..core.config import settings


class CommunicationService:

    @staticmethod
    def _extract_first_phone(telefones: str) -> str:
        candidates = re.findall(r'[\d\s\(\)\-]+', telefones)
        for candidate in candidates:
            digits = re.sub(r'\D', '', candidate)
            if len(digits) >= 10:
                return digits
        return re.sub(r'\D', '', telefones)

    @staticmethod
    def _normalize_br_phone(digits: str) -> str:
        if digits.startswith('55') and len(digits) in (12, 13):
            return digits
        if len(digits) in (10, 11):
            return '55' + digits
        return digits

    @staticmethod
    def send_email(to_email: str, subject: str, body: str) -> bool:
        """Envia e-mail via smtplib — funciona sem Flask app context."""
        if not to_email or not settings.smtp_server:
            logger.warning("Destinatário ou servidor SMTP não configurado.")
            return False

        try:
            msg = MIMEMultipart()
            msg["From"] = settings.smtp_from
            msg["To"] = to_email
            msg["Subject"] = subject
            msg.attach(MIMEText(body, "plain", "utf-8"))

            clean_password = settings.smtp_password.replace(" ", "")
            if settings.smtp_use_ssl:
                context = ssl.create_default_context()
                with smtplib.SMTP_SSL(settings.smtp_server, settings.smtp_port, context=context) as server:
                    if settings.smtp_user:
                        server.login(settings.smtp_user, clean_password)
                    server.sendmail(settings.smtp_from, to_email, msg.as_string())
            else:
                with smtplib.SMTP(settings.smtp_server, settings.smtp_port) as server:
                    if settings.smtp_use_tls:
                        server.starttls()
                    if settings.smtp_user:
                        server.login(settings.smtp_user, clean_password)
                    server.sendmail(settings.smtp_from, to_email, msg.as_string())

            logger.info(f"Email enviado para {to_email}")
            return True
        except Exception as e:
            logger.error(f"Falha ao enviar email para {to_email}: {e}")
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
