"""add_resolvida_to_ocorrencias

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-04-23 00:00:00.000000

A coluna resolvida foi removida na migration 858d070c6419 mas ainda é
referenciada no schema e service. Adicionada de volta como boolean
com default False para preservar a funcionalidade de marcar ocorrências
como resolvidas.
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e2f3a4b5c6d7'
down_revision: Union[str, Sequence[str], None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'ocorrencias',
        sa.Column('resolvida', sa.Boolean(), nullable=False, server_default='false')
    )


def downgrade() -> None:
    op.drop_column('ocorrencias', 'resolvida')
