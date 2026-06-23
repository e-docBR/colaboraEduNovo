#!/usr/bin/env python3
"""Smoke test local do portal familia usado pelo app Android."""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from decimal import Decimal
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "backend"
BACKEND_PYTHON = BACKEND_DIR / ".venv" / "bin" / "python"

if BACKEND_PYTHON.exists() and Path(sys.executable).absolute() != BACKEND_PYTHON.absolute():
    os.execv(str(BACKEND_PYTHON), [str(BACKEND_PYTHON), *sys.argv])


def load_local_env() -> bool:
    env_path = ROOT / ".env"
    if not env_path.exists():
        return False

    for line in env_path.read_text().splitlines():
        if line.startswith(("DATABASE_URL=", "REDIS_URL=", "SECRET_KEY=", "JWT_SECRET_KEY=")):
            key, value = line.split("=", 1)
            os.environ[key] = value
    return True


def ensure_backend_on_path() -> None:
    backend_path = str(BACKEND_DIR)
    if backend_path not in sys.path:
        sys.path.insert(0, backend_path)


def request_json(
    method: str,
    url: str,
    payload: dict[str, Any] | None = None,
    token: str | None = None,
) -> dict[str, Any]:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {
        "Content-Type": "application/json",
        "X-Client-Platform": "mobile",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {url} -> HTTP {exc.code}: {body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"{method} {url} -> erro de conexao: {exc.reason}") from exc


def login(base_url: str, username: str, password: str, tenant: str) -> dict[str, Any]:
    return request_json(
        "POST",
        f"{base_url}/auth/login",
        {"username": username, "password": password, "tenant_slug": tenant},
    )


def ensure_local_fixture(tenant_slug: str, password: str) -> None:
    if not load_local_env():
        print("AVISO: .env local nao encontrado; massa local nao foi preparada.")
        return

    ensure_backend_on_path()

    from app.core.database import session_scope  # noqa: PLC0415
    from app.core.security import hash_password  # noqa: PLC0415
    from app.models import AcademicYear, Aluno, Comunicado, Nota, Ocorrencia, Tenant  # noqa: PLC0415
    from app.services.accounts import ensure_aluno_user, ensure_responsavel_user  # noqa: PLC0415

    matricula = password
    with session_scope() as session:
        tenant = session.query(Tenant).filter(Tenant.slug == tenant_slug).first()
        if not tenant:
            tenant = Tenant(name="ColaboraEdu Local", slug=tenant_slug, is_active=True)
            session.add(tenant)
            session.flush()

        academic_year = (
            session.query(AcademicYear)
            .filter(AcademicYear.tenant_id == tenant.id, AcademicYear.label == "2026")
            .first()
        )
        if not academic_year:
            academic_year = AcademicYear(
                tenant_id=tenant.id,
                label="2026",
                is_current=True,
                status="open",
                trimestre_atual=1,
            )
            session.add(academic_year)
            session.flush()
        else:
            academic_year.is_current = True
            academic_year.status = "open"
            academic_year.trimestre_atual = 1

        aluno = (
            session.query(Aluno)
            .filter(
                Aluno.tenant_id == tenant.id,
                Aluno.academic_year_id == academic_year.id,
                Aluno.matricula == matricula,
            )
            .first()
        )
        if not aluno:
            aluno = Aluno(
                tenant_id=tenant.id,
                academic_year_id=academic_year.id,
                matricula=matricula,
                nome="ALUNO TESTE FAMILIA",
                turma="7o TESTE",
                turno="Matutino",
            )
            session.add(aluno)

        aluno.nome = "ALUNO TESTE FAMILIA"
        aluno.turma = "7o TESTE"
        aluno.turno = "Matutino"
        aluno.status = "Ativo"
        aluno.email_responsavel = "responsavel.local@example.com"
        aluno.telefone_responsavel = "73999999999"
        aluno.deleted_at = None
        aluno.is_archived = False
        session.flush()

        session.query(Nota).filter(Nota.aluno_id == aluno.id).delete(synchronize_session=False)
        for disciplina, total, faltas in (
            ("LINGUA PORTUGUESA", "24.0", 2),
            ("MATEMATICA", "18.5", 4),
            ("CIENCIAS", "27.0", 1),
        ):
            session.add(
                Nota(
                    tenant_id=tenant.id,
                    academic_year_id=academic_year.id,
                    aluno_id=aluno.id,
                    disciplina=disciplina,
                    disciplina_normalizada=disciplina,
                    trimestre1=Decimal(total),
                    total=Decimal(total),
                    faltas=faltas,
                    situacao="EMC",
                )
            )

        aluno_user, _ = ensure_aluno_user(session, aluno)
        resp_user, _ = ensure_responsavel_user(session, aluno)
        for user in (aluno_user, resp_user):
            user.password_hash = hash_password(password)
            user.must_change_password = True
            user.is_active = True
            user.deleted_at = None
            user.is_archived = False

        comunicado = (
            session.query(Comunicado)
            .filter(
                Comunicado.tenant_id == tenant.id,
                Comunicado.academic_year_id == academic_year.id,
                Comunicado.titulo == "Comunicado local de teste Android",
            )
            .first()
        )
        if not comunicado:
            session.add(
                Comunicado(
                    tenant_id=tenant.id,
                    academic_year_id=academic_year.id,
                    titulo="Comunicado local de teste Android",
                    conteudo="Comunicado criado automaticamente para validar o app familia.",
                    target_type="TODOS",
                    arquivado=False,
                )
            )

        ocorrencia = (
            session.query(Ocorrencia)
            .filter(
                Ocorrencia.tenant_id == tenant.id,
                Ocorrencia.academic_year_id == academic_year.id,
                Ocorrencia.aluno_id == aluno.id,
                Ocorrencia.descricao == "Ocorrencia local de teste Android",
            )
            .first()
        )
        if not ocorrencia:
            session.add(
                Ocorrencia(
                    tenant_id=tenant.id,
                    academic_year_id=academic_year.id,
                    aluno_id=aluno.id,
                    tipo="Advertencia",
                    descricao="Ocorrencia local de teste Android",
                    observacao_pais="Registro criado apenas para validacao local.",
                    gravidade="LEVE",
                    acao_tomada="Orientacao registrada no teste local.",
                    notificacao_status="Pendente",
                )
            )


def restore_local_password(usernames: list[str], password: str) -> None:
    if not load_local_env():
        print("AVISO: .env local nao encontrado; senha temporaria nao foi restaurada.")
        return

    ensure_backend_on_path()

    from app.core.database import session_scope  # noqa: PLC0415
    from app.core.security import hash_password  # noqa: PLC0415
    from app.models import Usuario  # noqa: PLC0415

    with session_scope() as session:
        for username in usernames:
            user = session.query(Usuario).filter(Usuario.username == username).first()
            if user:
                user.password_hash = hash_password(password)
                user.must_change_password = True
                user.is_active = True


def main() -> int:
    parser = argparse.ArgumentParser(description="Valida login e endpoints familia do app mobile.")
    parser.add_argument("--base-url", default="http://127.0.0.1:5000/api/v1")
    parser.add_argument("--tenant", default="default")
    parser.add_argument("--student-user", default="aluno900001")
    parser.add_argument("--responsible-user", default="resp_900001")
    parser.add_argument("--temp-password", default="900001")
    parser.add_argument("--new-password", default="Teste@900001")
    parser.add_argument("--no-restore", action="store_true", help="Nao restaura a senha temporaria local ao final.")
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")

    if not args.no_restore:
        ensure_local_fixture(args.tenant, args.temp_password)
        print("OK massa local preparada")
        restore_local_password([args.student_user, args.responsible_user], args.temp_password)
        print("OK senha temporaria local preparada")

    health_url = base_url.removesuffix("/api/v1") + "/health"
    health = request_json("GET", health_url)
    assert health.get("status") == "ok", health
    print("OK health: database e redis")

    student_login = login(base_url, args.student_user, args.temp_password, args.tenant)
    assert student_login["user"]["role"] == "aluno", student_login["user"]
    print(f"OK login aluno: {args.student_user}")

    aluno = request_json("GET", f"{base_url}/alunos/me", token=student_login["access_token"])
    assert aluno.get("matricula"), aluno
    assert len(aluno.get("notas") or []) >= 1, aluno
    print(f"OK alunos/me: {aluno.get('nome')} ({len(aluno.get('notas') or [])} notas)")

    changed = request_json(
        "POST",
        f"{base_url}/auth/change-password",
        {"current_password": args.temp_password, "new_password": args.new_password},
        token=student_login["access_token"],
    )
    assert changed["user"]["must_change_password"] is False, changed["user"]
    print("OK troca de senha temporaria do aluno")

    relogin = login(base_url, args.student_user, args.new_password, args.tenant)
    assert relogin["user"]["must_change_password"] is False, relogin["user"]
    print("OK login aluno com nova senha")

    if not args.no_restore:
        restore_local_password([args.student_user, args.responsible_user], args.temp_password)
        print("OK senha temporaria local restaurada")

    responsible_login = login(base_url, args.responsible_user, args.temp_password, args.tenant)
    assert responsible_login["user"]["role"] == "responsavel", responsible_login["user"]
    print(f"OK login responsavel: {args.responsible_user}")

    portal = request_json("GET", f"{base_url}/responsavel/meu-filho", token=responsible_login["access_token"])
    assert portal.get("aluno", {}).get("matricula"), portal
    print(
        "OK responsavel/meu-filho: "
        f"{portal['aluno'].get('nome')} "
        f"({len(portal.get('ocorrencias') or [])} ocorrencias, "
        f"{len(portal.get('comunicados') or [])} comunicados)"
    )

    print("Smoke mobile familia concluido com sucesso.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
