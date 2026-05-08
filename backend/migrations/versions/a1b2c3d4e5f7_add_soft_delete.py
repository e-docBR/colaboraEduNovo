"""add_soft_delete

Revision ID: a1b2c3d4e5f6
Revises: f9a3b1c2d4e5
Create Date: 2026-05-08 00:00:00.000000

Adds deleted_at and is_archived columns to alunos and usuarios to
support soft delete / archiving instead of permanent record destruction.
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f7"
down_revision: Union[str, None] = "c9f2a8b3d1e4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("alunos", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("alunos", sa.Column("is_archived", sa.Boolean(), nullable=False, server_default="false"))
    op.create_index("idx_aluno_archived", "alunos", ["tenant_id", "is_archived"])

    op.add_column("usuarios", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("usuarios", sa.Column("is_archived", sa.Boolean(), nullable=False, server_default="false"))
    op.create_index("idx_usuario_archived", "usuarios", ["tenant_id", "is_archived"])


def downgrade() -> None:
    op.drop_index("idx_usuario_archived", table_name="usuarios")
    op.drop_column("usuarios", "is_archived")
    op.drop_column("usuarios", "deleted_at")

    op.drop_index("idx_aluno_archived", table_name="alunos")
    op.drop_column("alunos", "is_archived")
    op.drop_column("alunos", "deleted_at")
