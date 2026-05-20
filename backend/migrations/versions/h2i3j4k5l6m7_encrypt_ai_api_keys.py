"""Converte coluna api_key para Text (para tokens Fernet) e criptografa valores existentes.

Revision ID: h2i3j4k5l6m7
Revises: g1h2i3j4k5l6
Create Date: 2026-05-20 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "h2i3j4k5l6m7"
down_revision: Union[str, None] = "g1h2i3j4k5l6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Altera coluna api_key de String(512) para Text (tokens Fernet são maiores)
    with op.batch_alter_table("ai_configurations") as batch_op:
        batch_op.alter_column(
            "api_key",
            type_=sa.Text(),
            existing_type=sa.String(512),
            existing_nullable=True,
        )

    # 2. Criptografa valores existentes em texto plano
    #    Usa conexão direta — a app layer (TypeDecorator) ainda não está ativa aqui.
    try:
        import base64
        import hashlib

        from cryptography.fernet import Fernet

        from app.core.config import settings

        raw = hashlib.sha256(settings.secret_key.encode()).digest()
        fernet_key = base64.urlsafe_b64encode(raw)
        f = Fernet(fernet_key)
        prefix = "enc:"

        conn = op.get_bind()
        rows = conn.execute(
            sa.text("SELECT id, api_key FROM ai_configurations WHERE api_key IS NOT NULL AND api_key != ''")
        ).fetchall()

        for row_id, api_key in rows:
            if api_key and not api_key.startswith(prefix):
                encrypted = prefix + f.encrypt(api_key.encode()).decode()
                conn.execute(
                    sa.text("UPDATE ai_configurations SET api_key = :enc WHERE id = :id"),
                    {"enc": encrypted, "id": row_id},
                )
    except Exception as exc:
        # Não falha a migration se a criptografia não funcionar —
        # o decrypt_secret lida com valores legados em texto plano.
        import warnings
        warnings.warn(
            f"[h2i3j4k5l6m7] Não foi possível criptografar api_keys existentes: {exc}. "
            "As chaves serão criptografadas automaticamente na próxima atualização via admin.",
            UserWarning,
            stacklevel=2,
        )


def downgrade() -> None:
    # Reverte coluna para String(512)
    # NOTA: não descriptografa — os valores criptografados são simplesmente truncados se maiores.
    with op.batch_alter_table("ai_configurations") as batch_op:
        batch_op.alter_column(
            "api_key",
            type_=sa.String(512),
            existing_type=sa.Text(),
            existing_nullable=True,
        )
