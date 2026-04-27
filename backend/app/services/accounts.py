"""Helpers para provisionar contas de usuários vinculadas aos alunos."""
from __future__ import annotations

import re
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



def build_aluno_username(aluno: Aluno) -> str:
    prefix = _sanitize_first_name(aluno.nome)
    return f"{prefix}{aluno.matricula}".lower()


def ensure_aluno_user(session: Session, aluno: Aluno) -> Usuario:
    """Garante que exista um usuário vinculado ao aluno informado."""
    from sqlalchemy.exc import IntegrityError

    username = build_aluno_username(aluno)
    usuario = session.query(Usuario).filter(Usuario.username == username, Usuario.tenant_id == aluno.tenant_id).first()
    if usuario:
        if usuario.aluno_id != aluno.id:
            usuario.aluno_id = aluno.id
        return usuario

    stmt = select(Usuario).where(Usuario.aluno_id == aluno.id, Usuario.role == "aluno")
    usuario = session.execute(stmt).scalar_one_or_none()
    if usuario:
        return usuario

    try:
        usuario = Usuario(
            username=username,
            password_hash=hash_password(aluno.matricula),
            role="aluno",
            aluno_id=aluno.id,
            tenant_id=aluno.tenant_id,
            must_change_password=True,
        )
        session.add(usuario)
        session.flush()
        logger.info("Usuário aluno {} criado para o tenant {}", username, aluno.tenant_id)
    except IntegrityError:
        session.rollback()
        usuario = session.query(Usuario).filter(Usuario.username == username).first()
        if not usuario:
            usuario = session.execute(select(Usuario).where(Usuario.aluno_id == aluno.id, Usuario.role == "aluno")).scalar_one_or_none()

    return usuario


def ensure_responsavel_user(session: Session, aluno: Aluno) -> Usuario:
    """Garante que exista um usuário responsável vinculado ao aluno informado."""
    from sqlalchemy.exc import IntegrityError

    username = f"resp_{aluno.matricula}"

    usuario = session.query(Usuario).filter(Usuario.username == username, Usuario.tenant_id == aluno.tenant_id).first()
    if usuario:
        return usuario

    try:
        usuario = Usuario(
            username=username,
            password_hash=hash_password(aluno.matricula),
            role="responsavel",
            aluno_id=aluno.id,
            tenant_id=aluno.tenant_id,
            must_change_password=True,
        )
        session.add(usuario)
        session.flush()
        logger.info("Usuário responsável {} criado para o tenant {}", username, aluno.tenant_id)
    except IntegrityError:
        session.rollback()
        usuario = session.query(Usuario).filter(Usuario.username == username, Usuario.tenant_id == aluno.tenant_id).first()

    return usuario


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
