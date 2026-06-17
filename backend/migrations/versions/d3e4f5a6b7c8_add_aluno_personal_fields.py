"""add aluno personal fields

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-06-17 16:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d3e4f5a6b7c8"
down_revision: Union[str, Sequence[str], None] = "c2d3e4f5a6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ALUNO_PERSONAL_COLUMNS = (
    sa.Column("sexo", sa.String(length=10), nullable=True),
    sa.Column("data_nascimento", sa.String(length=20), nullable=True),
    sa.Column("naturalidade", sa.String(length=100), nullable=True),
    sa.Column("zona", sa.String(length=50), nullable=True),
    sa.Column("endereco", sa.String(length=500), nullable=True),
    sa.Column("filiacao", sa.String(length=500), nullable=True),
    sa.Column("telefones", sa.String(length=100), nullable=True),
    sa.Column("cpf", sa.String(length=20), nullable=True),
    sa.Column("nis", sa.String(length=20), nullable=True),
    sa.Column("inep", sa.String(length=32), nullable=True),
    sa.Column("situacao_anterior", sa.String(length=100), nullable=True),
    sa.Column("email", sa.String(length=255), nullable=True),
)


def _existing_columns() -> set[str]:
    inspector = sa.inspect(op.get_bind())
    return {column["name"] for column in inspector.get_columns("alunos")}


def upgrade() -> None:
    existing = _existing_columns()
    for column in ALUNO_PERSONAL_COLUMNS:
        if column.name not in existing:
            op.add_column("alunos", column)


def downgrade() -> None:
    existing = _existing_columns()
    for column in reversed(ALUNO_PERSONAL_COLUMNS):
        if column.name in existing:
            op.drop_column("alunos", column.name)
