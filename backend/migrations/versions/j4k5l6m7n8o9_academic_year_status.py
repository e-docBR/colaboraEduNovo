"""Adiciona campos status e closed_at ao modelo AcademicYear para suporte a encerramento de anos.

Revision ID: j4k5l6m7n8o9
Revises: i3j4k5l6m7n8
Create Date: 2026-05-20 12:00:00.000000
"""
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "j4k5l6m7n8o9"
down_revision: Union[str, None] = "i3j4k5l6m7n8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "academic_years",
        sa.Column("status", sa.String(16), nullable=False, server_default="open"),
    )
    op.add_column(
        "academic_years",
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("academic_years", "closed_at")
    op.drop_column("academic_years", "status")
