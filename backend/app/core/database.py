from contextlib import contextmanager
from flask import g
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.orm.query import Query
from sqlalchemy.ext.declarative import declarative_base

from .config import settings

# 1. Base Query Class with Multi-tenant filtering
class TenantQuery(Query):
    def __new__(cls, *args, **kwargs):
        obj = super(TenantQuery, cls).__new__(cls)
        return obj

    def __init__(self, entities, session=None):
        super().__init__(entities, session)
        
    def _get_current_tenant_id(self):
        # Safely try to get tenant_id from Flask global 'g'
        try:
            return g.tenant_id
        except (RuntimeError, AttributeError):
            return None

    def enable_assertions(self, value):
        # Helper to disable filter if needed (internal use)
        self._filter_enabled = value
        return self

# 2. Event listener to inject filter
# Using 'before_compile' event is powerful but complex with caching.
# A simpler approach is to modify the get_all/filter methods in Repositories or use a Session event.
# However, 'do_orm_execute' in SQLAlchemy 1.4+ is the modern way.

engine = create_engine(
    settings.database_url,
    pool_size=20,
    max_overflow=10,
    pool_recycle=3600,
    pool_pre_ping=True,
    connect_args={"connect_timeout": 5} if not settings.database_url.startswith("sqlite") else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@event.listens_for(SessionLocal, "do_orm_execute")
def receive_do_orm_execute(orm_execute_state):
    # This hook runs for every ORM query execution
    
    # 1. Check if we are in a request context with a tenant
    try:
        current_tenant = g.tenant_id
    except (RuntimeError, AttributeError) as exc:
        from loguru import logger
        logger.debug("No tenant context in ORM execute hook ({}); skipping tenant filter", exc)
        current_tenant = None

    if current_tenant is None:
        return
        
    # 2. Check if the model being queried has 'tenant_id'
    # 'mappers' is a dictionary of mappers involved in the query
    if not orm_execute_state.is_select:
        return

    # Add filter criteria
    # This is a broad stroke: if the primary entity has tenant_id, filter it.
    
    # Preventing infinite recursion or double filtering is handled by opt-out options if needed
    if orm_execute_state.execution_options.get("include_all_tenants", False):
         return

    # Append WHERE tenant_id = X AND academic_year_id = Y
    from loguru import logger
    
    # 3. Identify target classes (from mappers or directly from tables)
    target_classes = set()
    for mapper in orm_execute_state.all_mappers:
        target_classes.add(mapper.class_)
    
    if not target_classes:
        # Fallback for count/avg where all_mappers might be empty
        from sqlalchemy.sql.schema import Table
        for from_obj in orm_execute_state.statement.froms:
            if isinstance(from_obj, Table):
                # Try to find the model class for this table name
                for mapper in Base.registry.mappers:
                    if mapper.local_table == from_obj:
                        target_classes.add(mapper.class_)
    
    for target_cls in target_classes:
        # Filter by tenant_id if present
        if hasattr(target_cls, "tenant_id"):
            orm_execute_state.statement = orm_execute_state.statement.where(
                target_cls.tenant_id == current_tenant
            )
            
        # Filter by academic_year_id if present in 'g' and in model
        try:
            current_year = g.academic_year_id
        except (RuntimeError, AttributeError):
            current_year = None

        if current_year and hasattr(target_cls, "academic_year_id"):
            # Avoid filtering AcademicYear table itself by academic_year_id to allow year switching/listing
            from app.models.academic_year import AcademicYear
            if target_cls != AcademicYear:
                orm_execute_state.statement = orm_execute_state.statement.where(
                    target_cls.academic_year_id == current_year
                )


Base = declarative_base()

def init_db(app):
    """
    Initializes the database.
    """
    # Import all models to ensure they are registered
    from .. import models  # noqa
    
    with app.app_context():
        # In dev with SQLite, we might just create all if not migrations
        # Base.metadata.create_all(bind=engine)
        pass

@contextmanager
def session_scope():
    """Provide a transactional scope around a series of operations."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
