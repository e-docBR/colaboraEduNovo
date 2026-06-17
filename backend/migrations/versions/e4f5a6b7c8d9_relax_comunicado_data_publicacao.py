"""relax comunicado data_publicacao compatibility column

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-06-17 20:45:00.000000

Older production databases have a legacy data_publicacao column on
comunicados. The current model writes data_envio, so this compatibility
column must not block inserts.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "e4f5a6b7c8d9"
down_revision: Union[str, Sequence[str], None] = "d3e4f5a6b7c8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table_name: str, column_name: str) -> bool:
    inspector = sa.inspect(op.get_bind())
    return column_name in {column["name"] for column in inspector.get_columns(table_name)}


def upgrade() -> None:
    if not _has_column("comunicados", "data_publicacao"):
        return

    op.execute(
        """
        UPDATE comunicados
        SET data_publicacao = COALESCE(data_publicacao, data_envio, NOW())
        WHERE data_publicacao IS NULL
        """
    )
    op.alter_column(
        "comunicados",
        "data_publicacao",
        existing_type=sa.DateTime(),
        nullable=True,
        server_default=sa.text("NOW()"),
    )


def downgrade() -> None:
    if not _has_column("comunicados", "data_publicacao"):
        return

    op.execute(
        """
        UPDATE comunicados
        SET data_publicacao = COALESCE(data_publicacao, data_envio, NOW())
        WHERE data_publicacao IS NULL
        """
    )
    op.alter_column(
        "comunicados",
        "data_publicacao",
        existing_type=sa.DateTime(),
        nullable=False,
        server_default=None,
    )
