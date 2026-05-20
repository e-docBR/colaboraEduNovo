"""Criptografia simétrica para segredos armazenados no banco (API keys, tokens).

Usa Fernet (AES-128-CBC + HMAC-SHA256) com chave derivada do SECRET_KEY da aplicação.
Valores antigos sem o prefixo "enc:" são tratados como texto plano e passam transparentemente
até a próxima gravação, quando serão criptografados automaticamente.
"""
from __future__ import annotations

import base64
import hashlib
from typing import TYPE_CHECKING

from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

_ENCRYPTED_PREFIX = "enc:"
_FERNET_KEY_CACHE: bytes | None = None


def _get_fernet():
    """Retorna instância Fernet com chave derivada do SECRET_KEY (lazy + cached)."""
    from cryptography.fernet import Fernet

    global _FERNET_KEY_CACHE
    if _FERNET_KEY_CACHE is None:
        from .config import settings
        raw = hashlib.sha256(settings.secret_key.encode()).digest()
        _FERNET_KEY_CACHE = base64.urlsafe_b64encode(raw)
    return Fernet(_FERNET_KEY_CACHE)


def encrypt_secret(plaintext: str) -> str:
    """Criptografa um valor e retorna 'enc:<fernet_token>'."""
    if not plaintext:
        return plaintext
    if plaintext.startswith(_ENCRYPTED_PREFIX):
        return plaintext  # já criptografado
    token = _get_fernet().encrypt(plaintext.encode()).decode()
    return f"{_ENCRYPTED_PREFIX}{token}"


def decrypt_secret(ciphertext: str) -> str:
    """Descriptografa um valor.  Retorna o texto plano em caso de legado (sem prefixo)."""
    if not ciphertext:
        return ciphertext
    if not ciphertext.startswith(_ENCRYPTED_PREFIX):
        return ciphertext  # valor legado em texto plano — retorna como está
    try:
        token = ciphertext[len(_ENCRYPTED_PREFIX):].encode()
        return _get_fernet().decrypt(token).decode()
    except Exception:
        return ciphertext  # fallback seguro: nunca crashar por chave errada


class EncryptedSecret(TypeDecorator):
    """Tipo SQLAlchemy que criptografa em escrita e descriptografa em leitura.

    Totalmente transparente para o resto do código — quem lê/escreve cfg.api_key
    sempre recebe/fornece o valor em texto plano.
    """

    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        return encrypt_secret(str(value))

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        return decrypt_secret(value)
