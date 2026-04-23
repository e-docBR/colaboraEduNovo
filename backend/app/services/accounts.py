"""Helpers para provisionar contas de usuários vinculadas aos alunos."""
from __future__ import annotations

import re
import secrets
import string
from unicodedata import normalize

from loguru import logger
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.security import hash_password
from ..models import Aluno, Usuario


def _sanitize_first_name(full_name: str | None) -> str:
    if not full_name:
        return "aluno"
    first_name = full_name.strip().split()[0]
    normalized = normalize("NFKD", first_name).encode("ascii", "ignore").decode("ascii")
    safe = re.sub(r"[^a-zA-Z0-9]", "", normalized).lower()
    return safe or "aluno"


def _generate_initial_password() -> str:
    """Gera uma senha aleatória segura para uso inicial.
    Formato: 3 letras maiúsculas + 3 dígitos + 2 caracteres especiais = 8 chars mínimos.
    """
    alphabet_upper = string.ascii_uppercase
    digits = string.digits
    special = "!@#$%"
    password = (
        "".join(secrets.choice(alphabet_upper) for _ in range(3))
        + "".join(secrets.choice(digits) for _ in range(3))
        + "".join(secrets.choice(special) for _ in range(2))
    )
    # Embaralha para não ter padrão previsível
    chars = list(password)
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)


def build_aluno_username(aluno: Aluno) -> str:
    prefix = _sanitize_first_name(aluno.nome)
    return f"{prefix}{aluno.matricula}".lower()


def ensure_aluno_user(session: Session, aluno: Aluno) -> Usuario:
    """Garante que exista um usuário vinculado ao aluno informado."""
    from sqlalchemy.exc import IntegrityError

    username = build_aluno_username(aluno)
    # 1. First try to find by username (matricula-based) to avoid duplicates across years
    usuario = session.query(Usuario).filter(Usuario.username == username).first()
    if usuario:
        # If user exists but is not linked to this tenant, maybe it's a conflict or shared?
        # For now, if it exists, use it. We might update the hardcoded aluno_id to the most recent.
        if usuario.aluno_id != aluno.id and getattr(aluno, "academic_year", None) and aluno.academic_year.is_current:
             usuario.aluno_id = aluno.id
        return usuario

    # 2. Fallback to searching by aluno_id if username didn't match (unlikely but safe)
    stmt = select(Usuario).where(Usuario.aluno_id == aluno.id)
    usuario = session.execute(stmt).scalar_one_or_none()
    if usuario:
        return usuario

    try:
        initial_password = _generate_initial_password()
        usuario = Usuario(
            username=username,
            password_hash=hash_password(initial_password),
            role="aluno",
            aluno_id=aluno.id,
            tenant_id=aluno.tenant_id,
            must_change_password=True,
        )
        session.add(usuario)
        session.flush()  # Ensure it's visible to subsequent queries in the same transaction
        logger.info("Usuário aluno {} criado automaticamente para o tenant {}", username, aluno.tenant_id)
    except IntegrityError:
        # Concurrent request already created the user — rollback the savepoint and re-fetch
        session.rollback()
        usuario = session.query(Usuario).filter(Usuario.username == username).first()
        if not usuario:
            usuario = session.execute(select(Usuario).where(Usuario.aluno_id == aluno.id)).scalar_one_or_none()

    return usuario


def ensure_all_aluno_users(session: Session) -> int:
    """Provisiona contas para todos os alunos que ainda não possuem usuário."""
    missing_stmt = (
        select(Aluno)
        .outerjoin(Usuario, Usuario.aluno_id == Aluno.id)
        .where(Usuario.id.is_(None))
    )
    alunos_sem_usuario = session.execute(missing_stmt).scalars().all()
    if not alunos_sem_usuario:
        return 0

    created = 0
    for aluno in alunos_sem_usuario:
        ensure_aluno_user(session, aluno)
        created += 1

    logger.info("Provisionadas %s contas pendentes de alunos", created)
    return created
