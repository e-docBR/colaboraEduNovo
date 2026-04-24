"""fix_comunicados_data_envio_default

Revision ID: d1e2f3a4b5c6
Revises: c7f2a9e1b3d8
Create Date: 2026-04-24 00:00:00.000000

A coluna data_envio foi criada como NOT NULL sem DEFAULT no banco,
causando IntegrityError ao criar comunicados (SQLAlchemy enviava
server_default apenas no DDL, mas o banco foi criado antes dessa
configuração ser aplicada corretamente).
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, Sequence[str], None] = 'c7f2a9e1b3d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        'comunicados',
        'data_envio',
        existing_type=sa.DateTime(timezone=True),
        server_default=sa.text('NOW()'),
        existing_nullable=False
    )


def downgrade() -> None:
    op.alter_column(
        'comunicados',
        'data_envio',
        existing_type=sa.DateTime(timezone=True),
        server_default=None,
        existing_nullable=False
    )
