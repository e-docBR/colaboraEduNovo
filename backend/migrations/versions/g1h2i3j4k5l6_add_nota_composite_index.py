"""add composite index (aluno_id, disciplina_normalizada) on notas

Revision ID: g1h2i3j4k5l6
Revises: 5dfe9b7b19b1
Create Date: 2026-05-13 00:00:00.000000

Adds a composite index to speed up the _upsert_notas lookup which filters
by both aluno_id and disciplina_normalizada together.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "g1h2i3j4k5l6"
down_revision: Union[str, None] = "5dfe9b7b19b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_notas_aluno_disciplina",
        "notas",
        ["aluno_id", "disciplina_normalizada"],
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("ix_notas_aluno_disciplina", table_name="notas", if_exists=True)
