"""Adiciona trimestre_atual ao AcademicYear para controle progressivo de trimestres.

Revision ID: l6m7n8o9p0q1
Revises: k5l6m7n8o9p0
Create Date: 2026-05-21 14:00:00.000000
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "l6m7n8o9p0q1"
down_revision: Union[str, None] = "k5l6m7n8o9p0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "academic_years",
        sa.Column(
            "trimestre_atual",
            sa.SmallInteger(),
            nullable=False,
            server_default="1",
        ),
    )


def downgrade() -> None:
    op.drop_column("academic_years", "trimestre_atual")
