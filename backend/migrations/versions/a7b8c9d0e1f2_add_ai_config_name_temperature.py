"""add ai_name and temperature to ai_configurations

Revision ID: a7b8c9d0e1f2
Revises: f9a3b1c2d4e5
Create Date: 2026-05-08 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers
revision = 'a7b8c9d0e1f2'
down_revision = 'f9a3b1c2d4e5'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    if 'ai_configurations' not in inspect(conn).get_table_names():
        return

    with op.batch_alter_table('ai_configurations') as batch_op:
        batch_op.add_column(
            sa.Column('ai_name', sa.String(100), nullable=True)
        )
        batch_op.add_column(
            sa.Column('temperature', sa.Float(), nullable=False, server_default='0.4')
        )
        # Ampliar api_key para 512 chars (OpenRouter tokens podem ser longos)
        batch_op.alter_column('api_key', type_=sa.String(512), existing_nullable=True)


def downgrade():
    with op.batch_alter_table('ai_configurations') as batch_op:
        batch_op.drop_column('ai_name')
        batch_op.drop_column('temperature')
        batch_op.alter_column('api_key', type_=sa.String(255), existing_nullable=True)
