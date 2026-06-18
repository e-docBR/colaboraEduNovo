"""create comunicado leituras table when missing

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-06-17 21:10:00.000000

Production databases created before the read-receipts model may have the
comunicados table without the companion comunicados_leituras table. Listing
comunicados queries read receipts, so the table must exist even if empty.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "f5a6b7c8d9e0"
down_revision: Union[str, Sequence[str], None] = "e4f5a6b7c8d9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(table_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    if _has_table("comunicados_leituras"):
        return

    op.create_table(
        "comunicados_leituras",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("comunicado_id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("data_leitura", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False),
        sa.ForeignKeyConstraint(["comunicado_id"], ["comunicados.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("comunicado_id", "usuario_id", name="uq_comunicado_usuario_leitura"),
    )


def downgrade() -> None:
    if _has_table("comunicados_leituras"):
        op.drop_table("comunicados_leituras")
