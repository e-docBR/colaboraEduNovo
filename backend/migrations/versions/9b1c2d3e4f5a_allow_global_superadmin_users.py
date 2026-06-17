"""allow global superadmin users

Revision ID: 9b1c2d3e4f5a
Revises: 464576e87da1
Create Date: 2026-06-17 15:12:45.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9b1c2d3e4f5a"
down_revision: Union[str, Sequence[str], None] = "464576e87da1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Allow platform super_admin accounts without tenant scope."""
    op.alter_column(
        "usuarios",
        "tenant_id",
        existing_type=sa.Integer(),
        existing_nullable=False,
        nullable=True,
    )


def downgrade() -> None:
    """Restore tenant_id NOT NULL for usuarios."""
    op.alter_column(
        "usuarios",
        "tenant_id",
        existing_type=sa.Integer(),
        existing_nullable=True,
        nullable=False,
    )
