"""Substitui unique constraints globais por índices parciais que excluem soft-deleted.

Problema: UniqueConstraint("tenant_id", "username") impedia reutilizar um username
após soft-delete, tornando o slot permanentemente ocupado.

Solução: índice parcial PostgreSQL com WHERE deleted_at IS NULL — apenas registros
ativos competem por unicidade.

Revision ID: i3j4k5l6m7n8
Revises: h2i3j4k5l6m7
Create Date: 2026-05-20 00:01:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "i3j4k5l6m7n8"
down_revision: Union[str, None] = "h2i3j4k5l6m7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove constraints globais antigas (se existirem)
    with op.batch_alter_table("usuarios") as batch_op:
        try:
            batch_op.drop_constraint("uq_usuario_tenant_username", type_="unique")
        except Exception:
            pass  # pode não existir se já foi removido em outra migration
        try:
            batch_op.drop_constraint("uq_usuario_tenant_email", type_="unique")
        except Exception:
            pass

    # Cria índices parciais — apenas registros não deletados (deleted_at IS NULL)
    op.create_index(
        "uq_usuario_tenant_username_active",
        "usuarios",
        ["tenant_id", "username"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )
    op.create_index(
        "uq_usuario_tenant_email_active",
        "usuarios",
        ["tenant_id", "email"],
        unique=True,
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_usuario_tenant_email_active", table_name="usuarios")
    op.drop_index("uq_usuario_tenant_username_active", table_name="usuarios")

    with op.batch_alter_table("usuarios") as batch_op:
        batch_op.create_unique_constraint(
            "uq_usuario_tenant_username", ["tenant_id", "username"]
        )
        batch_op.create_unique_constraint(
            "uq_usuario_tenant_email", ["tenant_id", "email"]
        )
