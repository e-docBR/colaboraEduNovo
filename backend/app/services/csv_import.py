"""CSV import service for bulk student creation."""
from __future__ import annotations

import csv
import io
from dataclasses import dataclass, field
from typing import Any

from loguru import logger

# Required and optional CSV columns
REQUIRED_COLUMNS = {"matricula", "nome", "turma", "turno"}
OPTIONAL_COLUMNS = {
    "sexo", "data_nascimento", "naturalidade", "zona", "endereco",
    "filiacao", "telefones", "cpf", "nis", "inep", "situacao_anterior",
    "email", "email_responsavel", "telefone_responsavel",
}
ALL_COLUMNS = REQUIRED_COLUMNS | OPTIONAL_COLUMNS


@dataclass
class CsvRowError:
    row: int
    field: str
    message: str


@dataclass
class CsvImportResult:
    created: int = 0
    skipped: int = 0
    errors: list[CsvRowError] = field(default_factory=list)
    job_id: str | None = None


def validate_csv_headers(headers: list[str]) -> list[str]:
    """Return list of missing required column names."""
    normalised = {h.strip().lower() for h in headers}
    return sorted(REQUIRED_COLUMNS - normalised)


def parse_csv_bytes(raw: bytes) -> tuple[list[dict[str, Any]], list[CsvRowError]]:
    """Parse CSV bytes into a list of row dicts. Returns (rows, parse_errors)."""
    try:
        text = raw.decode("utf-8-sig")  # handle BOM from Excel exports
    except UnicodeDecodeError:
        text = raw.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    headers = reader.fieldnames or []
    missing = validate_csv_headers(list(headers))
    if missing:
        return [], [CsvRowError(row=0, field=",".join(missing), message="Colunas obrigatórias ausentes")]

    rows: list[dict[str, Any]] = []
    errors: list[CsvRowError] = []

    for i, raw_row in enumerate(reader, start=2):  # row 1 is header
        row = {k.strip().lower(): (v or "").strip() for k, v in raw_row.items() if k}
        row_errors: list[str] = []

        for col in REQUIRED_COLUMNS:
            if not row.get(col):
                row_errors.append(col)

        if row_errors:
            errors.append(CsvRowError(row=i, field=",".join(row_errors), message="Campo obrigatório vazio"))
            continue

        # Keep only recognised columns
        cleaned = {k: v or None for k, v in row.items() if k in ALL_COLUMNS}
        rows.append(cleaned)

    return rows, errors


def run_csv_import(rows: list[dict], tenant_id: int, academic_year_id: int | None, user_id: int) -> CsvImportResult:
    """Background RQ task: insert students from pre-parsed CSV rows."""
    from ..core.database import session_scope
    from ..models import Aluno
    from ..services.accounts import ensure_aluno_user, ensure_responsavel_user
    from ..services.audit import log_action

    result = CsvImportResult()

    with session_scope() as session:
        for row in rows:
            matricula = row["matricula"]
            existing = (
                session.query(Aluno)
                .filter(
                    Aluno.matricula == matricula,
                    Aluno.tenant_id == tenant_id,
                    *([Aluno.academic_year_id == academic_year_id] if academic_year_id else []),
                )
                .first()
            )
            if existing:
                result.skipped += 1
                continue

            data = dict(row)
            data["tenant_id"] = tenant_id
            data["academic_year_id"] = academic_year_id

            aluno = Aluno(**data)
            session.add(aluno)
            session.flush()

            ensure_aluno_user(session, aluno)
            ensure_responsavel_user(session, aluno)
            log_action(session, user_id, "CSV_IMPORT", "Aluno", aluno.id, {"matricula": matricula})
            result.created += 1

    logger.info(
        "CSV import complete. tenant={} created={} skipped={} errors={}",
        tenant_id, result.created, result.skipped, len(result.errors),
    )
    return result
