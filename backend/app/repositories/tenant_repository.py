from typing import Optional
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.tenant import Tenant
from app.repositories.base import BaseRepository

class TenantRepository(BaseRepository[Tenant]):
    def __init__(self, session: Session):
        super().__init__(session, Tenant)

    def get_by_domain(self, domain: str) -> Optional[Tenant]:
        return self.session.execute(
            select(Tenant).where(Tenant.domain == domain)
        ).scalar_one_or_none()
    
    def get_by_slug(self, slug: str) -> Optional[Tenant]:
        return self.session.execute(
            select(Tenant).where(Tenant.slug == slug)
        ).scalar_one_or_none()
