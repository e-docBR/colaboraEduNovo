"""add composite indexes for audit_logs and comunicados

Revision ID: c9f2a8b3d1e4
Revises: 915396a52c7d
Create Date: 2026-05-07 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

revision: str = "c9f2a8b3d1e4"
down_revision: Union[str, None] = "915396a52c7d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Índice composto para queries de auditoria por tenant + período
    op.create_index(
        "idx_audit_tenant_ts",
        "audit_logs",
        ["tenant_id", "timestamp"],
        if_not_exists=True,
    )

    # Remove índice simples anterior no tenant_id de audit_logs
    op.drop_index("ix_audit_logs_tenant_id", table_name="audit_logs", if_exists=True)

    # Índice composto para queries de comunicados por destinatário
    op.create_index(
        "idx_comunicado_target",
        "comunicados",
        ["tenant_id", "target_type", "target_value"],
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index("idx_comunicado_target", table_name="comunicados", if_exists=True)
    op.drop_index("idx_audit_tenant_ts", table_name="audit_logs", if_exists=True)
    op.create_index(
        "ix_audit_logs_tenant_id",
        "audit_logs",
        ["tenant_id"],
        if_not_exists=True,
    )
