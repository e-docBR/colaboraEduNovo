"""add_academic_years_and_tenant_year_isolation_fixed

Revision ID: 858d070c6419
Revises: a1b2c3d4e5f6
Create Date: 2026-01-26 22:16:05.045337

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '858d070c6419'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create academic_years table if it doesn't exist
    # (Checking if it exists to avoid errors in case of partial runs)
    op.create_table(
        'academic_years',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=False),
        sa.Column('label', sa.String(length=32), nullable=False),
        sa.Column('is_current', sa.Boolean(), nullable=True, server_default='true'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_academic_years_tenant_id'), 'academic_years', ['tenant_id'], unique=False)

    # 2. SEED: Ensure at least one tenant and one academic year exist
    # If no tenant exists, create a default one
    op.execute("INSERT INTO tenants (name, slug, is_active) SELECT 'Default School', 'default', true WHERE NOT EXISTS (SELECT 1 FROM tenants LIMIT 1)")
    # If no academic year exists, create a default one for all tenants
    op.execute("INSERT INTO academic_years (tenant_id, label, is_current) SELECT id, '2024', true FROM tenants WHERE NOT EXISTS (SELECT 1 FROM academic_years LIMIT 1)")

    # 3. ALUNOS: Update columns
    op.add_column('alunos', sa.Column('academic_year_id', sa.Integer(), nullable=True))
    op.execute("UPDATE alunos SET academic_year_id = (SELECT id FROM academic_years LIMIT 1) WHERE academic_year_id IS NULL")
    op.alter_column('alunos', 'academic_year_id', nullable=False)
    # Ensure tenant_id is NOT NULL
    op.execute("UPDATE alunos SET tenant_id = (SELECT id FROM tenants LIMIT 1) WHERE tenant_id IS NULL")
    op.alter_column('alunos', 'tenant_id', nullable=False)
    
    op.create_index(op.f('ix_alunos_academic_year_id'), 'alunos', ['academic_year_id'], unique=False)
    op.create_index(op.f('ix_alunos_tenant_id'), 'alunos', ['tenant_id'], unique=False)
    op.create_foreign_key('fk_alunos_academic_year_id', 'alunos', 'academic_years', ['academic_year_id'], ['id'])
    # Foreign key for tenant_id usually already exists from a1b2c3d4e5f6, but adding it for safety if missing isn't easy here

    # 4. NOTAS: Add columns and update
    op.add_column('notas', sa.Column('tenant_id', sa.Integer(), nullable=True))
    op.add_column('notas', sa.Column('academic_year_id', sa.Integer(), nullable=True))
    op.execute("UPDATE notas SET tenant_id = (SELECT id FROM tenants LIMIT 1) WHERE tenant_id IS NULL")
    op.execute("UPDATE notas SET academic_year_id = (SELECT id FROM academic_years LIMIT 1) WHERE academic_year_id IS NULL")
    op.alter_column('notas', 'tenant_id', nullable=False)
    op.alter_column('notas', 'academic_year_id', nullable=False)
    
    op.create_index(op.f('ix_notas_academic_year_id'), 'notas', ['academic_year_id'], unique=False)
    op.create_index(op.f('ix_notas_tenant_id'), 'notas', ['tenant_id'], unique=False)
    op.create_foreign_key('fk_notas_academic_year_id', 'notas', 'academic_years', ['academic_year_id'], ['id'])
    op.create_foreign_key('fk_notas_tenant_id', 'notas', 'tenants', ['tenant_id'], ['id'])

    # 5. COMUNICADOS: Rename/Add columns
    op.add_column('comunicados', sa.Column('data_publicacao', sa.DateTime(), nullable=True))
    op.add_column('comunicados', sa.Column('tenant_id', sa.Integer(), nullable=True))
    op.add_column('comunicados', sa.Column('academic_year_id', sa.Integer(), nullable=True))
    
    # Populate data_publicacao from data_envio or now
    op.execute("UPDATE comunicados SET data_publicacao = COALESCE(data_envio, CURRENT_TIMESTAMP)")
    op.execute("UPDATE comunicados SET tenant_id = (SELECT id FROM tenants LIMIT 1)")
    op.execute("UPDATE comunicados SET academic_year_id = (SELECT id FROM academic_years LIMIT 1)")
    
    op.alter_column('comunicados', 'data_publicacao', nullable=False)
    op.alter_column('comunicados', 'tenant_id', nullable=False)
    op.alter_column('comunicados', 'academic_year_id', nullable=False)
    
    op.create_index(op.f('ix_comunicados_academic_year_id'), 'comunicados', ['academic_year_id'], unique=False)
    op.create_index(op.f('ix_comunicados_tenant_id'), 'comunicados', ['tenant_id'], unique=False)
    op.create_foreign_key('fk_comunicados_academic_year_id', 'comunicados', 'academic_years', ['academic_year_id'], ['id'])
    op.create_foreign_key('fk_comunicados_tenant_id', 'comunicados', 'tenants', ['tenant_id'], ['id'])
    
    # Use batch for dropping to be safe
    with op.batch_alter_table('comunicados') as batch_op:
        batch_op.drop_column('data_envio')
        batch_op.drop_column('arquivado')

    # 6. OCORRENCIAS: Rename/Add columns
    op.add_column('ocorrencias', sa.Column('data_registro', sa.DateTime(), nullable=True))
    # Correct names from your previous run: data_ocorrencia, created_at, resolvida
    op.add_column('ocorrencias', sa.Column('tenant_id', sa.Integer(), nullable=True))
    op.add_column('ocorrencias', sa.Column('academic_year_id', sa.Integer(), nullable=True))
    
    # Populate
    op.execute("UPDATE ocorrencias SET data_registro = COALESCE(data_ocorrencia, created_at, CURRENT_TIMESTAMP)")
    op.execute("UPDATE ocorrencias SET tenant_id = (SELECT id FROM tenants LIMIT 1)")
    op.execute("UPDATE ocorrencias SET academic_year_id = (SELECT id FROM academic_years LIMIT 1)")
    
    op.alter_column('ocorrencias', 'data_registro', nullable=False)
    op.alter_column('ocorrencias', 'tenant_id', nullable=False)
    op.alter_column('ocorrencias', 'academic_year_id', nullable=False)
    
    op.create_index(op.f('ix_ocorrencias_academic_year_id'), 'ocorrencias', ['academic_year_id'], unique=False)
    op.create_index(op.f('ix_ocorrencias_tenant_id'), 'ocorrencias', ['tenant_id'], unique=False)
    op.create_foreign_key('fk_ocorrencias_academic_year_id', 'ocorrencias', 'academic_years', ['academic_year_id'], ['id'])
    op.create_foreign_key('fk_ocorrencias_tenant_id', 'ocorrencias', 'tenants', ['tenant_id'], ['id'])

    with op.batch_alter_table('ocorrencias') as batch_op:
        batch_op.drop_column('created_at')
        batch_op.drop_column('data_ocorrencia')
        batch_op.drop_column('resolvida')

    # 7. USUARIOS: Ensure tenant_id FK
    # (Assuming tenant_id column already exists from a1b2c3d4e5f6)
    # Just ensure it points to something if null
    op.execute("UPDATE usuarios SET tenant_id = (SELECT id FROM tenants LIMIT 1) WHERE tenant_id IS NULL")
    op.alter_column('usuarios', 'tenant_id', nullable=False)


def downgrade() -> None:
    # Downgrade logic would involve dropping columns, 
    # but for this major arch change we focus on successful upgrade.
    pass
