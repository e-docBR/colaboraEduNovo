"""Adiciona campos recuperacao e conselho_de_classe ao modelo Nota.

Revision ID: k5l6m7n8o9p0
Revises: j4k5l6m7n8o9
Create Date: 2026-05-20 13:00:00.000000
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "k5l6m7n8o9p0"
down_revision: Union[str, None] = "j4k5l6m7n8o9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "notas",
        sa.Column("recuperacao", sa.Numeric(5, 2), nullable=True),
    )
    op.add_column(
        "notas",
        sa.Column("conselho_de_classe", sa.Numeric(5, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("notas", "conselho_de_classe")
    op.drop_column("notas", "recuperacao")
