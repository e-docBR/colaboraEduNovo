"""merge multiple heads

Revision ID: 5dfe9b7b19b1
Revises: a1b2c3d4e5f7, a7b8c9d0e1f2
Create Date: 2026-05-13 23:20:18.160535

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5dfe9b7b19b1'
down_revision: Union[str, Sequence[str], None] = ('a1b2c3d4e5f7', 'a7b8c9d0e1f2')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
