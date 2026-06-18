"""add status to alunos

Revision ID: c2d3e4f5a6b7
Revises: 9b1c2d3e4f5a
Create Date: 2026-06-17 16:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c2d3e4f5a6b7"
down_revision: Union[str, Sequence[str], None] = "9b1c2d3e4f5a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _existing_columns() -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns("alunos")}


def upgrade() -> None:
    if "status" not in _existing_columns():
        op.add_column("alunos", sa.Column("status", sa.String(length=32), nullable=True))


def downgrade() -> None:
    if "status" in _existing_columns():
        op.drop_column("alunos", "status")
