"""Canonical role constants used across the application.

Centralising role names here prevents drift when roles are renamed or new ones
are added.  Import from this module instead of scattering string literals.
"""

# Every user that has some kind of staff / institutional function
STAFF_ROLES: frozenset[str] = frozenset(
    {"admin", "super_admin", "professor", "coordenador", "diretor", "orientador"}
)

# Users who can manage the school's operational data (approve, archive, delete)
MANAGER_ROLES: frozenset[str] = frozenset(
    {"admin", "super_admin", "coordenador", "orientador"}
)

# Users with tenant-wide administrative privileges
ADMIN_ROLES: frozenset[str] = frozenset({"admin", "super_admin"})

# Only the platform super-administrator (cross-tenant)
SUPER_ADMIN_ROLES: frozenset[str] = frozenset({"super_admin"})

# Roles that can register / update occurrences
OCORRENCIA_WRITE_ROLES: frozenset[str] = frozenset(
    {"admin", "super_admin", "coordenador", "orientador"}
)

# Roles that can send comunicados
COMUNICADO_WRITE_ROLES: frozenset[str] = frozenset(
    {"admin", "super_admin", "coordenador", "orientador"}
)

# Roles that can view full reports and charts
REPORT_ROLES: frozenset[str] = STAFF_ROLES

# Roles that can upload PDF boletins and trigger ingestion
UPLOAD_ROLES: frozenset[str] = frozenset({"admin", "super_admin"})


def has_any_role(roles: list[str], allowed: frozenset[str]) -> bool:
    """Return True if at least one of *roles* is in *allowed*."""
    return bool(set(roles) & allowed)
