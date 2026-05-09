"""Add tenants table and relationships

Revision ID: a1b2c3d4e5f6
Revises: 50489374deb2
Create Date: 2026-01-12 16:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '50489374deb2'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Create tenants table
    op.create_table(
        'tenants',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('slug', sa.String(length=64), nullable=False),
        sa.Column('domain', sa.String(length=255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('settings', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug'),
        sa.UniqueConstraint('domain')
    )

    # 2. Add tenant_id to usuarios
    with op.batch_alter_table('usuarios', schema=None) as batch_op:
        batch_op.add_column(sa.Column('tenant_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_usuarios_tenant_id_tenants', 'tenants', ['tenant_id'], ['id'])

    # 3. Add tenant_id to alunos
    with op.batch_alter_table('alunos', schema=None) as batch_op:
        batch_op.add_column(sa.Column('tenant_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_alunos_tenant_id_tenants', 'tenants', ['tenant_id'], ['id'])


def downgrade() -> None:
    # 1. Drop tenant_id from alunos
    with op.batch_alter_table('alunos', schema=None) as batch_op:
        batch_op.drop_constraint('fk_alunos_tenant_id_tenants', type_='foreignkey')
        batch_op.drop_column('tenant_id')

    # 2. Drop tenant_id from usuarios
    with op.batch_alter_table('usuarios', schema=None) as batch_op:
        batch_op.drop_constraint('fk_usuarios_tenant_id_tenants', type_='foreignkey')
        batch_op.drop_column('tenant_id')

    # 3. Drop tenants table
    op.drop_table('tenants')
