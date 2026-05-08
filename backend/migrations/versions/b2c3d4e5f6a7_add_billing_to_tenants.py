"""add_billing_to_tenants

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-05-08 01:00:00.000000

Adds billing fields (plano, plano_ativo, plano_expira_em,
stripe_customer_id, stripe_subscription_id) to the tenants table.
"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("plano", sa.String(32), nullable=False, server_default="trial"))
    op.add_column("tenants", sa.Column("plano_ativo", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("tenants", sa.Column("plano_expira_em", sa.DateTime(timezone=True), nullable=True))
    op.add_column("tenants", sa.Column("stripe_customer_id", sa.String(128), unique=True, nullable=True))
    op.add_column("tenants", sa.Column("stripe_subscription_id", sa.String(128), unique=True, nullable=True))


def downgrade() -> None:
    op.drop_column("tenants", "stripe_subscription_id")
    op.drop_column("tenants", "stripe_customer_id")
    op.drop_column("tenants", "plano_expira_em")
    op.drop_column("tenants", "plano_ativo")
    op.drop_column("tenants", "plano")
