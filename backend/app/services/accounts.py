"""Helpers para provisionar contas de usuários vinculadas aos alunos."""
from __future__ import annotations

import re
import secrets
from unicodedata import normalize

from loguru import logger
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.security import hash_password
from ..models import Aluno, Usuario
from ..models.audit_log import AuditLog


def _sanitize_first_name(full_name: str | None) -> str:
    if not full_name:
        return "aluno"
    first_name = full_name.strip().split()[0]
    normalized = normalize("NFKD", first_name).encode("ascii", "ignore").decode("ascii")
    safe = re.sub(r"[^a-zA-Z0-9]", "", normalized).lower()
    return safe or "aluno"



def build_aluno_username(aluno: Aluno) -> str:
    prefix = _sanitize_first_name(aluno.nome)
    return f"{prefix}{aluno.matricula}".lower()


def ensure_aluno_user(session: Session, aluno: Aluno) -> tuple[Usuario, str | None]:
    """Garante que exista um usuário vinculado ao aluno informado.

    Retorna (usuario, senha_inicial) onde senha_inicial é não-None apenas
    quando uma nova conta é criada. Em lookups de contas existentes retorna None.

    Lookup order:
    1. by (tenant_id, role=aluno, matricula) — cross-year stable identifier
    2. by (tenant_id, username) — fallback for legacy accounts without matricula
    3. create new account with random password
    """
    from sqlalchemy.exc import IntegrityError

    username = build_aluno_username(aluno)

    # 1. Primary lookup by matricula — works across academic years
    usuario = session.query(Usuario).filter(
        Usuario.matricula == aluno.matricula,
        Usuario.tenant_id == aluno.tenant_id,
        Usuario.role == "aluno"
    ).first()
    if usuario:
        usuario.aluno_id = aluno.id  # point to current year's aluno row
        return usuario, None

    # 2. Fallback for legacy accounts created before the matricula field existed
    usuario = session.query(Usuario).filter(
        Usuario.username == username,
        Usuario.tenant_id == aluno.tenant_id
    ).first()
    if usuario:
        usuario.aluno_id = aluno.id
        usuario.matricula = aluno.matricula  # backfill
        return usuario, None

    # 3. Create new account with initial password equal to the student's matricula
    initial_password = aluno.matricula
    try:
        usuario = Usuario(
            username=username,
            password_hash=hash_password(initial_password),
            role="aluno",
            aluno_id=aluno.id,
            matricula=aluno.matricula,
            tenant_id=aluno.tenant_id,
            must_change_password=True,
        )
        session.add(usuario)
        session.flush()
        session.add(AuditLog(
            user_id=None,
            tenant_id=aluno.tenant_id,
            action="create",
            target_type="usuario",
            target_id=str(usuario.id),
            details={"username": username, "role": "aluno", "source": "ingestion", "matricula": aluno.matricula},
        ))
        logger.info("Usuário aluno {} criado para o tenant {}", username, aluno.tenant_id)
        return usuario, initial_password
    except IntegrityError:
        session.rollback()
        usuario = session.query(Usuario).filter(
            Usuario.username == username, Usuario.tenant_id == aluno.tenant_id
        ).first()
        if usuario and not usuario.matricula:
            usuario.matricula = aluno.matricula
            usuario.aluno_id = aluno.id
        return usuario, None


def ensure_responsavel_user(session: Session, aluno: Aluno) -> tuple[Usuario, str | None]:
    """Garante que exista um usuário responsável vinculado ao aluno informado.

    Retorna (usuario, senha_inicial) onde senha_inicial é não-None apenas
    quando uma nova conta é criada.
    """
    from sqlalchemy.exc import IntegrityError

    username = f"resp_{aluno.matricula}"

    # Lookup by (tenant_id, role=responsavel, matricula) for cross-year stability
    usuario = session.query(Usuario).filter(
        Usuario.matricula == aluno.matricula,
        Usuario.tenant_id == aluno.tenant_id,
        Usuario.role == "responsavel"
    ).first()
    if usuario:
        usuario.aluno_id = aluno.id
        return usuario, None

    # Fallback by username for legacy accounts
    usuario = session.query(Usuario).filter(
        Usuario.username == username, Usuario.tenant_id == aluno.tenant_id
    ).first()
    if usuario:
        usuario.aluno_id = aluno.id
        usuario.matricula = aluno.matricula
        return usuario, None

    initial_password = aluno.matricula
    try:
        usuario = Usuario(
            username=username,
            password_hash=hash_password(initial_password),
            role="responsavel",
            aluno_id=aluno.id,
            matricula=aluno.matricula,
            tenant_id=aluno.tenant_id,
            must_change_password=True,
        )
        session.add(usuario)
        session.flush()
        session.add(AuditLog(
            user_id=None,
            tenant_id=aluno.tenant_id,
            action="create",
            target_type="usuario",
            target_id=str(usuario.id),
            details={"username": username, "role": "responsavel", "source": "ingestion", "matricula": aluno.matricula},
        ))
        logger.info("Usuário responsável {} criado para o tenant {}", username, aluno.tenant_id)
        return usuario, initial_password
    except IntegrityError:
        session.rollback()
        usuario = session.query(Usuario).filter(
            Usuario.username == username, Usuario.tenant_id == aluno.tenant_id
        ).first()
        if usuario and not usuario.matricula:
            usuario.matricula = aluno.matricula
            usuario.aluno_id = aluno.id
        return usuario, None


def ensure_all_aluno_users(session: Session) -> int:
    """Provisiona contas de aluno e responsável para todos os alunos sem usuário."""
    alunos = session.execute(select(Aluno)).scalars().all()
    created = 0
    for aluno in alunos:
        aluno_stmt = select(Usuario).where(Usuario.aluno_id == aluno.id, Usuario.role == "aluno")
        if not session.execute(aluno_stmt).scalar_one_or_none():
            ensure_aluno_user(session, aluno)
            created += 1
        resp_stmt = select(Usuario).where(Usuario.username == f"resp_{aluno.matricula}", Usuario.tenant_id == aluno.tenant_id)
        if not session.execute(resp_stmt).scalar_one_or_none():
            ensure_responsavel_user(session, aluno)
            created += 1

    if created:
        logger.info("Provisionadas {} contas pendentes de alunos/responsáveis", created)
    return created
