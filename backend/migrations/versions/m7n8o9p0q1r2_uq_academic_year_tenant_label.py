"""Adiciona unique constraint em academic_years(tenant_id, label) para prevenir duplicatas.

Revision ID: m7n8o9p0q1r2
Revises: l6m7n8o9p0q1
Create Date: 2026-05-22 10:00:00.000000
"""
from typing import Union

from alembic import op

revision: str = "m7n8o9p0q1r2"
down_revision: Union[str, None] = "l6m7n8o9p0q1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_academic_year_tenant_label",
        "academic_years",
        ["tenant_id", "label"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_academic_year_tenant_label", "academic_years", type_="unique")
