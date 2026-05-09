from typing import Optional
from sqlalchemy.orm import Session

from app.repositories.tenant_repository import TenantRepository
from app.models.tenant import Tenant

class TenantService:
    def __init__(self, session: Session):
        self.repository = TenantRepository(session)
        
    def resolve_tenant(self, host: str) -> Optional[Tenant]:
        """
        Resolves tenant based on Host header.
        Example: school1.app.com -> domain=school1.app.com
        """
        tenant = self.repository.get_by_domain(host)
        if tenant:
            return tenant
            
        # Fallback 2: Check by slug if host contains it, or just use 'default'
        # For simple deployments, we allow 'default' to be the catch-all
        return self.repository.get_by_slug("default")

    def get_public_settings(self, tenant_id: int) -> dict:
        tenant = self.repository.get(tenant_id)
        if not tenant:
            return {}
        return tenant.settings or {}
