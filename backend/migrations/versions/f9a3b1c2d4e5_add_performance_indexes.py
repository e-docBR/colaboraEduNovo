"""add_performance_indexes

Revision ID: f9a3b1c2d4e5
Revises: 858d070c6419
Create Date: 2026-04-17 00:00:00.000000

Add indexes on frequently queried foreign-key and filter columns to prevent
full-table scans in multi-tenant queries.
"""
from typing import Sequence, Union
from alembic import op

revision: str = "f9a3b1c2d4e5"
down_revision: Union[str, None] = "858d070c6419"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── notas ────────────────────────────────────────────────────────────────
    op.create_index("ix_notas_aluno_id", "notas", ["aluno_id"], if_not_exists=True)
    op.create_index("ix_notas_tenant_id", "notas", ["tenant_id"], if_not_exists=True)
    op.create_index("ix_notas_academic_year_id", "notas", ["academic_year_id"], if_not_exists=True)

    # ── ocorrencias ──────────────────────────────────────────────────────────
    op.create_index("ix_ocorrencias_aluno_id", "ocorrencias", ["aluno_id"], if_not_exists=True)
    op.create_index("ix_ocorrencias_tenant_id", "ocorrencias", ["tenant_id"], if_not_exists=True)
    op.create_index("ix_ocorrencias_academic_year_id", "ocorrencias", ["academic_year_id"], if_not_exists=True)
    op.create_index("ix_ocorrencias_data_registro", "ocorrencias", ["data_registro"], if_not_exists=True)

    # ── alunos ───────────────────────────────────────────────────────────────
    op.create_index("ix_alunos_tenant_id", "alunos", ["tenant_id"], if_not_exists=True)
    op.create_index("ix_alunos_academic_year_id", "alunos", ["academic_year_id"], if_not_exists=True)
    op.create_index("ix_alunos_turma", "alunos", ["turma"], if_not_exists=True)

    # ── usuarios ─────────────────────────────────────────────────────────────
    op.create_index("ix_usuarios_tenant_id", "usuarios", ["tenant_id"], if_not_exists=True)
    op.create_index("ix_usuarios_username", "usuarios", ["username"], if_not_exists=True)
    op.create_index("ix_usuarios_email", "usuarios", ["email"], if_not_exists=True)

    # ── comunicados ──────────────────────────────────────────────────────────
    op.create_index("ix_comunicados_tenant_id", "comunicados", ["tenant_id"], if_not_exists=True)
    op.create_index("ix_comunicados_academic_year_id", "comunicados", ["academic_year_id"], if_not_exists=True)

    # ── audit_logs ───────────────────────────────────────────────────────────
    op.create_index("ix_audit_logs_timestamp", "audit_logs", ["timestamp"], if_not_exists=True)
    op.create_index("ix_audit_logs_tenant_id", "audit_logs", ["tenant_id"], if_not_exists=True)


def downgrade() -> None:
    op.drop_index("ix_audit_logs_tenant_id", table_name="audit_logs", if_exists=True)
    op.drop_index("ix_audit_logs_timestamp", table_name="audit_logs", if_exists=True)
    op.drop_index("ix_comunicados_academic_year_id", table_name="comunicados", if_exists=True)
    op.drop_index("ix_comunicados_tenant_id", table_name="comunicados", if_exists=True)
    op.drop_index("ix_usuarios_email", table_name="usuarios", if_exists=True)
    op.drop_index("ix_usuarios_username", table_name="usuarios", if_exists=True)
    op.drop_index("ix_usuarios_tenant_id", table_name="usuarios", if_exists=True)
    op.drop_index("ix_alunos_turma", table_name="alunos", if_exists=True)
    op.drop_index("ix_alunos_academic_year_id", table_name="alunos", if_exists=True)
    op.drop_index("ix_alunos_tenant_id", table_name="alunos", if_exists=True)
    op.drop_index("ix_ocorrencias_data_registro", table_name="ocorrencias", if_exists=True)
    op.drop_index("ix_ocorrencias_academic_year_id", table_name="ocorrencias", if_exists=True)
    op.drop_index("ix_ocorrencias_tenant_id", table_name="ocorrencias", if_exists=True)
    op.drop_index("ix_ocorrencias_aluno_id", table_name="ocorrencias", if_exists=True)
    op.drop_index("ix_notas_academic_year_id", table_name="notas", if_exists=True)
    op.drop_index("ix_notas_tenant_id", table_name="notas", if_exists=True)
    op.drop_index("ix_notas_aluno_id", table_name="notas", if_exists=True)
