"""hardening_v2: security and schema improvements

Revision ID: 2b3c4d5e6f7a
Revises: f9a3b1c2d4e5
Create Date: 2026-04-22 00:00:00.000000

Covers all schema changes from the v1.5 security hardening sprint:

  - audit_logs:   add tenant_id for per-school audit isolation (C3)
  - usuarios:     drop global unique on username; add per-tenant composite unique (A1)
                  drop global unique on email; add per-tenant composite unique (A1)
                  drop is_admin column — now a Python property derived from role (M5)
                  change aluno_id FK to ON DELETE SET NULL (A5)
  - alunos:       drop global unique on matricula; add per-tenant+year composite (A2)
                  add created_at / updated_at audit timestamps (M3)
                  add composite indexes for ORM tenant/year filters (M1)
  - notas:        add created_at / updated_at audit timestamps (M3)
                  add CHECK constraint on situacao valid values (M2)
                  add composite indexes (M1)
  - ocorrencias:  change aluno_id FK to ON DELETE CASCADE (A5)
                  change autor_id FK to ON DELETE SET NULL, make nullable (A5)
                  add composite indexes (M1)
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "2b3c4d5e6f7a"
down_revision: Union[str, Sequence[str], None] = "f9a3b1c2d4e5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _constraint_exists(conn, table: str, name: str) -> bool:
    row = conn.execute(
        sa.text(
            "SELECT 1 FROM pg_constraint c "
            "JOIN pg_class t ON t.oid = c.conrelid "
            "WHERE t.relname = :table AND c.conname = :name LIMIT 1"
        ),
        {"table": table, "name": name},
    ).fetchone()
    return row is not None


def _column_exists(conn, table: str, column: str) -> bool:
    row = conn.execute(
        sa.text(
            "SELECT 1 FROM information_schema.columns "
            "WHERE table_name = :table AND column_name = :column LIMIT 1"
        ),
        {"table": table, "column": column},
    ).fetchone()
    return row is not None


def _index_exists(conn, name: str) -> bool:
    row = conn.execute(
        sa.text("SELECT 1 FROM pg_indexes WHERE indexname = :name LIMIT 1"),
        {"name": name},
    ).fetchone()
    return row is not None


def _drop_constraint_if_exists(conn, table: str, name: str, type_: str = "u") -> None:
    if _constraint_exists(conn, table, name):
        conn.execute(sa.text(f'ALTER TABLE {table} DROP CONSTRAINT "{name}"'))


def _find_and_drop_fk(conn, table: str, column: str) -> None:
    """Drop any FK constraint on a specific column of a table."""
    rows = conn.execute(
        sa.text(
            "SELECT c.conname FROM pg_constraint c "
            "JOIN pg_class t ON t.oid = c.conrelid "
            "JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey) "
            "WHERE t.relname = :table AND c.contype = 'f' AND a.attname = :column"
        ),
        {"table": table, "column": column},
    ).fetchall()
    for row in rows:
        conn.execute(sa.text(f'ALTER TABLE {table} DROP CONSTRAINT "{row[0]}"'))


# ---------------------------------------------------------------------------
# Upgrade
# ---------------------------------------------------------------------------

def upgrade() -> None:
    conn = op.get_bind()

    # ── 1. audit_logs: add tenant_id ─────────────────────────────────────────
    if not _column_exists(conn, "audit_logs", "tenant_id"):
        op.add_column(
            "audit_logs",
            sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=True),
        )
    if not _index_exists(conn, "ix_audit_logs_tenant_id_fk"):
        op.create_index("ix_audit_logs_tenant_id_fk", "audit_logs", ["tenant_id"])

    # ── 2. usuarios ───────────────────────────────────────────────────────────

    # 2a. Drop global unique on username (Postgres auto-names it usuarios_username_key)
    for name in ("usuarios_username_key", "uq_usuario_username"):
        _drop_constraint_if_exists(conn, "usuarios", name)

    # 2b. Drop global unique on email (if it exists)
    for name in ("usuarios_email_key", "uq_usuario_email"):
        _drop_constraint_if_exists(conn, "usuarios", name)

    # 2c. Add composite unique constraints per tenant
    if not _constraint_exists(conn, "usuarios", "uq_usuario_tenant_username"):
        op.create_unique_constraint(
            "uq_usuario_tenant_username", "usuarios", ["tenant_id", "username"]
        )
    if not _constraint_exists(conn, "usuarios", "uq_usuario_tenant_email"):
        op.create_unique_constraint(
            "uq_usuario_tenant_email", "usuarios", ["tenant_id", "email"]
        )

    # 2d. Drop is_admin column (now a Python property derived from role)
    if _column_exists(conn, "usuarios", "is_admin"):
        op.drop_column("usuarios", "is_admin")

    # 2e. Add email column if missing (was added outside initial migrations)
    if not _column_exists(conn, "usuarios", "email"):
        op.add_column(
            "usuarios",
            sa.Column("email", sa.String(255), nullable=True),
        )

    # 2f. Add is_active column if missing
    if not _column_exists(conn, "usuarios", "is_active"):
        op.add_column(
            "usuarios",
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        )

    # 2g. Change aluno_id FK to ON DELETE SET NULL
    _find_and_drop_fk(conn, "usuarios", "aluno_id")
    if _column_exists(conn, "usuarios", "aluno_id"):
        op.create_foreign_key(
            "fk_usuarios_aluno_id_set_null",
            "usuarios",
            "alunos",
            ["aluno_id"],
            ["id"],
            ondelete="SET NULL",
        )

    # ── 3. alunos ─────────────────────────────────────────────────────────────

    # 3a. Drop global unique on matricula
    for name in ("alunos_matricula_key", "uq_aluno_matricula"):
        _drop_constraint_if_exists(conn, "alunos", name)

    # 3b. Add per-tenant+year composite unique
    if not _constraint_exists(conn, "alunos", "uq_aluno_tenant_year_matricula"):
        op.create_unique_constraint(
            "uq_aluno_tenant_year_matricula",
            "alunos",
            ["tenant_id", "academic_year_id", "matricula"],
        )

    # 3c. Add audit timestamps
    if not _column_exists(conn, "alunos", "created_at"):
        op.add_column(
            "alunos",
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
        )
    if not _column_exists(conn, "alunos", "updated_at"):
        op.add_column(
            "alunos",
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
        )

    # 3d. Composite indexes for tenant/year ORM filter
    if not _index_exists(conn, "idx_aluno_tenant_year"):
        op.create_index("idx_aluno_tenant_year", "alunos", ["tenant_id", "academic_year_id"])
    if not _index_exists(conn, "idx_aluno_tenant_year_turma"):
        op.create_index(
            "idx_aluno_tenant_year_turma", "alunos", ["tenant_id", "academic_year_id", "turma"]
        )

    # ── 4. notas ──────────────────────────────────────────────────────────────

    # 4a. Add audit timestamps
    if not _column_exists(conn, "notas", "created_at"):
        op.add_column(
            "notas",
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
        )
    if not _column_exists(conn, "notas", "updated_at"):
        op.add_column(
            "notas",
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.func.now(),
            ),
        )

    # 4b. CHECK constraint on situacao
    if not _constraint_exists(conn, "notas", "ck_nota_situacao_valid"):
        op.create_check_constraint(
            "ck_nota_situacao_valid",
            "notas",
            "situacao IS NULL OR situacao IN ('APR', 'REP', 'REC', 'APCC', 'AR')",
        )

    # 4c. Composite indexes
    if not _index_exists(conn, "idx_nota_tenant_year"):
        op.create_index("idx_nota_tenant_year", "notas", ["tenant_id", "academic_year_id"])
    if not _index_exists(conn, "idx_nota_aluno"):
        op.create_index("idx_nota_aluno", "notas", ["aluno_id"])
    if not _index_exists(conn, "idx_nota_disciplina_norm"):
        op.create_index("idx_nota_disciplina_norm", "notas", ["disciplina_normalizada"])

    # ── 5. ocorrencias ────────────────────────────────────────────────────────

    # 5a. Change aluno_id FK to ON DELETE CASCADE
    _find_and_drop_fk(conn, "ocorrencias", "aluno_id")
    op.create_foreign_key(
        "fk_ocorrencias_aluno_id_cascade",
        "ocorrencias",
        "alunos",
        ["aluno_id"],
        ["id"],
        ondelete="CASCADE",
    )

    # 5b. Change autor_id FK to ON DELETE SET NULL and make nullable
    _find_and_drop_fk(conn, "ocorrencias", "autor_id")
    if _column_exists(conn, "ocorrencias", "autor_id"):
        op.alter_column("ocorrencias", "autor_id", nullable=True)
        op.create_foreign_key(
            "fk_ocorrencias_autor_id_set_null",
            "ocorrencias",
            "usuarios",
            ["autor_id"],
            ["id"],
            ondelete="SET NULL",
        )

    # 5c. Composite indexes
    if not _index_exists(conn, "idx_ocorrencia_tenant_year"):
        op.create_index(
            "idx_ocorrencia_tenant_year", "ocorrencias", ["tenant_id", "academic_year_id"]
        )
    if not _index_exists(conn, "idx_ocorrencia_aluno"):
        op.create_index("idx_ocorrencia_aluno", "ocorrencias", ["aluno_id"])


# ---------------------------------------------------------------------------
# Downgrade
# ---------------------------------------------------------------------------

def downgrade() -> None:
    conn = op.get_bind()

    # ocorrencias
    _find_and_drop_fk(conn, "ocorrencias", "aluno_id")
    op.create_foreign_key(None, "ocorrencias", "alunos", ["aluno_id"], ["id"])
    _find_and_drop_fk(conn, "ocorrencias", "autor_id")
    op.create_foreign_key(None, "ocorrencias", "usuarios", ["autor_id"], ["id"])
    for idx in ("idx_ocorrencia_tenant_year", "idx_ocorrencia_aluno"):
        if _index_exists(conn, idx):
            op.drop_index(idx, table_name="ocorrencias")

    # notas
    for idx in ("idx_nota_tenant_year", "idx_nota_aluno", "idx_nota_disciplina_norm"):
        if _index_exists(conn, idx):
            op.drop_index(idx, table_name="notas")
    _drop_constraint_if_exists(conn, "notas", "ck_nota_situacao_valid")
    if _column_exists(conn, "notas", "updated_at"):
        op.drop_column("notas", "updated_at")
    if _column_exists(conn, "notas", "created_at"):
        op.drop_column("notas", "created_at")

    # alunos
    for idx in ("idx_aluno_tenant_year", "idx_aluno_tenant_year_turma"):
        if _index_exists(conn, idx):
            op.drop_index(idx, table_name="alunos")
    _drop_constraint_if_exists(conn, "alunos", "uq_aluno_tenant_year_matricula")
    op.create_unique_constraint("alunos_matricula_key", "alunos", ["matricula"])
    if _column_exists(conn, "alunos", "updated_at"):
        op.drop_column("alunos", "updated_at")
    if _column_exists(conn, "alunos", "created_at"):
        op.drop_column("alunos", "created_at")

    # usuarios
    _find_and_drop_fk(conn, "usuarios", "aluno_id")
    op.create_foreign_key(None, "usuarios", "alunos", ["aluno_id"], ["id"])
    _drop_constraint_if_exists(conn, "usuarios", "uq_usuario_tenant_username")
    _drop_constraint_if_exists(conn, "usuarios", "uq_usuario_tenant_email")
    op.create_unique_constraint("usuarios_username_key", "usuarios", ["username"])
    op.add_column(
        "usuarios",
        sa.Column("is_admin", sa.Boolean(), nullable=False, server_default="false"),
    )

    # audit_logs
    if _index_exists(conn, "ix_audit_logs_tenant_id_fk"):
        op.drop_index("ix_audit_logs_tenant_id_fk", table_name="audit_logs")
    if _column_exists(conn, "audit_logs", "tenant_id"):
        op.drop_column("audit_logs", "tenant_id")
