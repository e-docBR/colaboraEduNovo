"""add_responsavel_contact_to_aluno

Revision ID: c7f2a9e1b3d8
Revises: 858d070c6419
Create Date: 2026-04-23 00:00:00.000000

Adiciona email_responsavel e telefone_responsavel à tabela alunos.
Esses campos são usados para direcionar notificações de ocorrências
aos pais/responsáveis, com prioridade sobre o email/telefone do aluno.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c7f2a9e1b3d8'
down_revision: Union[str, Sequence[str], None] = '3c4d5e6f7a8b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('alunos', sa.Column('email_responsavel', sa.String(length=255), nullable=True))
    op.add_column('alunos', sa.Column('telefone_responsavel', sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column('alunos', 'telefone_responsavel')
    op.drop_column('alunos', 'email_responsavel')
