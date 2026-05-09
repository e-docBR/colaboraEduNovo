"""expand_situacao_constraint: add EMC and other real-world situacao codes

Revision ID: 3c4d5e6f7a8b
Revises: 2b3c4d5e6f7a
Create Date: 2026-04-23 00:00:00.000000

Real boletins from Brazilian schools use more situacao codes than the initial
constraint allowed. This migration expands the allowed set to:
  APR  - Aprovado
  REP  - Reprovado
  REC  - Em Recuperação / Recuperação
  APCC - Aprovado por Conselho de Classe
  AR   - Aprovado com Restrição
  EMC  - Em Curso (trimestres ainda não encerrados)
  EMR  - Em Regime de Recuperação
  AFC  - Aprovado com Frequência Compensada
  DPC  - Dependência Parcial de Componente
  TRN  - Transferido
  ABA  - Abandono
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "3c4d5e6f7a8b"
down_revision: Union[str, Sequence[str], None] = "2b3c4d5e6f7a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_NEW_CONSTRAINT = (
    "situacao IS NULL OR situacao IN ("
    "'APR', 'REP', 'REC', 'APCC', 'AR', "
    "'EMC', 'EMR', 'AFC', 'DPC', 'TRN', 'ABA'"
    ")"
)
_OLD_CONSTRAINT = (
    "situacao IS NULL OR situacao IN ('APR', 'REP', 'REC', 'APCC', 'AR')"
)
_CONSTRAINT_NAME = "ck_nota_situacao_valid"


def _constraint_exists(conn, table: str, name: str) -> bool:
    row = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_constraint c "
            "JOIN pg_class t ON t.oid = c.conrelid "
            "WHERE t.relname = :table AND c.conname = :name LIMIT 1"
        ),
        {"table": table, "name": name},
    ).fetchone()
    return row is not None


def upgrade() -> None:
    conn = op.get_bind()
    # Drop old restrictive constraint
    if _constraint_exists(conn, "notas", _CONSTRAINT_NAME):
        op.drop_constraint(_CONSTRAINT_NAME, "notas", type_="check")
    # Add expanded constraint
    op.create_check_constraint(_CONSTRAINT_NAME, "notas", _NEW_CONSTRAINT)


def downgrade() -> None:
    conn = op.get_bind()
    if _constraint_exists(conn, "notas", _CONSTRAINT_NAME):
        op.drop_constraint(_CONSTRAINT_NAME, "notas", type_="check")
    op.create_check_constraint(_CONSTRAINT_NAME, "notas", _OLD_CONSTRAINT)
