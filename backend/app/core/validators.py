"""Shared input validators used across schemas and API endpoints."""
import re


_PASSWORD_MIN_LEN = 8
_PASSWORD_RULES = [
    (r"[A-Z]", "pelo menos uma letra maiúscula"),
    (r"[0-9]", "pelo menos um número"),
]


def validate_password_strength(password: str) -> str:
    """Validate password strength and return the password if valid.

    Raises ValueError with a human-readable message if the password does not
    meet the minimum requirements. This is the single source of truth for
    password rules — do NOT duplicate this logic in schemas or endpoints.
    """
    if len(password) < _PASSWORD_MIN_LEN:
        raise ValueError(f"A senha deve ter pelo menos {_PASSWORD_MIN_LEN} caracteres.")
    for pattern, description in _PASSWORD_RULES:
        if not re.search(pattern, password):
            raise ValueError(f"A senha deve conter {description}.")
    return password


_USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_.@-]{3,50}$")


def validate_username(username: str) -> str:
    """Validate that a username only contains safe characters.

    Raises ValueError if the username contains unexpected characters.
    """
    if not _USERNAME_PATTERN.match(username):
        raise ValueError(
            "Nome de usuário deve ter entre 3 e 50 caracteres e conter apenas "
            "letras, números, '.', '_', '@' ou '-'."
        )
    return username
